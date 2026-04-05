import "server-only";

import { Buffer } from "node:buffer";

import { getAdminAuth, getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { sanitizeStorageName } from "@/lib/missions/utils";
import { mutateReviewStore, readReviewStore } from "@/lib/review-store/server";
import { getServerRuntimeMode } from "@/lib/server/runtime";
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
  if (!["supervisor", "admin"].includes(session.role)) {
    throw new Error("Supervisor or admin access is required.");
  }
}

function canAccessSubmission(session: AuthSession, submission: HouseholdSubmission) {
  if (session.role === "admin") {
    return true;
  }

  if (session.role === "enumerator") {
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

function determineSubmissionOutcome(
  submission: HouseholdSubmission,
  existing: HouseholdSubmission[]
) {
  const duplicate = existing.some(
    (candidate) =>
      candidate.submissionId !== submission.submissionId &&
      candidate.projectId === submission.projectId &&
      (candidate.dedupeKey === submission.dedupeKey ||
        candidate.householdId === submission.householdId)
  );

  if (duplicate) {
    return {
      syncStatus: "flagged" as SubmissionSyncStatus,
      validationStatus: "flagged" as SubmissionValidationStatus,
      reviewStatus: "pending_review" as SubmissionReviewStatus,
      validationMessage: "Possible duplicate household in the same project scope.",
      flags: Array.from(new Set([...(submission.flags ?? []), "duplicate_household"]))
    };
  }

  return {
    syncStatus: "synced" as SubmissionSyncStatus,
    validationStatus: "approved" as SubmissionValidationStatus,
    reviewStatus: "not_required" as SubmissionReviewStatus,
    validationMessage: "Submission synced successfully.",
    flags: submission.flags ?? []
  };
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
          enumeratorId: payload.role === "enumerator" ? uid : undefined,
          assigneeUid: payload.role === "enumerator" ? uid : undefined,
          supervisorId: payload.role === "supervisor" ? uid : undefined,
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
        enumeratorId: payload.role === "enumerator" ? uid : null,
        assigneeUid: payload.role === "enumerator" ? uid : null,
        supervisorId: payload.role === "supervisor" ? uid : null,
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
    action: "resolved" | "escalated";
    reviewNotes?: string;
  },
  session: AuthSession
) {
  assertSupervisorOrAdmin(session);
  const resolved = payload.action === "resolved";

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

      draft.submissions[index] = {
        ...current,
        validationStatus: resolved ? "approved" : current.validationStatus,
        syncStatus: resolved ? "synced" : "flagged",
        reviewStatus: resolved ? "resolved" : "escalated",
        reviewNotes: payload.reviewNotes,
        reviewedBy: session.uid,
        reviewedByName: session.name,
        reviewedAt: new Date().toISOString(),
        validationMessage: resolved
          ? "Supervisor resolved the validation issue."
          : "Escalated to admin for further review.",
        updatedAt: new Date().toISOString()
      };

      draft.audit_logs.push(
        buildAuditLog(
          session,
          resolved ? "resolved_submission_review" : "escalated_submission_review",
          "submission",
          payload.submissionId,
          current.scope,
          { reviewStatus: resolved ? "resolved" : "escalated" }
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

  await submissionRef.set(
    {
      validationStatus: resolved ? "approved" : submission.validationStatus,
      syncStatus: resolved ? "synced" : "flagged",
      reviewStatus: resolved ? "resolved" : "escalated",
      reviewNotes: payload.reviewNotes ?? null,
      reviewedBy: session.uid,
      reviewedByName: session.name,
      reviewedAt: new Date().toISOString(),
      validationMessage: resolved
        ? "Supervisor resolved the validation issue."
        : "Escalated to admin for further review.",
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  await appendLiveAuditLog(
    session,
    resolved ? "resolved_submission_review" : "escalated_submission_review",
    "submission",
    payload.submissionId,
    submission.scope,
    { reviewStatus: resolved ? "resolved" : "escalated" }
  );

  return { ok: true };
}

export async function createManagedExport(
  payload: {
    format: ExportFormat;
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
  if (session.role !== "enumerator" && session.role !== "admin") {
    throw new Error("Only enumerators can sync household submissions.");
  }

  const submittedAt = new Date().toISOString();

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const outcome = determineSubmissionOutcome(payload.submission, draft.submissions);
      const syncedSubmission: HouseholdSubmission = {
        ...payload.submission,
        syncStatus: outcome.syncStatus,
        validationStatus: outcome.validationStatus,
        reviewStatus: outcome.reviewStatus,
        validationMessage: outcome.validationMessage,
        flags: outcome.flags,
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
  const outcome = determineSubmissionOutcome(payload.submission, existing);
  const syncedSubmission: HouseholdSubmission = {
    ...payload.submission,
    syncStatus: outcome.syncStatus,
    validationStatus: outcome.validationStatus,
    reviewStatus: outcome.reviewStatus,
    validationMessage: outcome.validationMessage,
    flags: outcome.flags,
    updatedAt: submittedAt
  };

  await db.collection("submissions").doc(syncedSubmission.submissionId).set(syncedSubmission);
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
  if (session.role !== "enumerator" && session.role !== "admin") {
    throw new Error("Only enumerators can sync mission submissions.");
  }

  const synchronizedAt = new Date().toISOString();

  if (getServerRuntimeMode() === "review-safe") {
    return mutateReviewStore((draft) => {
      const syncedSubmission: MissionSubmission = {
        ...payload.submission,
        syncStatus: "synced",
        validationStatus: "approved",
        validationMessage: "Mission synced successfully.",
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

  const syncedSubmission: MissionSubmission = {
    ...payload.submission,
    syncStatus: "synced",
    validationStatus: "approved",
    validationMessage: "Mission synced successfully.",
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
