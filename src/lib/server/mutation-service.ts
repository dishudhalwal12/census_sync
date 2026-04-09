import "server-only";

import { Buffer } from "node:buffer";

import { getAdminAuth, getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { sanitizeStorageName } from "@/lib/missions/utils";
import { mutateReviewStore, readReviewStore } from "@/lib/review-store/server";
import { getServerRuntimeMode } from "@/lib/server/runtime";
import {
  buildAlerts,
  buildCoverageGaps,
  buildCoverageTargets,
  buildEnumeratorScorecards,
  buildReviewCase,
  deriveSubmissionStatuses,
  evaluateHouseholdRisk,
  evaluateMissionRisk
} from "@/lib/trust/engine";
import type { AuthSession } from "@/types/session";
import type {
  Assignment,
  AuditLogEvent,
  CoordinatePoint,
  ExportFormat,
  ExportRequest,
  HouseholdSubmission,
  MissionSubmission,
  Project,
  ProjectType,
  ReviewCase,
  ReviewCaseStatus,
  RevisitReason,
  Scope,
  SubmissionReviewStatus,
  SubmissionSyncStatus,
  SubmissionValidationStatus,
  TemplateSection,
  UserProfile,
  UserRole
} from "@/types/domain";

export interface ExportRow {
  householdId: string;
  headOfHousehold: string;
  district: string;
  block: string;
  members: number;
  syncStatus: string;
  validationStatus: string;
  reviewStatus: string;
  riskLevel?: string;
  riskScore?: number;
  visitOutcome?: string;
  capturedAt: string;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function pickProjectType(value: unknown): ProjectType {
  return value === "community_survey" ||
    value === "campus_outreach" ||
    value === "social_audit"
    ? value
    : "census";
}

function normalizeScopes(scopes?: Scope[]) {
  return (scopes ?? []).filter((scope) => scope?.district && scope?.block);
}

function scopeMatches(scopes: Scope[], candidate?: Scope) {
  if (!candidate || !scopes.length) {
    return false;
  }

  return scopes.some((scope) => {
    const districtMatches =
      scope.district === "All Districts" || scope.district === candidate.district;
    const blockMatches =
      scope.block === "All Blocks" || scope.block === candidate.block;
    const clusterMatches = !scope.cluster || scope.cluster === candidate.cluster;

    return districtMatches && blockMatches && clusterMatches;
  });
}

function assertAdmin(session: AuthSession) {
  if (session.role !== "admin") {
    throw new Error("Admin access is required.");
  }
}

function assertSupervisorOrAdmin(session: AuthSession) {
  if (session.role !== "admin") {
    throw new Error("Admin access is required.");
  }
}

function canAccessSubmission(session: AuthSession, submission: HouseholdSubmission) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role === "employee") {
    return submission.enumeratorId === session.uid;
  }

  const projectMatches = !session.projectId || session.projectId === submission.projectId;
  return projectMatches && scopeMatches(session.scopes, submission.scope);
}

function buildAuditLog(
  session: AuthSession,
  action: string,
  targetType: string,
  targetId: string,
  scope?: Scope,
  metadata?: Record<string, string | number | boolean | null>
): AuditLogEvent {
  return {
    id: createId("audit"),
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action,
    targetType,
    targetId,
    scope,
    metadata,
    timestamp: new Date().toISOString()
  };
}

function buildGeneratedAlerts(params: {
  submissions: HouseholdSubmission[];
  missionSubmissions: MissionSubmission[];
  reviewCases: ReviewCase[];
  assignments: Assignment[];
}) {
  return buildAlerts({
    reviewCases: params.reviewCases,
    gaps: buildCoverageGaps(
      params.submissions,
      params.reviewCases,
      buildCoverageTargets(params.assignments)
    ),
    scorecards: buildEnumeratorScorecards(
      params.submissions,
      params.missionSubmissions,
      params.reviewCases
    ),
    missionSubmissions: params.missionSubmissions
  });
}

function resolveReviewCaseId(submission: HouseholdSubmission | MissionSubmission) {
  return submission.reviewCaseId ?? `review-${submission.revisionGroupId ?? submission.submissionId}`;
}

function buildSubmissionConflictMessage(reviewStatus: SubmissionReviewStatus) {
  switch (reviewStatus) {
    case "revisit_requested":
      return "Revisit synced and waiting for supervisor review.";
    case "under_review":
      return "Resubmission synced and is currently under supervisor review.";
    case "escalated":
      return "Submission escalated for admin review.";
    case "approved":
      return "Supervisor approved the submission.";
    case "rejected":
      return "Submission rejected during supervisor review.";
    default:
      return "Submission needs supervisor review because of trust-risk signals.";
  }
}

function buildExportRows(submissions: HouseholdSubmission[]): ExportRow[] {
  return submissions.map((submission) => ({
    householdId: submission.householdId,
    headOfHousehold: submission.headOfHousehold,
    district: submission.scope.district,
    block: submission.scope.block,
    members: submission.members.length,
    syncStatus: submission.syncStatus,
    validationStatus: submission.validationStatus,
    reviewStatus: submission.reviewStatus,
    riskLevel: submission.riskLevel,
    riskScore: submission.riskScore,
    visitOutcome: submission.visitOutcome,
    capturedAt: submission.capturedAt
  }));
}

function filterExportSubmissions(
  submissions: HouseholdSubmission[],
  session: AuthSession,
  payload: {
    projectId?: string;
    filters?: {
      status?: string;
      enumeratorId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  }
) {
  return submissions
    .filter((submission) => {
      if (!canAccessSubmission(session, submission)) {
        return false;
      }

      if (payload.projectId && submission.projectId !== payload.projectId) {
        return false;
      }

      return true;
    })
    .filter((submission) => {
      const { status, enumeratorId, dateFrom, dateTo } = payload.filters ?? {};

      if (
        status &&
        submission.validationStatus !== status &&
        submission.syncStatus !== status &&
        submission.reviewStatus !== status
      ) {
        return false;
      }

      if (enumeratorId && submission.enumeratorId !== enumeratorId) {
        return false;
      }

      if (dateFrom && submission.capturedAt < dateFrom) {
        return false;
      }

      if (dateTo && submission.capturedAt > dateTo) {
        return false;
      }

      return true;
    });
}

async function appendLiveAuditLog(
  session: AuthSession,
  action: string,
  targetType: string,
  targetId: string,
  scope?: Scope,
  metadata?: Record<string, string | number | boolean | null>
) {
  const db = getAdminDb();
  if (!db) {
    return;
  }

  const event = buildAuditLog(session, action, targetType, targetId, scope, metadata);
  await db.collection("audit_logs").doc(event.id).set(event);
}

export async function upsertManagedUser(
  payload: {
    uid?: string;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    projectId?: string;
    assignmentLabel?: string;
    targetCount?: number;
    scopes?: Scope[];
  },
  session: AuthSession
) {
  assertAdmin(session);

  const normalizedScopes = normalizeScopes(payload.scopes);

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const now = new Date().toISOString();
      const project = draft.projects.find((entry) => entry.id === payload.projectId);
      const uid = payload.uid ?? createId("user");
      const existingIndex = draft.users.findIndex((entry) => entry.uid === uid);
      const nextUser: UserProfile = {
        uid,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        status: "active",
        projectId: payload.projectId,
        assignmentLabel:
          payload.assignmentLabel ??
          (project
            ? `${project.name} / ${normalizedScopes[0]?.block ?? "Unassigned"}`
            : "Awaiting assignment"),
        scopes: normalizedScopes,
        assignedTemplateVersion: project?.activeTemplateVersionId ?? "template-unassigned",
        lastLoginAt:
          existingIndex >= 0 ? draft.users[existingIndex]?.lastLoginAt : undefined,
        createdAt:
          existingIndex >= 0 ? draft.users[existingIndex]!.createdAt : now
      };

      if (existingIndex >= 0) {
        draft.users[existingIndex] = nextUser;
      } else {
        draft.users.push(nextUser);
      }

      if (payload.projectId && normalizedScopes.length && payload.role !== "admin") {
        const assignmentId = `${payload.projectId}-${uid}`;
        const assignment: Assignment = {
          id: assignmentId,
          projectId: payload.projectId,
          projectType: pickProjectType(project?.type),
          templateVersionId: project?.activeTemplateVersionId,
          enumeratorId: payload.role === "employee" ? uid : undefined,
          assigneeUid: payload.role === "employee" ? uid : undefined,
          supervisorId: undefined,
          scope: normalizedScopes[0]!,
          label:
            payload.assignmentLabel ??
            `${project?.name ?? "Project"} field assignment`,
          activeScopeOwner: uid,
          targetCount: Number(payload.targetCount ?? 0) || 0,
          activeFrom: now,
          status: "active"
        };
        const assignmentIndex = draft.assignments.findIndex(
          (entry) => entry.id === assignmentId
        );
        if (assignmentIndex >= 0) {
          draft.assignments[assignmentIndex] = assignment;
        } else {
          draft.assignments.push(assignment);
        }
      }

      draft.audit_logs.push(
        buildAuditLog(session, "upserted_user", "user", uid, normalizedScopes[0], {
          role: payload.role,
          projectId: payload.projectId ?? null
        })
      );

      return { uid };
    });
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const projectSnapshot = payload.projectId
    ? await db.collection("projects").doc(payload.projectId).get()
    : null;
  const project = projectSnapshot?.exists
    ? (projectSnapshot.data() as Project)
    : undefined;

  let uid = payload.uid;
  if (!uid) {
    if (!payload.password || payload.password.length < 6) {
      throw new Error("A password with at least 6 characters is required for new users.");
    }

    const user = await auth.createUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.name
    });
    uid = user.uid;
  } else {
    await auth.updateUser(uid, {
      displayName: payload.name,
      ...(payload.password ? { password: payload.password } : {})
    });
  }

  await db.collection("users").doc(uid).set(
    {
      uid,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: "active",
      projectId: payload.projectId ?? null,
      assignmentLabel:
        payload.assignmentLabel ??
        (project
          ? `${project.name} / ${normalizedScopes[0]?.block ?? "Unassigned"}`
          : "Awaiting assignment"),
      scopes: normalizedScopes,
      assignedTemplateVersion: project?.activeTemplateVersionId ?? "template-unassigned",
      createdAt: new Date().toISOString()
    },
    { merge: true }
  );

  await auth.setCustomUserClaims(uid, {
    role: payload.role,
    projectId: payload.projectId ?? null,
    districts: normalizedScopes.map((scope) => scope.district),
    blocks: normalizedScopes.map((scope) => scope.block)
  });

  if (payload.projectId && normalizedScopes.length && payload.role !== "admin") {
    const assignmentId = `${payload.projectId}-${uid}`;
    await db.collection("assignments").doc(assignmentId).set(
      {
        id: assignmentId,
        projectId: payload.projectId,
        projectType: pickProjectType(project?.type),
        templateVersionId: project?.activeTemplateVersionId ?? null,
        enumeratorId: payload.role === "employee" ? uid : null,
        assigneeUid: payload.role === "employee" ? uid : null,
        supervisorId: null,
        scope: normalizedScopes[0],
        label:
          payload.assignmentLabel ??
          `${project?.name ?? "Project"} field assignment`,
        activeScopeOwner: uid,
        targetCount: Number(payload.targetCount ?? 0) || 0,
        activeFrom: new Date().toISOString(),
        status: "active"
      },
      { merge: true }
    );
  }

  await appendLiveAuditLog(session, "upserted_user", "user", uid, normalizedScopes[0], {
    role: payload.role,
    projectId: payload.projectId ?? null
  });

  return { uid };
}

export async function createManagedProject(
  payload: {
    name: string;
    description?: string;
    type?: ProjectType;
    district: string;
    block: string;
    cluster?: string;
    targetSubmissions?: number;
  },
  session: AuthSession
) {
  assertAdmin(session);

  const now = new Date().toISOString();
  const projectId = createId("project");
  const project: Project = {
    id: projectId,
    name: payload.name,
    slug: slugify(payload.name),
    description:
      payload.description ??
      "Offline field survey workflow with assignment tracking, validation, and exports.",
    type: pickProjectType(payload.type),
    status: "active",
    activeTemplateVersionId: undefined,
    targetSubmissions: Number(payload.targetSubmissions ?? 0) || 0,
    scope: [
      {
        district: payload.district,
        block: payload.block,
        cluster: payload.cluster
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      draft.projects.push(project);
      draft.audit_logs.push(
        buildAuditLog(session, "created_project", "project", project.id, project.scope[0], {
          type: project.type
        })
      );
      return { id: project.id };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  await db.collection("projects").doc(project.id).set(project);
  await appendLiveAuditLog(session, "created_project", "project", project.id, project.scope[0], {
    type: project.type
  });
  return { id: project.id };
}

export async function activateManagedTemplate(
  payload: { templateId: string },
  session: AuthSession
) {
  assertAdmin(session);

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const template = draft.template_versions.find((entry) => entry.id === payload.templateId);
      if (!template) {
        throw new Error("Template not found.");
      }

      draft.template_versions = draft.template_versions.map((entry) => ({
        ...entry,
        status:
          entry.projectId === template.projectId
            ? entry.id === payload.templateId
              ? "active"
              : "archived"
            : entry.status
      }));

      draft.projects = draft.projects.map((project) =>
        project.id === template.projectId
          ? {
              ...project,
              activeTemplateVersionId: payload.templateId,
              updatedAt: new Date().toISOString()
            }
          : project
      );

      draft.audit_logs.push(
        buildAuditLog(session, "activated_template", "template", payload.templateId, undefined, {
          version: template.version
        })
      );

      return { ok: true };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const templateRef = db.collection("template_versions").doc(payload.templateId);
  const templateSnapshot = await templateRef.get();
  if (!templateSnapshot.exists) {
    throw new Error("Template not found.");
  }

  const template = templateSnapshot.data() as { projectId: string; version: string };
  const relatedTemplates = await db
    .collection("template_versions")
    .where("projectId", "==", template.projectId)
    .get();

  const batch = db.batch();
  relatedTemplates.docs.forEach((doc) => {
    batch.set(
      doc.ref,
      { status: doc.id === payload.templateId ? "active" : "archived" },
      { merge: true }
    );
  });
  batch.set(
    db.collection("projects").doc(template.projectId),
    {
      activeTemplateVersionId: payload.templateId,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  await batch.commit();

  await appendLiveAuditLog(session, "activated_template", "template", payload.templateId, undefined, {
    version: template.version
  });

  return { ok: true };
}

export async function createManagedMission(
  payload: {
    name: string;
    description?: string;
    objective?: string;
    type?: ProjectType;
    district: string;
    block: string;
    cluster?: string;
    siteCenter: CoordinatePoint;
    serviceRadiusMeters?: number;
    capacityLimit?: number;
    activeTo?: string;
    assigneeUid: string;
    sections: TemplateSection[];
  },
  session: AuthSession
) {
  assertAdmin(session);

  const now = new Date().toISOString();
  const projectId = createId("project");
  const templateId = createId("template");
  const assignmentId = createId("assignment");
  const shareCode = `${slugify(payload.name)}-${assignmentId.slice(-6).toLowerCase()}`;
  const scope: Scope = {
    district: payload.district,
    block: payload.block,
    cluster: payload.cluster
  };
  const requiredResponses = payload.sections.reduce(
    (sum, section) =>
      sum +
      section.fields.filter(
        (field) => field.required && field.kind !== "instruction"
      ).length,
    0
  );

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const assignee = draft.users.find((entry) => entry.uid === payload.assigneeUid);
      if (!assignee) {
        throw new Error("Assigned enumerator could not be found.");
      }

      draft.projects.push({
        id: projectId,
        name: payload.name,
        slug: slugify(payload.name),
        description:
          payload.description ??
          "Geofenced mission assignment with proof-of-visit validation.",
        objective: payload.objective ?? "Field verification mission",
        type: pickProjectType(payload.type),
        status: "active",
        activeTemplateVersionId: templateId,
        targetSubmissions: Number(payload.capacityLimit ?? 0) || 0,
        siteCenter: payload.siteCenter,
        serviceRadiusMeters: Number(payload.serviceRadiusMeters ?? 1000) || 1000,
        capacityLimit: Number(payload.capacityLimit ?? 0) || 0,
        verificationMode: "hard_lock",
        scope: [scope],
        createdAt: now,
        updatedAt: now
      });

      draft.template_versions.push({
        id: templateId,
        projectId,
        projectType: pickProjectType(payload.type),
        name: `${payload.name} Mission`,
        version: `${new Date().getFullYear()}.mission.1`,
        status: "active",
        sections: payload.sections,
        releaseNotes: "Mission template created from the guided mission builder.",
        publishedAt: now,
        createdAt: now
      });

      draft.assignments.push({
        id: assignmentId,
        projectId,
        projectType: pickProjectType(payload.type),
        templateVersionId: templateId,
        enumeratorId: payload.assigneeUid,
        assigneeUid: payload.assigneeUid,
        supervisorId: undefined,
        scope,
        label: payload.name,
        activeScopeOwner: payload.assigneeUid,
        targetCount: Number(payload.capacityLimit ?? 0) || 0,
        activeFrom: now,
        activeTo: payload.activeTo,
        status: "active",
        shareCode,
        activationStatus: "sent",
        progress: {
          requiredResponses,
          completedResponses: 0
        }
      });

      draft.audit_logs.push(
        buildAuditLog(session, "published_mission", "assignment", assignmentId, scope, {
          projectId,
          templateId,
          assigneeUid: assignee.uid
        })
      );

      return { sharePath: `/field/${shareCode}` };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const assigneeSnapshot = await db.collection("users").doc(payload.assigneeUid).get();
  if (!assigneeSnapshot.exists) {
    throw new Error("Assigned enumerator could not be found.");
  }

  const batch = db.batch();
  batch.set(db.collection("projects").doc(projectId), {
    id: projectId,
    name: payload.name,
    slug: slugify(payload.name),
    description:
      payload.description ??
      "Geofenced mission assignment with proof-of-visit validation.",
    objective: payload.objective ?? "Field verification mission",
    type: pickProjectType(payload.type),
    status: "active",
    activeTemplateVersionId: templateId,
    targetSubmissions: Number(payload.capacityLimit ?? 0) || 0,
    siteCenter: payload.siteCenter,
    serviceRadiusMeters: Number(payload.serviceRadiusMeters ?? 1000) || 1000,
    capacityLimit: Number(payload.capacityLimit ?? 0) || 0,
    verificationMode: "hard_lock",
    scope: [scope],
    createdAt: now,
    updatedAt: now
  });
  batch.set(db.collection("template_versions").doc(templateId), {
    id: templateId,
    projectId,
    projectType: pickProjectType(payload.type),
    name: `${payload.name} Mission`,
    version: `${new Date().getFullYear()}.mission.1`,
    status: "active",
    sections: payload.sections,
    releaseNotes: "Mission template created from the guided mission builder.",
    publishedAt: now,
    createdAt: now
  });
  batch.set(db.collection("assignments").doc(assignmentId), {
    id: assignmentId,
    projectId,
    projectType: pickProjectType(payload.type),
    templateVersionId: templateId,
    enumeratorId: payload.assigneeUid,
    assigneeUid: payload.assigneeUid,
    scope,
    label: payload.name,
    activeScopeOwner: payload.assigneeUid,
    targetCount: Number(payload.capacityLimit ?? 0) || 0,
    activeFrom: now,
    activeTo: payload.activeTo ?? null,
    status: "active",
    shareCode,
    activationStatus: "sent",
    progress: {
      requiredResponses,
      completedResponses: 0
    }
  });
  await batch.commit();

  await appendLiveAuditLog(session, "published_mission", "assignment", assignmentId, scope, {
    projectId,
    templateId,
    assigneeUid: payload.assigneeUid
  });

  return { sharePath: `/field/${shareCode}` };
}

export async function calibrateManagedMissionLocation(
  payload: {
    assignmentId: string;
    siteCenter: CoordinatePoint;
    serviceRadiusMeters?: number;
  },
  session: AuthSession
) {
  assertAdmin(session);

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const assignment = draft.assignments.find((entry) => entry.id === payload.assignmentId);
      if (!assignment) {
        throw new Error("Mission assignment not found.");
      }

      draft.projects = draft.projects.map((project) =>
        project.id === assignment.projectId
          ? {
              ...project,
              siteCenter: payload.siteCenter,
              serviceRadiusMeters:
                Number(payload.serviceRadiusMeters ?? project.serviceRadiusMeters ?? 1000) || 1000,
              updatedAt: new Date().toISOString()
            }
          : project
      );

      draft.audit_logs.push(
        buildAuditLog(session, "calibrated_mission_location", "assignment", assignment.id, assignment.scope, {
          latitude: payload.siteCenter.latitude,
          longitude: payload.siteCenter.longitude
        })
      );

      return { ok: true };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const assignmentSnapshot = await db.collection("assignments").doc(payload.assignmentId).get();
  if (!assignmentSnapshot.exists) {
    throw new Error("Mission assignment not found.");
  }

  const assignment = assignmentSnapshot.data() as Assignment;
  await db.collection("projects").doc(assignment.projectId).set(
    {
      siteCenter: payload.siteCenter,
      serviceRadiusMeters: Number(payload.serviceRadiusMeters ?? 1000) || 1000,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  await appendLiveAuditLog(
    session,
    "calibrated_mission_location",
    "assignment",
    assignment.id,
    assignment.scope,
    {
      latitude: payload.siteCenter.latitude,
      longitude: payload.siteCenter.longitude
    }
  );

  return { ok: true };
}

export async function reviewManagedSubmission(
  payload: {
    submissionId: string;
    action:
      | "resolved"
      | "under_review"
      | "revisit_requested"
      | "approved"
      | "rejected"
      | "escalated";
    reviewNotes?: string;
    revisitReasons?: RevisitReason[];
  },
  session: AuthSession
) {
  assertSupervisorOrAdmin(session);
  const action = payload.action === "resolved" ? "approved" : payload.action;

  function nextSubmissionState(current: HouseholdSubmission) {
    if (action === "approved") {
      return {
        validationStatus: "approved" as SubmissionValidationStatus,
        syncStatus: "synced" as SubmissionSyncStatus,
        reviewStatus: "approved" as SubmissionReviewStatus,
        validationMessage: "Supervisor approved the submission."
      };
    }

    if (action === "rejected") {
      return {
        validationStatus: "rejected" as SubmissionValidationStatus,
        syncStatus: "flagged" as SubmissionSyncStatus,
        reviewStatus: "rejected" as SubmissionReviewStatus,
        validationMessage: "Supervisor rejected the submission."
      };
    }

    if (action === "revisit_requested") {
      return {
        validationStatus: current.validationStatus,
        syncStatus: "flagged" as SubmissionSyncStatus,
        reviewStatus: "revisit_requested" as SubmissionReviewStatus,
        validationMessage: "Supervisor requested a field revisit."
      };
    }

    if (action === "under_review") {
      return {
        validationStatus: current.validationStatus,
        syncStatus: "flagged" as SubmissionSyncStatus,
        reviewStatus: "under_review" as SubmissionReviewStatus,
        validationMessage: "Submission is now under supervisor review."
      };
    }

    return {
      validationStatus: current.validationStatus,
      syncStatus: "flagged" as SubmissionSyncStatus,
      reviewStatus: "escalated" as SubmissionReviewStatus,
      validationMessage: "Escalated to admin for further review."
    };
  }

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const index = draft.submissions.findIndex(
        (entry) => entry.submissionId === payload.submissionId
      );
      if (index < 0) {
        throw new Error("Submission not found.");
      }

      const current = draft.submissions[index]!;
      if (!canAccessSubmission(session, current)) {
        throw new Error("This submission is outside your assigned scope.");
      }

      const state = nextSubmissionState(current);
      const reviewCaseId = resolveReviewCaseId(current);
      const existingReviewCaseIndex = draft.review_cases.findIndex(
        (entry) => entry.id === reviewCaseId || entry.currentSubmissionId === current.submissionId
      );
      const now = new Date().toISOString();

      draft.submissions[index] = {
        ...current,
        reviewCaseId,
        validationStatus: state.validationStatus,
        syncStatus: state.syncStatus,
        reviewStatus: state.reviewStatus,
        reviewNotes: payload.reviewNotes,
        reviewedBy: session.uid,
        reviewedByName: session.name,
        reviewedAt: now,
        validationMessage: state.validationMessage,
        updatedAt: now
      };

      if (existingReviewCaseIndex >= 0) {
        const reviewCase = draft.review_cases[existingReviewCaseIndex]!;
        draft.review_cases[existingReviewCaseIndex] = {
          ...reviewCase,
          status: action as ReviewCaseStatus,
          assignedReviewerId: session.uid,
          assignedReviewerName: session.name,
          latestActionAt: now,
          updatedAt: now,
          comments: payload.reviewNotes
            ? [
                ...reviewCase.comments,
                {
                  id: createId("review-comment"),
                  actorId: session.uid,
                  actorName: session.name,
                  actorRole: session.role,
                  message: payload.reviewNotes,
                  createdAt: now
                }
              ]
            : reviewCase.comments,
          timeline: [
            ...reviewCase.timeline,
            {
              id: createId("review-event"),
              type:
                action === "revisit_requested"
                  ? "revisit_requested"
                  : action === "approved" || action === "rejected"
                    ? "resolved"
                    : "status_changed",
              actorId: session.uid,
              actorName: session.name,
              actorRole: session.role,
              createdAt: now,
              detail: payload.reviewNotes ?? `Review case marked as ${action.replaceAll("_", " ")}.`
            }
          ],
          revisitTask:
            action === "revisit_requested"
              ? {
                  id: reviewCase.revisitTask?.id ?? createId("revisit"),
                  submissionId: current.submissionId,
                  reviewCaseId,
                  enumeratorId: current.enumeratorId,
                  reasons: payload.revisitReasons ?? ["missing_fields"],
                  status: "open",
                  requestedAt: now,
                  requestedBy: session.uid,
                  requestedByName: session.name,
                  notes: payload.reviewNotes
                }
              : reviewCase.revisitTask
                ? {
                    ...reviewCase.revisitTask,
                    status: action === "approved" ? "completed" : reviewCase.revisitTask.status
                  }
                : undefined
        };
      }

      draft.audit_logs.push(
        buildAuditLog(
          session,
          `${action}_submission_review`,
          "submission",
          payload.submissionId,
          current.scope,
          { reviewStatus: action }
        )
      );

      return { ok: true };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const submissionRef = db.collection("submissions").doc(payload.submissionId);
  const snapshot = await submissionRef.get();
  if (!snapshot.exists) {
    throw new Error("Submission not found.");
  }

  const submission = snapshot.data() as HouseholdSubmission;
  if (!canAccessSubmission(session, submission)) {
    throw new Error("This submission is outside your assigned scope.");
  }

  const state = nextSubmissionState(submission);
  const reviewCaseId = resolveReviewCaseId(submission);
  const now = new Date().toISOString();

  await submissionRef.set(
    {
      reviewCaseId,
      validationStatus: state.validationStatus,
      syncStatus: state.syncStatus,
      reviewStatus: state.reviewStatus,
      reviewNotes: payload.reviewNotes ?? null,
      reviewedBy: session.uid,
      reviewedByName: session.name,
      reviewedAt: now,
      validationMessage: state.validationMessage,
      updatedAt: now
    },
    { merge: true }
  );

  const reviewCaseRef = db.collection("review_cases").doc(reviewCaseId);
  const reviewCaseSnapshot = await reviewCaseRef.get();
  if (reviewCaseSnapshot.exists) {
    const reviewCase = reviewCaseSnapshot.data() as ReviewCase;
    await reviewCaseRef.set(
      {
        status: action,
        assignedReviewerId: session.uid,
        assignedReviewerName: session.name,
        latestActionAt: now,
        updatedAt: now,
        comments: payload.reviewNotes
          ? [
              ...(reviewCase.comments ?? []),
              {
                id: createId("review-comment"),
                actorId: session.uid,
                actorName: session.name,
                actorRole: session.role,
                message: payload.reviewNotes,
                createdAt: now
              }
            ]
          : reviewCase.comments ?? [],
        timeline: [
          ...(reviewCase.timeline ?? []),
          {
            id: createId("review-event"),
            type:
              action === "revisit_requested"
                ? "revisit_requested"
                : action === "approved" || action === "rejected"
                  ? "resolved"
                  : "status_changed",
            actorId: session.uid,
            actorName: session.name,
            actorRole: session.role,
            createdAt: now,
            detail: payload.reviewNotes ?? `Review case marked as ${action.replaceAll("_", " ")}.`
          }
        ],
        revisitTask:
          action === "revisit_requested"
            ? {
                id: reviewCase.revisitTask?.id ?? createId("revisit"),
                submissionId: submission.submissionId,
                reviewCaseId,
                enumeratorId: submission.enumeratorId,
                reasons: payload.revisitReasons ?? ["missing_fields"],
                status: "open",
                requestedAt: now,
                requestedBy: session.uid,
                requestedByName: session.name,
                notes: payload.reviewNotes
              }
            : reviewCase.revisitTask
              ? {
                  ...reviewCase.revisitTask,
                  status: action === "approved" ? "completed" : reviewCase.revisitTask.status
                }
              : null
      },
      { merge: true }
    );
  }

  await appendLiveAuditLog(
    session,
    `${action}_submission_review`,
    "submission",
    payload.submissionId,
    submission.scope,
    { reviewStatus: action }
  );

  return { ok: true };
}

export async function createManagedExport(
  payload: {
    format: ExportFormat;
    packType?:
      | "district_summary"
      | "enumerator_productivity"
      | "anomaly_report"
      | "pending_review"
      | "revisit_backlog"
      | "coverage_completion";
    projectId?: string;
    filters?: {
      status?: string;
      enumeratorId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  },
  session: AuthSession
) {
  assertSupervisorOrAdmin(session);

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const filtered = filterExportSubmissions(draft.submissions, session, payload);
      const exportId = createId("export");
      draft.exports.push({
        id: exportId,
        projectId: payload.projectId,
        projectType: filtered[0]?.projectType,
        requesterId: session.uid,
        requesterName: session.name,
        scope: session.role === "admin" ? [{ district: "All Districts", block: "All Blocks" }] : session.scopes,
        format: payload.format,
        packType: payload.packType,
        status: "completed",
        createdAt: new Date().toISOString(),
        filters: {
          status: payload.filters?.status as ExportRequest["filters"]["status"],
          enumeratorId: payload.filters?.enumeratorId,
          dateFrom: payload.filters?.dateFrom,
          dateTo: payload.filters?.dateTo
        }
      });
      draft.audit_logs.push(
        buildAuditLog(session, "export_generated", "export", exportId, undefined, {
          format: payload.format,
          recordCount: filtered.length
        })
      );

      return {
        exportId,
        rows: buildExportRows(filtered)
      };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const snapshot = await db.collection("submissions").get();
  const submissions = snapshot.docs.map((doc) => doc.data() as HouseholdSubmission);
  const filtered = filterExportSubmissions(submissions, session, payload);
  const exportId = createId("export");

  await db.collection("exports").doc(exportId).set({
    id: exportId,
    projectId: payload.projectId ?? null,
    projectType: filtered[0]?.projectType ?? null,
    requesterId: session.uid,
    requesterName: session.name,
    scope: session.role === "admin" ? [{ district: "All Districts", block: "All Blocks" }] : session.scopes,
    format: payload.format,
    packType: payload.packType ?? null,
    status: "completed",
    createdAt: new Date().toISOString(),
    filters: {
      status: payload.filters?.status as ExportRequest["filters"]["status"],
      enumeratorId: payload.filters?.enumeratorId,
      dateFrom: payload.filters?.dateFrom,
      dateTo: payload.filters?.dateTo
    }
  });

  await appendLiveAuditLog(session, "export_generated", "export", exportId, undefined, {
    format: payload.format,
    recordCount: filtered.length
  });

  return {
    exportId,
    rows: buildExportRows(filtered)
  };
}

export async function ingestManagedSubmission(
  payload: { submission: HouseholdSubmission },
  session: AuthSession
) {
  if (session.role !== "employee" && session.role !== "admin") {
    throw new Error("Only enumerators can sync household submissions.");
  }

  const submittedAt = new Date().toISOString();

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const risk = evaluateHouseholdRisk(payload.submission, draft.submissions);
      const revisitSync =
        Boolean(payload.submission.revisitOfSubmissionId) || Boolean(payload.submission.reviewCaseId);
      const outcome = revisitSync
        ? {
            validationStatus: "flagged" as SubmissionValidationStatus,
            reviewStatus: "under_review" as SubmissionReviewStatus,
            syncStatus: "flagged" as SubmissionSyncStatus,
            validationMessage: buildSubmissionConflictMessage("under_review")
          }
        : deriveSubmissionStatuses({
            visitOutcome: payload.submission.visitOutcome,
            riskLevel: risk.riskLevel,
            hasDuplicates: risk.duplicateCandidates.some(
              (candidate) => candidate.confidence === "high" || candidate.confidence === "medium"
            )
          });
      const reviewCaseId =
        outcome.reviewStatus === "not_required"
          ? undefined
          : resolveReviewCaseId(payload.submission);
      const syncedSubmission: HouseholdSubmission = {
        ...payload.submission,
        reviewCaseId,
        syncStatus: outcome.syncStatus,
        validationStatus: outcome.validationStatus,
        reviewStatus: outcome.reviewStatus,
        validationMessage: outcome.validationMessage,
        flags: Array.from(
          new Set([
            ...(payload.submission.flags ?? []),
            ...risk.riskSignals,
            ...risk.duplicateCandidates.flatMap((candidate) => candidate.reasons)
          ])
        ),
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        riskSignals: risk.riskSignals,
        updatedAt: submittedAt
      };
      const index = draft.submissions.findIndex(
        (entry) => entry.submissionId === syncedSubmission.submissionId
      );
      if (index >= 0) {
        draft.submissions[index] = syncedSubmission;
      } else {
        draft.submissions.push(syncedSubmission);
      }

      if (reviewCaseId) {
        const reviewCaseIndex = draft.review_cases.findIndex(
          (entry) =>
            entry.id === reviewCaseId ||
            entry.currentSubmissionId === payload.submission.revisitOfSubmissionId
        );
        const nextReviewCase = buildReviewCase({
          submissionId: payload.submission.revisitOfSubmissionId ?? syncedSubmission.submissionId,
          currentSubmissionId: syncedSubmission.submissionId,
          projectId: syncedSubmission.projectId,
          scope: syncedSubmission.scope,
          enumeratorId: syncedSubmission.enumeratorId,
          householdId: syncedSubmission.householdId,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          riskSignals: risk.riskSignals,
          duplicateCandidates: risk.duplicateCandidates,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role === "employee" ? "enumerator" : "admin",
          notes: syncedSubmission.validationMessage
        });

        if (reviewCaseIndex >= 0) {
          const existingReviewCase = draft.review_cases[reviewCaseIndex]!;
          draft.review_cases[reviewCaseIndex] = {
            ...existingReviewCase,
            currentSubmissionId: syncedSubmission.submissionId,
            riskLevel: risk.riskLevel,
            riskScore: risk.riskScore,
            riskSignals: risk.riskSignals,
            duplicateCandidates: risk.duplicateCandidates,
            status:
              outcome.reviewStatus === "under_review"
                ? "under_review"
                : existingReviewCase.status,
            latestActionAt: submittedAt,
            updatedAt: submittedAt,
            timeline: [
              ...existingReviewCase.timeline,
              {
                id: createId("review-event"),
                type: "status_changed",
                actorId: session.uid,
                actorName: session.name,
                actorRole: session.role,
                createdAt: submittedAt,
                detail: revisitSync
                  ? "Enumerator submitted revisit evidence for supervisor review."
                  : syncedSubmission.validationMessage ?? "Submission flagged for review."
              }
            ]
          };
        } else {
          draft.review_cases.push(nextReviewCase);
        }
      }

      draft.alerts = [
        ...draft.alerts.filter((alert) => alert.relatedEntityId !== reviewCaseId),
        ...buildGeneratedAlerts({
          submissions: draft.submissions,
          missionSubmissions: draft.mission_submissions,
          reviewCases: draft.review_cases,
          assignments: draft.assignments
        })
      ];
      draft.audit_logs.push(
        buildAuditLog(session, "synced_submission", "submission", syncedSubmission.submissionId, syncedSubmission.scope, {
          validationStatus: syncedSubmission.validationStatus
        })
      );
      return {
        status: syncedSubmission.syncStatus,
        message: syncedSubmission.validationMessage ?? "Submission synced."
      };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const existingSnapshot = await db
    .collection("submissions")
    .where("projectId", "==", payload.submission.projectId)
    .get();
  const existing = existingSnapshot.docs.map((doc) => doc.data() as HouseholdSubmission);
  const risk = evaluateHouseholdRisk(payload.submission, existing);
  const revisitSync =
    Boolean(payload.submission.revisitOfSubmissionId) || Boolean(payload.submission.reviewCaseId);
  const outcome = revisitSync
    ? {
        validationStatus: "flagged" as SubmissionValidationStatus,
        reviewStatus: "under_review" as SubmissionReviewStatus,
        syncStatus: "flagged" as SubmissionSyncStatus,
        validationMessage: buildSubmissionConflictMessage("under_review")
      }
    : deriveSubmissionStatuses({
        visitOutcome: payload.submission.visitOutcome,
        riskLevel: risk.riskLevel,
        hasDuplicates: risk.duplicateCandidates.some(
          (candidate) => candidate.confidence === "high" || candidate.confidence === "medium"
        )
      });
  const reviewCaseId =
    outcome.reviewStatus === "not_required"
      ? undefined
      : resolveReviewCaseId(payload.submission);
  const syncedSubmission: HouseholdSubmission = {
    ...payload.submission,
    reviewCaseId,
    syncStatus: outcome.syncStatus,
    validationStatus: outcome.validationStatus,
    reviewStatus: outcome.reviewStatus,
    validationMessage: outcome.validationMessage,
    flags: Array.from(
      new Set([
        ...(payload.submission.flags ?? []),
        ...risk.riskSignals,
        ...risk.duplicateCandidates.flatMap((candidate) => candidate.reasons)
      ])
    ),
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    riskSignals: risk.riskSignals,
    updatedAt: submittedAt
  };

  await db.collection("submissions").doc(syncedSubmission.submissionId).set(syncedSubmission);

  if (reviewCaseId) {
    const reviewCaseRef = db.collection("review_cases").doc(reviewCaseId);
    const reviewCaseSnapshot = await reviewCaseRef.get();
    if (reviewCaseSnapshot.exists) {
      const current = reviewCaseSnapshot.data() as ReviewCase;
      await reviewCaseRef.set(
        {
          currentSubmissionId: syncedSubmission.submissionId,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          riskSignals: risk.riskSignals,
          duplicateCandidates: risk.duplicateCandidates,
          status: revisitSync ? "under_review" : current.status,
          latestActionAt: submittedAt,
          updatedAt: submittedAt,
          timeline: [
            ...(current.timeline ?? []),
            {
              id: createId("review-event"),
              type: "status_changed",
              actorId: session.uid,
              actorName: session.name,
              actorRole: session.role,
              createdAt: submittedAt,
              detail: revisitSync
                ? "Enumerator submitted revisit evidence for supervisor review."
                : syncedSubmission.validationMessage ?? "Submission flagged for review."
            }
          ]
        },
        { merge: true }
      );
    } else {
      await reviewCaseRef.set(
        buildReviewCase({
          submissionId: payload.submission.revisitOfSubmissionId ?? syncedSubmission.submissionId,
          currentSubmissionId: syncedSubmission.submissionId,
          projectId: syncedSubmission.projectId,
          scope: syncedSubmission.scope,
          enumeratorId: syncedSubmission.enumeratorId,
          householdId: syncedSubmission.householdId,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          riskSignals: risk.riskSignals,
          duplicateCandidates: risk.duplicateCandidates,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role === "employee" ? "enumerator" : "admin",
          notes: syncedSubmission.validationMessage
        })
      );
    }
  }

  const [liveSubmissionsSnapshot, liveMissionSnapshot, liveAssignmentsSnapshot, liveReviewCasesSnapshot] =
    await Promise.all([
      db.collection("submissions").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("mission_submissions").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("assignments").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("review_cases").where("projectId", "==", payload.submission.projectId).get()
    ]);
  const generatedAlerts = buildGeneratedAlerts({
    submissions: liveSubmissionsSnapshot.docs.map((doc) => doc.data() as HouseholdSubmission),
    missionSubmissions: liveMissionSnapshot.docs.map((doc) => doc.data() as MissionSubmission),
    reviewCases: liveReviewCasesSnapshot.docs.map((doc) => doc.data() as ReviewCase),
    assignments: liveAssignmentsSnapshot.docs.map((doc) => doc.data() as Assignment)
  });
  const alertBatch = db.batch();
  generatedAlerts.forEach((alert) => {
    alertBatch.set(db.collection("alerts").doc(alert.id), alert, { merge: true });
  });
  await alertBatch.commit();

  await appendLiveAuditLog(
    session,
    "synced_submission",
    "submission",
    syncedSubmission.submissionId,
    syncedSubmission.scope,
    { validationStatus: syncedSubmission.validationStatus }
  );

  return {
    status: syncedSubmission.syncStatus,
    message: syncedSubmission.validationMessage ?? "Submission synced."
  };
}

export async function ingestManagedMissionSubmission(
  payload: { submission: MissionSubmission; proofFile?: File | null },
  session: AuthSession
) {
  if (session.role !== "employee" && session.role !== "admin") {
    throw new Error("Only enumerators can sync mission submissions.");
  }

  const synchronizedAt = new Date().toISOString();

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const risk = evaluateMissionRisk(payload.submission, draft.mission_submissions);
      const outcome = deriveSubmissionStatuses({
        visitOutcome: payload.submission.visitOutcome,
        riskLevel: risk.riskLevel,
        hasDuplicates: risk.duplicateCandidates.some(
          (candidate) => candidate.confidence === "high" || candidate.confidence === "medium"
        )
      });
      const reviewCaseId =
        outcome.reviewStatus === "not_required"
          ? undefined
          : resolveReviewCaseId(payload.submission);
      const syncedSubmission: MissionSubmission = {
        ...payload.submission,
        reviewCaseId,
        syncStatus: outcome.syncStatus,
        validationStatus: outcome.validationStatus,
        validationMessage: outcome.validationMessage,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        riskSignals: risk.riskSignals,
        anomalyFlags: Array.from(
          new Set([
            ...payload.submission.anomalyFlags,
            ...risk.riskSignals,
            ...risk.duplicateCandidates.flatMap((candidate) => candidate.reasons)
          ])
        ),
        evidence: {
          ...payload.submission.evidence,
          storagePath:
            payload.submission.evidence.storagePath ??
            `review-safe://missions/${payload.submission.assignmentId}/${payload.submission.submissionId}-${sanitizeStorageName(payload.submission.evidence.fileName)}`,
          downloadUrl:
            payload.submission.evidence.downloadUrl ??
            `review-safe://downloads/${payload.submission.submissionId}`,
          capturedAt: synchronizedAt
        },
        updatedAt: synchronizedAt
      };

      const submissionIndex = draft.mission_submissions.findIndex(
        (entry) => entry.submissionId === syncedSubmission.submissionId
      );
      if (submissionIndex >= 0) {
        draft.mission_submissions[submissionIndex] = syncedSubmission;
      } else {
        draft.mission_submissions.push(syncedSubmission);
      }

      if (reviewCaseId) {
        const reviewCaseIndex = draft.review_cases.findIndex((entry) => entry.id === reviewCaseId);
        const nextReviewCase = buildReviewCase({
          submissionId: syncedSubmission.submissionId,
          currentSubmissionId: syncedSubmission.submissionId,
          projectId: syncedSubmission.projectId,
          scope: syncedSubmission.scope,
          enumeratorId: syncedSubmission.enumeratorId,
          missionAssignmentId: syncedSubmission.assignmentId,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          riskSignals: risk.riskSignals,
          duplicateCandidates: risk.duplicateCandidates,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role === "employee" ? "enumerator" : "admin",
          notes: syncedSubmission.validationMessage
        });
        if (reviewCaseIndex >= 0) {
          draft.review_cases[reviewCaseIndex] = {
            ...draft.review_cases[reviewCaseIndex]!,
            currentSubmissionId: syncedSubmission.submissionId,
            latestActionAt: synchronizedAt,
            updatedAt: synchronizedAt,
            riskLevel: risk.riskLevel,
            riskScore: risk.riskScore,
            riskSignals: risk.riskSignals,
            duplicateCandidates: risk.duplicateCandidates
          };
        } else {
          draft.review_cases.push(nextReviewCase);
        }
      }

      draft.assignments = draft.assignments.map((assignment) =>
        assignment.id === syncedSubmission.assignmentId
          ? {
              ...assignment,
              activationStatus: "completed",
              completedAt: synchronizedAt,
              progress: {
                requiredResponses:
                  assignment.progress?.requiredResponses ??
                  Object.keys(syncedSubmission.answers).length,
                completedResponses: Object.keys(syncedSubmission.answers).length
              }
            }
          : assignment
      );

      draft.alerts = [
        ...draft.alerts.filter((alert) => alert.projectId !== syncedSubmission.projectId),
        ...buildGeneratedAlerts({
          submissions: draft.submissions,
          missionSubmissions: draft.mission_submissions,
          reviewCases: draft.review_cases,
          assignments: draft.assignments
        })
      ];

      draft.audit_logs.push(
        buildAuditLog(
          session,
          "synced_mission_submission",
          "mission_submission",
          syncedSubmission.submissionId,
          syncedSubmission.scope,
          { assignmentId: syncedSubmission.assignmentId }
        )
      );

      return {
        status: syncedSubmission.syncStatus,
        message: syncedSubmission.validationMessage ?? "Mission synced."
      };
    });
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  let evidence = payload.submission.evidence;
  const storage = getAdminStorage();
  if (payload.proofFile && storage) {
    const bucket = storage.bucket();
    const storagePath = `missions/${payload.submission.enumeratorId}/${payload.submission.assignmentId}/${payload.submission.submissionId}-${sanitizeStorageName(payload.proofFile.name || payload.submission.evidence.fileName)}`;
    const fileBuffer = Buffer.from(await payload.proofFile.arrayBuffer());
    await bucket.file(storagePath).save(fileBuffer, {
      metadata: {
        contentType: payload.proofFile.type || payload.submission.evidence.mimeType
      }
    });
    evidence = {
      ...evidence,
      storagePath,
      downloadUrl: evidence.downloadUrl ?? `gs://${bucket.name}/${storagePath}`,
      capturedAt: synchronizedAt
    };
  }

  const existingMissionSnapshot = await db
    .collection("mission_submissions")
    .where("projectId", "==", payload.submission.projectId)
    .get();
  const existingMissionSubmissions = existingMissionSnapshot.docs.map(
    (doc) => doc.data() as MissionSubmission
  );
  const missionRisk = evaluateMissionRisk(payload.submission, existingMissionSubmissions);
  const missionOutcome = deriveSubmissionStatuses({
    visitOutcome: payload.submission.visitOutcome,
    riskLevel: missionRisk.riskLevel,
    hasDuplicates: missionRisk.duplicateCandidates.some(
      (candidate) => candidate.confidence === "high" || candidate.confidence === "medium"
    )
  });

  const syncedSubmission: MissionSubmission = {
    ...payload.submission,
    reviewCaseId:
      missionOutcome.reviewStatus === "not_required"
        ? undefined
        : resolveReviewCaseId(payload.submission),
    syncStatus: missionOutcome.syncStatus,
    validationStatus: missionOutcome.validationStatus,
    validationMessage: missionOutcome.validationMessage,
    riskScore: missionRisk.riskScore,
    riskLevel: missionRisk.riskLevel,
    riskSignals: missionRisk.riskSignals,
    anomalyFlags: Array.from(
      new Set([
        ...payload.submission.anomalyFlags,
        ...missionRisk.riskSignals,
        ...missionRisk.duplicateCandidates.flatMap((candidate) => candidate.reasons)
      ])
    ),
    evidence,
    updatedAt: synchronizedAt
  };

  await db
    .collection("mission_submissions")
    .doc(syncedSubmission.submissionId)
    .set(syncedSubmission);
  await db.collection("assignments").doc(syncedSubmission.assignmentId).set(
    {
      activationStatus: "completed",
      completedAt: synchronizedAt,
      progress: {
        requiredResponses:
          payload.submission.answers ? Object.keys(payload.submission.answers).length : 0,
        completedResponses:
          payload.submission.answers ? Object.keys(payload.submission.answers).length : 0
      }
    },
    { merge: true }
  );

  if (syncedSubmission.reviewCaseId) {
    await db.collection("review_cases").doc(syncedSubmission.reviewCaseId).set(
      buildReviewCase({
        submissionId: syncedSubmission.submissionId,
        currentSubmissionId: syncedSubmission.submissionId,
        projectId: syncedSubmission.projectId,
        scope: syncedSubmission.scope,
        enumeratorId: syncedSubmission.enumeratorId,
        missionAssignmentId: syncedSubmission.assignmentId,
        riskLevel: syncedSubmission.riskLevel ?? "low",
        riskScore: syncedSubmission.riskScore ?? 0,
        riskSignals: syncedSubmission.riskSignals ?? [],
        duplicateCandidates: [],
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role === "employee" ? "enumerator" : "admin",
        notes: syncedSubmission.validationMessage
      }),
      { merge: true }
    );
  }

  const [liveSubmissionsSnapshot, liveMissionSnapshot, liveAssignmentsSnapshot, liveReviewCasesSnapshot] =
    await Promise.all([
      db.collection("submissions").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("mission_submissions").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("assignments").where("projectId", "==", payload.submission.projectId).get(),
      db.collection("review_cases").where("projectId", "==", payload.submission.projectId).get()
    ]);
  const generatedAlerts = buildGeneratedAlerts({
    submissions: liveSubmissionsSnapshot.docs.map((doc) => doc.data() as HouseholdSubmission),
    missionSubmissions: liveMissionSnapshot.docs.map((doc) => doc.data() as MissionSubmission),
    reviewCases: liveReviewCasesSnapshot.docs.map((doc) => doc.data() as ReviewCase),
    assignments: liveAssignmentsSnapshot.docs.map((doc) => doc.data() as Assignment)
  });
  const alertBatch = db.batch();
  generatedAlerts.forEach((alert) => {
    alertBatch.set(db.collection("alerts").doc(alert.id), alert, { merge: true });
  });
  await alertBatch.commit();

  await appendLiveAuditLog(
    session,
    "synced_mission_submission",
    "mission_submission",
    syncedSubmission.submissionId,
    syncedSubmission.scope,
    { assignmentId: syncedSubmission.assignmentId }
  );

  return {
    status: syncedSubmission.syncStatus,
    message: syncedSubmission.validationMessage ?? "Mission synced."
  };
}

export async function readManagedRuntimeStore() {
  return readReviewStore();
}
