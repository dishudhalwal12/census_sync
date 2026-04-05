import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

initializeApp();

const db = getFirestore();
const auth = getAuth();

type Scope = { district: string; block: string; cluster?: string };
type UserRole = "enumerator" | "supervisor" | "admin";
type CoordinatePoint = { latitude: number; longitude: number };
type ProjectType =
  | "census"
  | "community_survey"
  | "campus_outreach"
  | "social_audit";
type MissionVerificationMode = "hard_lock";
type AssignmentActivationStatus = "sent" | "opened" | "in_progress" | "completed";
type TemplateField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "date" | "checkbox";
  kind?:
    | "text"
    | "textarea"
    | "number"
    | "single_select"
    | "multi_select"
    | "boolean"
    | "date"
    | "instruction";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
};
type TemplateSection = {
  id: string;
  title: string;
  description: string;
  fields: TemplateField[];
};
type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  objective?: string;
  type: ProjectType;
  status: string;
  activeTemplateVersionId?: string | null;
  targetSubmissions?: number;
  siteCenter?: CoordinatePoint;
  serviceRadiusMeters?: number;
  capacityLimit?: number;
  verificationMode?: MissionVerificationMode;
  scope: Scope[];
};
type TemplateRecord = {
  id: string;
  projectId: string;
  version: string;
  sections: TemplateSection[];
  status: string;
};
type AssignmentRecord = {
  id: string;
  projectId: string;
  projectType: ProjectType;
  templateVersionId?: string;
  enumeratorId?: string | null;
  assigneeUid?: string | null;
  supervisorId?: string | null;
  scope: Scope;
  label: string;
  shareCode?: string;
  activationStatus?: AssignmentActivationStatus;
  openedAt?: string;
  startedAt?: string;
  completedAt?: string;
  activeFrom: string;
  activeTo?: string;
  status: "active" | "paused" | "completed";
  progress?: {
    requiredResponses: number;
    completedResponses: number;
  };
};
type MissionGeoCheck = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
  distanceMeters: number;
  withinRange: boolean;
};
type MissionEvidence = {
  fileName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  downloadUrl?: string;
  storagePath?: string;
  fingerprint?: string;
};
type MissionSubmissionPayload = {
  submissionId: string;
  assignmentId: string;
  projectId: string;
  projectType: ProjectType;
  templateVersionId: string;
  enumeratorId: string;
  enumeratorName: string;
  answers: Record<string, unknown>;
  geoCheckAtStart: MissionGeoCheck;
  geoCheckAtSubmit: MissionGeoCheck;
  evidence: MissionEvidence;
  scope: Scope;
  syncStatus: string;
  validationStatus: string;
  validationMessage?: string;
  status: AssignmentActivationStatus;
  anomalyFlags: string[];
  dedupeKey: string;
  capturedAt: string;
  updatedAt: string;
  audit: {
    createdBy: string;
    createdAt: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
  };
};

function assertAuthenticated(uid?: string): asserts uid is string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
}

function assertAdmin(role?: string) {
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
}

function assertSupervisorOrAdmin(role?: string) {
  if (!role || !["supervisor", "admin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Supervisor or admin access is required."
    );
  }
}

function normalizeScopes(scopes: Scope[] | undefined) {
  return (scopes ?? []).filter((scope) => scope.district && scope.block);
}

function scopeAllowed(
  role: string | undefined,
  claims: Record<string, unknown> | undefined,
  submissionScope: Scope
) {
  if (role === "admin") {
    return true;
  }

  const districts = Array.isArray(claims?.districts)
    ? (claims?.districts as string[])
    : [];
  const blocks = Array.isArray(claims?.blocks) ? (claims?.blocks as string[]) : [];

  return (
    districts.includes("All Districts") ||
    blocks.includes("All Blocks") ||
    districts.includes(submissionScope.district) ||
    blocks.includes(submissionScope.block)
  );
}

function pickProjectType(value: unknown): ProjectType {
  return value === "community_survey" ||
    value === "campus_outreach" ||
    value === "social_audit"
    ? value
    : "census";
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function generateShareCode(name: string, suffix: string) {
  return `${slugify(name)}-${suffix.slice(0, 6).toLowerCase()}`;
}

function calculateDistanceMeters(from: CoordinatePoint, to: CoordinatePoint) {
  const earthRadius = 6371e3;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toIsoString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }

  return new Date().toISOString();
}

async function appendAuditLog(payload: {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  scope?: Scope;
  metadata?: Record<string, unknown>;
}) {
  await db.collection("audit_logs").add({
    ...payload,
    timestamp: FieldValue.serverTimestamp()
  });
}

async function applyUserClaims(
  uid: string,
  role: UserRole,
  scopes: Scope[],
  projectId?: string
) {
  await auth.setCustomUserClaims(uid, {
    role,
    projectId: projectId ?? null,
    districts: scopes.map((scope) => scope.district),
    blocks: scopes.map((scope) => scope.block)
  });
}

async function getProject(projectId?: string) {
  if (!projectId) {
    return null;
  }

  const snapshot = await db.collection("projects").doc(projectId).get();
  return snapshot.exists
    ? ({ id: snapshot.id, ...snapshot.data() } as ProjectRecord)
    : null;
}

async function getTemplate(templateId?: string) {
  if (!templateId) {
    return null;
  }

  const snapshot = await db.collection("template_versions").doc(templateId).get();
  return snapshot.exists
    ? ({ id: snapshot.id, ...snapshot.data() } as TemplateRecord)
    : null;
}

async function getAssignmentByShareCode(shareCode: string) {
  const snapshot = await db
    .collection("assignments")
    .where("shareCode", "==", shareCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0]!;
  return { id: doc.id, ...doc.data() } as AssignmentRecord;
}

async function getAssignmentById(assignmentId: string) {
  const snapshot = await db.collection("assignments").doc(assignmentId).get();
  return snapshot.exists
    ? ({ id: snapshot.id, ...snapshot.data() } as AssignmentRecord)
    : null;
}

async function getUserProfile(uid?: string) {
  if (!uid) {
    return null;
  }

  const snapshot = await db.collection("users").doc(uid).get();
  return snapshot.exists
    ? ({ uid: snapshot.id, ...snapshot.data() } as Record<string, unknown>)
    : null;
}

function assertMissionAssignee(uid: string, assignment: AssignmentRecord) {
  const assignedUid = assignment.assigneeUid ?? assignment.enumeratorId;
  if (!assignedUid || assignedUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "This mission link is assigned to another field worker."
    );
  }
}

function validateMissionAnswers(
  template: TemplateRecord,
  answers: Record<string, unknown>
) {
  const errors: string[] = [];

  template.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.kind === "instruction") {
        return;
      }

      const value = answers[field.key];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && !value.length);

      if (field.required && isEmpty) {
        errors.push(`${field.label} is required.`);
        return;
      }

      if (isEmpty) {
        return;
      }

      if ((field.kind === "number" || field.type === "number") && typeof value !== "number") {
        errors.push(`${field.label} must be numeric.`);
      }

      if (
        typeof value === "number" &&
        typeof field.validation?.min === "number" &&
        value < field.validation.min
      ) {
        errors.push(`${field.label} must be at least ${field.validation.min}.`);
      }

      if (
        typeof value === "number" &&
        typeof field.validation?.max === "number" &&
        value > field.validation.max
      ) {
        errors.push(`${field.label} must be ${field.validation.max} or less.`);
      }
    });
  });

  return errors;
}

async function detectMissionAnomalies(submission: MissionSubmissionPayload) {
  const anomalies: string[] = [];

  if (!submission.geoCheckAtSubmit.withinRange) {
    anomalies.push("geo_outside_radius");
  }

  if (
    submission.evidence.fingerprint &&
    (await db
      .collection("mission_submissions")
      .where("evidence.fingerprint", "==", submission.evidence.fingerprint)
      .limit(1)
      .get()).docs.length
  ) {
    anomalies.push("duplicate_proof_photo");
  }

  const recentByEnumerator = await db
    .collection("mission_submissions")
    .where("enumeratorId", "==", submission.enumeratorId)
    .limit(10)
    .get();

  const latest = recentByEnumerator.docs
    .map((doc) => doc.data() as MissionSubmissionPayload)
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];
  if (latest) {
    const elapsedMs =
      new Date(submission.capturedAt).getTime() - new Date(latest.capturedAt).getTime();
    const travelMeters = calculateDistanceMeters(
      {
        latitude: latest.geoCheckAtSubmit.latitude,
        longitude: latest.geoCheckAtSubmit.longitude
      },
      {
        latitude: submission.geoCheckAtSubmit.latitude,
        longitude: submission.geoCheckAtSubmit.longitude
      }
    );

    if (elapsedMs > 0 && travelMeters / (elapsedMs / 1000) > 35) {
      anomalies.push("implausible_travel_speed");
    }

    if (JSON.stringify(latest.answers) === JSON.stringify(submission.answers)) {
      anomalies.push("repeated_answer_pattern");
    }
  }

  return anomalies;
}

function validateSubmission(submission: Record<string, unknown>) {
  const members = Array.isArray(submission.members) ? submission.members : [];
  if (!submission.householdId || typeof submission.householdId !== "string") {
    throw new HttpsError("invalid-argument", "Household ID is required.");
  }
  if (!submission.headOfHousehold || typeof submission.headOfHousehold !== "string") {
    throw new HttpsError("invalid-argument", "Head of household is required.");
  }
  if (!submission.projectId || typeof submission.projectId !== "string") {
    throw new HttpsError("invalid-argument", "projectId is required.");
  }
  if (!submission.templateVersionId || typeof submission.templateVersionId !== "string") {
    throw new HttpsError("invalid-argument", "templateVersionId is required.");
  }
  if (!members.length) {
    throw new HttpsError("invalid-argument", "At least one household member is required.");
  }
  for (const member of members) {
    const age = Number((member as { age?: number }).age ?? -1);
    if (age < 0 || age > 120) {
      throw new HttpsError("invalid-argument", "Member age must be between 0 and 120.");
    }
  }
}

export const ensureUserProfile = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);

  const uid = request.auth!.uid;
  const payload = (request.data ?? {}) as {
    name?: string;
    email?: string;
  };

  const userRecord = await auth.getUser(uid);
  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  const existingData = existing.data() ?? {};
  const role = String(existingData.role ?? request.auth?.token.role ?? "enumerator") as UserRole;
  const scopes = normalizeScopes(existingData.scopes as Scope[] | undefined);
  const projectId =
    typeof existingData.projectId === "string" ? existingData.projectId : undefined;
  const assignedTemplateVersion =
    typeof existingData.assignedTemplateVersion === "string"
      ? existingData.assignedTemplateVersion
      : "template-unassigned";

  await userRef.set(
    {
      uid,
      name:
        payload.name?.trim() ||
        existingData.name ||
        userRecord.displayName ||
        userRecord.email?.split("@")[0] ||
        "Field User",
      email: payload.email ?? existingData.email ?? userRecord.email ?? "",
      role,
      status: existingData.status ?? "active",
      projectId: projectId ?? null,
      assignmentLabel: existingData.assignmentLabel ?? "Awaiting assignment",
      scopes,
      assignedTemplateVersion,
      lastLoginAt: new Date().toISOString(),
      createdAt: existingData.createdAt ?? new Date().toISOString()
    },
    { merge: true }
  );

  await applyUserClaims(uid, role, scopes, projectId);

  return {
    ok: true,
    role,
    status: existingData.status ?? "active",
    projectId: projectId ?? null
  };
});

export const ingestSubmission = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);

  const role = String(request.auth?.token.role ?? "enumerator");
  const submission = request.data?.submission as Record<string, unknown> | undefined;

  if (!submission) {
    throw new HttpsError("invalid-argument", "Submission payload is required.");
  }

  validateSubmission(submission);

  const scope = submission.scope as Scope;
  if (!scopeAllowed(role, request.auth?.token as Record<string, unknown>, scope)) {
    throw new HttpsError(
      "permission-denied",
      "Submission scope is outside the caller assignment."
    );
  }

  const submissionId = String(submission.submissionId ?? "");
  if (!submissionId) {
    throw new HttpsError("invalid-argument", "submissionId is required.");
  }

  const projectId = String(submission.projectId ?? "");
  const project = await getProject(projectId);
  if (!project) {
    throw new HttpsError("failed-precondition", "The selected project is not active.");
  }

  const docRef = db.collection("submissions").doc(submissionId);
  const existing = await docRef.get();
  if (existing.exists) {
    return {
      status: "synced",
      message: "Submission already exists. Idempotent sync acknowledged."
    };
  }

  const duplicateQuery = await db
    .collection("submissions")
    .where("projectId", "==", projectId)
    .where("householdId", "==", submission.householdId)
    .where("scope.block", "==", scope.block)
    .limit(1)
    .get();

  const validationStatus = duplicateQuery.empty ? "approved" : "flagged";
  const syncStatus = duplicateQuery.empty ? "synced" : "flagged";
  const flags = duplicateQuery.empty ? [] : ["duplicate_household"];
  const validationMessage = duplicateQuery.empty
    ? "Passed server-side validation."
    : "Possible duplicate household detected in the same block.";
  const reviewStatus = duplicateQuery.empty ? "not_required" : "pending_review";

  await docRef.set({
    ...submission,
    projectType: pickProjectType(submission.projectType ?? project.type),
    validationStatus,
    syncStatus,
    reviewStatus,
    flags,
    validationMessage,
    scopeKeys: [`${scope.district}::${scope.block}`],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: role,
    action: "submission_ingested",
    targetType: "submission",
    targetId: submissionId,
    scope,
    metadata: {
      validationStatus
    }
  });

  return {
    status: syncStatus,
    message: validationMessage
  };
});

export const adminCreateProject = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);
  assertAdmin(String(request.auth?.token.role ?? ""));

  const payload = request.data as {
    name: string;
    description?: string;
    type?: ProjectType;
    district: string;
    block: string;
    cluster?: string;
    targetSubmissions?: number;
  };

  if (!payload.name || !payload.district || !payload.block) {
    throw new HttpsError(
      "invalid-argument",
      "name, district, and block are required."
    );
  }

  const docRef = db.collection("projects").doc();
  await docRef.set({
    id: docRef.id,
    name: payload.name,
    slug: payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description:
      payload.description ??
      "Offline field survey workflow with assignment tracking, validation, and exports.",
    type: pickProjectType(payload.type),
    status: "active",
    activeTemplateVersionId: null,
    targetSubmissions: Number(payload.targetSubmissions ?? 0) || 0,
    scope: [
      {
        district: payload.district,
        block: payload.block,
        cluster: payload.cluster ?? null
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: "admin",
    action: "created_project",
    targetType: "project",
    targetId: docRef.id,
    scope: { district: payload.district, block: payload.block, cluster: payload.cluster },
    metadata: { type: pickProjectType(payload.type) }
  });

  return { id: docRef.id };
});

export const adminCreateMissionAssignment = onCall(
  { region: "asia-south1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    assertAdmin(String(request.auth?.token.role ?? ""));

    const payload = request.data as {
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
    };

    if (
      !payload.name ||
      !payload.district ||
      !payload.block ||
      !payload.assigneeUid ||
      !payload.siteCenter
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Mission name, assignee, district, block, and siteCenter are required."
      );
    }

    const assignee = await getUserProfile(payload.assigneeUid);
    if (!assignee) {
      throw new HttpsError("not-found", "Assigned enumerator could not be found.");
    }

    const projectRef = db.collection("projects").doc();
    const templateRef = db.collection("template_versions").doc();
    const assignmentRef = db.collection("assignments").doc();
    const shareCode = generateShareCode(payload.name, assignmentRef.id);
    const now = new Date().toISOString();
    const scope = {
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

    const batch = db.batch();
    batch.set(projectRef, {
      id: projectRef.id,
      name: payload.name,
      slug: slugify(payload.name),
      description:
        payload.description ??
        "Geofenced mission assignment with proof-of-visit validation.",
      objective: payload.objective ?? "Field verification mission",
      type: pickProjectType(payload.type),
      status: "active",
      activeTemplateVersionId: templateRef.id,
      targetSubmissions: Number(payload.capacityLimit ?? 0) || 0,
      siteCenter: payload.siteCenter,
      serviceRadiusMeters: Number(payload.serviceRadiusMeters ?? 1000) || 1000,
      capacityLimit: Number(payload.capacityLimit ?? 0) || 0,
      verificationMode: "hard_lock",
      scope: [scope],
      createdAt: now,
      updatedAt: now
    });
    batch.set(templateRef, {
      id: templateRef.id,
      projectId: projectRef.id,
      projectType: pickProjectType(payload.type),
      name: `${payload.name} Mission`,
      version: `${new Date().getFullYear()}.mission.1`,
      status: "active",
      sections: payload.sections,
      releaseNotes: "Mission template created from the guided mission builder.",
      publishedAt: now,
      createdAt: now
    });
    batch.set(assignmentRef, {
      id: assignmentRef.id,
      projectId: projectRef.id,
      projectType: pickProjectType(payload.type),
      templateVersionId: templateRef.id,
      enumeratorId: payload.assigneeUid,
      assigneeUid: payload.assigneeUid,
      supervisorId: null,
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

    await appendAuditLog({
      actorId: request.auth!.uid,
      actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
      actorRole: "admin",
      action: "mission_assignment_published",
      targetType: "assignment",
      targetId: assignmentRef.id,
      scope,
      metadata: {
        shareCode,
        assigneeUid: payload.assigneeUid
      }
    });

    return {
      projectId: projectRef.id,
      assignmentId: assignmentRef.id,
      templateId: templateRef.id,
      shareCode,
      sharePath: `/field/${shareCode}`
    };
  }
);

export const getAssignmentPackage = onCall(
  { region: "asia-south1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const payload = request.data as { shareCode: string };
    if (!payload.shareCode) {
      throw new HttpsError("invalid-argument", "shareCode is required.");
    }

    const assignment = await getAssignmentByShareCode(payload.shareCode);
    if (!assignment) {
      throw new HttpsError("not-found", "Mission assignment not found.");
    }

    assertMissionAssignee(request.auth!.uid, assignment);

    const project = await getProject(assignment.projectId);
    const template = await getTemplate(
      assignment.templateVersionId ?? project?.activeTemplateVersionId ?? undefined
    );
    const assignee = await getUserProfile(assignment.assigneeUid ?? assignment.enumeratorId ?? undefined);

    if (!project || !template) {
      throw new HttpsError(
        "failed-precondition",
        "Mission configuration is incomplete on the server."
      );
    }

    if (assignment.status !== "active" && assignment.status !== "completed") {
      throw new HttpsError("failed-precondition", "This mission assignment is not active.");
    }

    const nextStatus =
      assignment.activationStatus === "completed" ? "completed" : "in_progress";

    await db.collection("assignments").doc(assignment.id).set(
      {
        activationStatus: nextStatus,
        openedAt: assignment.openedAt ?? new Date().toISOString(),
        startedAt:
          nextStatus === "in_progress"
            ? assignment.startedAt ?? new Date().toISOString()
            : assignment.startedAt ?? null,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    await appendAuditLog({
      actorId: request.auth!.uid,
      actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
      actorRole: String(request.auth?.token.role ?? "enumerator"),
      action: "mission_assignment_opened",
      targetType: "assignment",
      targetId: assignment.id,
      scope: assignment.scope,
      metadata: {
        shareCode: payload.shareCode
      }
    });

    return {
      assignment: {
        ...assignment,
        activationStatus: nextStatus,
        openedAt: assignment.openedAt ?? new Date().toISOString(),
        startedAt:
          nextStatus === "in_progress"
            ? assignment.startedAt ?? new Date().toISOString()
            : assignment.startedAt
      },
      project,
      template,
      assignee: assignee
        ? {
            uid: String(assignee.uid ?? ""),
            name: String(assignee.name ?? ""),
            email: String(assignee.email ?? "")
          }
        : undefined,
      shareUrl: `/field/${payload.shareCode}`
    };
  }
);

export const ingestMissionSubmission = onCall(
  { region: "asia-south1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const submission = request.data?.submission as MissionSubmissionPayload | undefined;
    if (!submission) {
      throw new HttpsError("invalid-argument", "Mission submission payload is required.");
    }

    if (
      !submission.submissionId ||
      !submission.assignmentId ||
      !submission.projectId ||
      !submission.templateVersionId
    ) {
      throw new HttpsError(
        "invalid-argument",
        "submissionId, assignmentId, projectId, and templateVersionId are required."
      );
    }

    const assignment = await getAssignmentById(submission.assignmentId);
    if (!assignment) {
      throw new HttpsError("not-found", "Mission assignment not found.");
    }

    assertMissionAssignee(request.auth!.uid, assignment);

    if (submission.enumeratorId !== request.auth!.uid) {
      throw new HttpsError(
        "permission-denied",
        "Mission submissions must be uploaded by the assigned enumerator."
      );
    }

    const project = await getProject(submission.projectId);
    const template = await getTemplate(
      submission.templateVersionId ?? assignment.templateVersionId
    );
    if (!project || !template) {
      throw new HttpsError(
        "failed-precondition",
        "Mission project or template could not be resolved."
      );
    }

    if (assignment.projectId !== submission.projectId) {
      throw new HttpsError(
        "failed-precondition",
        "Mission assignment does not belong to the submitted project."
      );
    }

    if (assignment.status !== "active" && assignment.status !== "completed") {
      throw new HttpsError("failed-precondition", "Mission assignment is not active.");
    }

    if (!project.siteCenter) {
      throw new HttpsError(
        "failed-precondition",
        "Mission project does not have a configured site center."
      );
    }

    const validationErrors = validateMissionAnswers(template, submission.answers);
    if (validationErrors.length) {
      throw new HttpsError("invalid-argument", validationErrors[0]!);
    }

    if (!submission.evidence.storagePath || !submission.evidence.downloadUrl) {
      throw new HttpsError(
        "failed-precondition",
        "A stored proof photo is required before sync."
      );
    }

    const radius = Number(project.serviceRadiusMeters ?? 1000) || 1000;
    const startDistance = calculateDistanceMeters(project.siteCenter, {
      latitude: submission.geoCheckAtStart.latitude,
      longitude: submission.geoCheckAtStart.longitude
    });
    const submitDistance = calculateDistanceMeters(project.siteCenter, {
      latitude: submission.geoCheckAtSubmit.latitude,
      longitude: submission.geoCheckAtSubmit.longitude
    });

    if (startDistance > radius || submitDistance > radius) {
      await appendAuditLog({
        actorId: request.auth!.uid,
        actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
        actorRole: String(request.auth?.token.role ?? "enumerator"),
        action: "mission_submission_rejected",
        targetType: "assignment",
        targetId: submission.assignmentId,
        scope: assignment.scope,
        metadata: {
          reason: "outside_geofence",
          startDistance: Math.round(startDistance),
          submitDistance: Math.round(submitDistance)
        }
      });
      throw new HttpsError(
        "failed-precondition",
        "Mission was submitted outside the allowed radius."
      );
    }

    const existingDoc = await db
      .collection("mission_submissions")
      .doc(submission.submissionId)
      .get();
    if (existingDoc.exists) {
      return {
        status: "synced",
        message: "Mission submission already exists. Idempotent sync acknowledged."
      };
    }

    const assignmentSubmissions = await db
      .collection("mission_submissions")
      .where("assignmentId", "==", submission.assignmentId)
      .limit(1)
      .get();
    if (!assignmentSubmissions.empty) {
      return {
        status: "failed",
        message: "This mission assignment already has a completed submission."
      };
    }

    if (project.capacityLimit) {
      const projectSubmissions = await db
        .collection("mission_submissions")
        .where("projectId", "==", submission.projectId)
        .get();

      if (projectSubmissions.size >= Number(project.capacityLimit)) {
        return {
          status: "failed",
          message: "This mission project has already reached its capacity limit."
        };
      }
    }

    const normalizedSubmission: MissionSubmissionPayload = {
      ...submission,
      projectType: pickProjectType(submission.projectType ?? project.type),
      geoCheckAtStart: {
        ...submission.geoCheckAtStart,
        distanceMeters: Math.round(startDistance),
        withinRange: startDistance <= radius
      },
      geoCheckAtSubmit: {
        ...submission.geoCheckAtSubmit,
        distanceMeters: Math.round(submitDistance),
        withinRange: submitDistance <= radius
      }
    };
    const anomalyFlags = await detectMissionAnomalies(normalizedSubmission);
    const validationStatus = anomalyFlags.length ? "flagged" : "approved";
    const syncStatus = anomalyFlags.length ? "flagged" : "synced";
    const validationMessage = anomalyFlags.length
      ? "Mission synced with anomalies that need supervisor review."
      : "Mission proof and geofence validated successfully.";
    const requiredResponses = template.sections.reduce(
      (sum, section) =>
        sum +
        section.fields.filter(
          (field) => field.required && field.kind !== "instruction"
        ).length,
      0
    );
    const completedResponses = template.sections.reduce(
      (sum, section) =>
        sum +
        section.fields.filter((field) => {
          if (!field.required || field.kind === "instruction") {
            return false;
          }

          const value = submission.answers[field.key];
          return !(
            value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && !value.length)
          );
        }).length,
      0
    );

    await db.collection("mission_submissions").doc(submission.submissionId).set({
      ...normalizedSubmission,
      anomalyFlags,
      validationStatus,
      syncStatus,
      validationMessage,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await db.collection("assignments").doc(assignment.id).set(
      {
        status: "completed",
        activationStatus: "completed",
        completedAt: new Date().toISOString(),
        progress: {
          requiredResponses,
          completedResponses
        },
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    await appendAuditLog({
      actorId: request.auth!.uid,
      actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
      actorRole: String(request.auth?.token.role ?? "enumerator"),
      action:
        anomalyFlags.length > 0
          ? "mission_submission_flagged"
          : "mission_submission_ingested",
      targetType: "mission_submission",
      targetId: submission.submissionId,
      scope: assignment.scope,
      metadata: {
        validationStatus,
        anomalyFlags
      }
    });

    return {
      status: syncStatus,
      message: validationMessage
    };
  }
);

export const adminActivateTemplate = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);
  assertAdmin(String(request.auth?.token.role ?? ""));

  const payload = request.data as { templateId: string };
  if (!payload.templateId) {
    throw new HttpsError("invalid-argument", "templateId is required.");
  }

  const templateRef = db.collection("template_versions").doc(payload.templateId);
  const snapshot = await templateRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Template not found.");
  }

  const template = snapshot.data() as {
    projectId: string;
    version: string;
  };

  const relatedTemplates = await db
    .collection("template_versions")
    .where("projectId", "==", template.projectId)
    .get();

  const batch = db.batch();
  relatedTemplates.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: doc.id === payload.templateId ? "active" : "archived"
    });
  });

  const projectRef = db.collection("projects").doc(template.projectId);
  batch.set(
    projectRef,
    {
      activeTemplateVersionId: payload.templateId,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  await batch.commit();

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: "admin",
    action: "activated_template",
    targetType: "template",
    targetId: payload.templateId,
    metadata: { version: template.version }
  });

  return { ok: true };
});

export const adminUpsertUser = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);
  assertAdmin(String(request.auth?.token.role ?? ""));

  const payload = request.data as {
    uid?: string;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    projectId?: string;
    assignmentLabel?: string;
    targetCount?: number;
    scopes?: Scope[];
  };

  if (!payload.name || !payload.email || !payload.role) {
    throw new HttpsError("invalid-argument", "name, email, and role are required.");
  }

  const normalizedScopes = normalizeScopes(payload.scopes);
  const project = await getProject(payload.projectId);
  const assignedTemplateVersion =
    typeof project?.activeTemplateVersionId === "string"
      ? project.activeTemplateVersionId
      : "template-unassigned";

  let uid = payload.uid;
  if (!uid) {
    if (!payload.password || payload.password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "A password with at least 6 characters is required for new users."
      );
    }

    const user = await auth.createUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.name
    });
    uid = user.uid;
  } else {
    const updates: { displayName: string; password?: string } = {
      displayName: payload.name
    };
    if (payload.password) {
      updates.password = payload.password;
    }
    await auth.updateUser(uid, updates);
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
        (project ? `${project.name} / ${normalizedScopes[0]?.block ?? "Unassigned"}` : "Awaiting assignment"),
      scopes: normalizedScopes,
      assignedTemplateVersion,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    { merge: true }
  );

  await applyUserClaims(uid, payload.role, normalizedScopes, payload.projectId);

  if (payload.projectId && normalizedScopes.length && payload.role !== "admin") {
    const assignmentId = `${payload.projectId}-${uid}`;
    await db.collection("assignments").doc(assignmentId).set(
      {
        id: assignmentId,
        projectId: payload.projectId,
        projectType: pickProjectType(project?.type),
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

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: "admin",
    action: "upserted_user",
    targetType: "user",
    targetId: uid,
    scope: normalizedScopes[0],
    metadata: {
      role: payload.role,
      projectId: payload.projectId ?? null
    }
  });

  return { uid };
});

export const adminSetRoleAndAssignments = onCall(
  { region: "asia-south1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    assertAdmin(String(request.auth?.token.role ?? ""));

    const payload = request.data as {
      uid: string;
      role: UserRole;
      projectId?: string;
      scopes: Scope[];
    };

    if (!payload.uid || !payload.role) {
      throw new HttpsError("invalid-argument", "uid and role are required.");
    }

    const normalizedScopes = normalizeScopes(payload.scopes);

    await db.collection("users").doc(payload.uid).set(
      {
        role: payload.role,
        projectId: payload.projectId ?? null,
        scopes: normalizedScopes,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    await applyUserClaims(payload.uid, payload.role, normalizedScopes, payload.projectId);

    return { ok: true };
  }
);

export const reviewSubmission = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);

  const role = String(request.auth?.token.role ?? "");
  assertSupervisorOrAdmin(role);

  const payload = request.data as {
    submissionId: string;
    action: "resolved" | "escalated";
    reviewNotes?: string;
  };

  if (!payload.submissionId || !payload.action) {
    throw new HttpsError(
      "invalid-argument",
      "submissionId and action are required."
    );
  }

  const submissionRef = db.collection("submissions").doc(payload.submissionId);
  const snapshot = await submissionRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Submission not found.");
  }

  const submission = snapshot.data() as {
    scope: Scope;
    validationStatus: string;
    reviewStatus?: string;
  };

  if (
    role !== "admin" &&
    !scopeAllowed(role, request.auth?.token as Record<string, unknown>, submission.scope)
  ) {
    throw new HttpsError(
      "permission-denied",
      "This submission is outside your assigned scope."
    );
  }

  const resolved = payload.action === "resolved";
  await submissionRef.set(
    {
      validationStatus: resolved ? "approved" : submission.validationStatus,
      syncStatus: resolved ? "synced" : "flagged",
      reviewStatus: resolved ? "resolved" : "escalated",
      reviewNotes: payload.reviewNotes ?? null,
      reviewedBy: request.auth!.uid,
      reviewedByName: String(
        request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"
      ),
      reviewedAt: new Date().toISOString(),
      validationMessage: resolved
        ? "Supervisor resolved the validation issue."
        : "Escalated to admin for further review.",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: role,
    action: resolved ? "resolved_submission_review" : "escalated_submission_review",
    targetType: "submission",
    targetId: payload.submissionId,
    scope: submission.scope,
    metadata: {
      reviewStatus: resolved ? "resolved" : "escalated"
    }
  });

  return { ok: true };
});

export const generateExport = onCall({ region: "asia-south1" }, async (request) => {
  assertAuthenticated(request.auth?.uid);

  const role = String(request.auth?.token.role ?? "");
  assertSupervisorOrAdmin(role);

  const payload = request.data as {
    format: "csv" | "pdf";
    projectId?: string;
    filters?: {
      status?: string;
      enumeratorId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  };

  if (!payload.format) {
    throw new HttpsError("invalid-argument", "format is required.");
  }

  const snapshot = await db.collection("submissions").get();
  const submissions = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
  const scoped = submissions.filter((submission) => {
    const projectMatches =
      !payload.projectId || submission.projectId === payload.projectId;
    if (!projectMatches) {
      return false;
    }

    if (role === "admin") {
      return true;
    }

    return scopeAllowed(
      role,
      request.auth?.token as Record<string, unknown>,
      submission.scope as Scope
    );
  });

  const filtered = scoped.filter((submission) => {
    const status = payload.filters?.status;
    const enumeratorId = payload.filters?.enumeratorId;
    const dateFrom = payload.filters?.dateFrom;
    const dateTo = payload.filters?.dateTo;
    const capturedAt = toIsoString(submission.capturedAt ?? submission.updatedAt);

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

    if (dateFrom && capturedAt < dateFrom) {
      return false;
    }

    if (dateTo && capturedAt > dateTo) {
      return false;
    }

    return true;
  });

  const exportRef = db.collection("exports").doc();
  await exportRef.set({
    id: exportRef.id,
    projectId: payload.projectId ?? null,
    projectType: filtered[0]?.projectType ?? null,
    requesterId: request.auth!.uid,
    requesterName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    scope:
      role === "admin"
        ? [{ district: "All Districts", block: "All Blocks" }]
        : (request.auth?.token.districts as string[] | undefined)?.map((district) => ({
            district,
            block: "All Blocks"
          })) ?? [],
    format: payload.format,
    filters: payload.filters ?? {},
    status: "completed",
    recordCount: filtered.length,
    createdAt: new Date().toISOString(),
    downloadUrl: null
  });

  await appendAuditLog({
    actorId: request.auth!.uid,
    actorName: String(request.auth?.token.name ?? request.auth?.token.email ?? "Unknown"),
    actorRole: role,
    action: "export_generated",
    targetType: "export",
    targetId: exportRef.id,
    metadata: {
      format: payload.format,
      recordCount: filtered.length
    }
  });

  logger.info("Export request created", {
    exportId: exportRef.id,
    format: payload.format,
    count: filtered.length
  });

  return {
    exportId: exportRef.id,
    status: "completed",
    rows: filtered.map((submission) => ({
      householdId: String(submission.householdId ?? ""),
      headOfHousehold: String(submission.headOfHousehold ?? ""),
      district: String((submission.scope as Scope)?.district ?? ""),
      block: String((submission.scope as Scope)?.block ?? ""),
      members: Array.isArray(submission.members) ? submission.members.length : 0,
      syncStatus: String(submission.syncStatus ?? ""),
      validationStatus: String(submission.validationStatus ?? ""),
      reviewStatus: String(submission.reviewStatus ?? ""),
      capturedAt: toIsoString(submission.capturedAt ?? submission.updatedAt)
    }))
  };
});
