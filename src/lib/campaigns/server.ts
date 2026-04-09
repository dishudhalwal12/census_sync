import "server-only";

import { createHash } from "node:crypto";

import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";

import { generateCampaignDraft } from "@/lib/campaigns/ai";
import {
  campaignCreateSchema,
  campaignLinkCreateSchema,
  employeeCampaignResponseSchema,
  normalizeQuestionDrafts,
  publicCampaignResponseSchema,
  validateCampaignAnswers
} from "@/lib/campaigns/schemas";
import {
  buildTokenPreview,
  createCampaignLinkToken,
  hashCampaignToken
} from "@/lib/campaigns/tokens";
import { DEMO_ORG_ID } from "@/lib/data/campaign-mock";
import { env } from "@/lib/env";
import { getAdminAuth, getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { readReviewCollection, mutateReviewStore } from "@/lib/review-store/server";
import { getUserGeminiProviderConfig } from "@/lib/server/user-settings";
import type { ReviewCollectionName } from "@/lib/review-store/server";
import type { AuthSession } from "@/types/session";
import type {
  Scope,
  UserProfile,
  WorkspaceRole
} from "@/types/domain";
import type {
  Campaign,
  CampaignAnalyticsPayload,
  CampaignAssignment,
  CampaignFieldPackage,
  CampaignGeoPoint,
  CampaignLink,
  CampaignQuestion,
  CampaignQuestionBreakdown,
  CampaignRecentResponse,
  CampaignResponse,
  CampaignVersion,
  Organization,
  PublicCampaignPackage,
  ResponseGeoCheck,
  ResponsePhotoEvidence
} from "@/types/campaign";

function serializeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)])
    );
  }

  return value;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orgIdOf<T extends { orgId?: string }>(row: T) {
  return row.orgId ?? DEMO_ORG_ID;
}

function resolveScope(candidate?: {
  district?: string;
  block?: string;
  cluster?: string;
}) {
  if (!candidate?.district || !candidate.block) {
    return undefined;
  }

  return {
    district: candidate.district,
    block: candidate.block,
    cluster: candidate.cluster
  } satisfies Scope;
}

function scopeLabel(scope?: Scope) {
  if (!scope) {
    return "General field collection";
  }

  return [scope.district, scope.block, scope.cluster].filter(Boolean).join(" / ");
}

function assertAdmin(session: AuthSession) {
  if (session.role !== "admin") {
    throw new Error("Admin access is required.");
  }
}

async function readCollection<T>(name: ReviewCollectionName) {
  const db = getAdminDb();

  if (!db) {
    return readReviewCollection<T>(name);
  }

  const snapshot = await db.collection(name).get();
  return snapshot.docs.map((doc) =>
    serializeFirestoreValue({
      id: doc.id,
      ...doc.data()
    }) as T
  );
}

const readCampaignCollection = cache(async function readCampaignCollectionCached<T>(
  name: ReviewCollectionName
) {
  return readCollection<T>(name);
});

const readOrgCampaignCollection = cache(async function readOrgCampaignCollectionCached<
  T extends { orgId?: string }
>(name: ReviewCollectionName, orgId: string) {
  const db = getAdminDb();

  if (!db) {
    const values = await readReviewCollection<T>(name);
    return values.filter((value) => orgIdOf(value) === orgId);
  }

  const snapshot = await db.collection(name).where("orgId", "==", orgId).get();
  return snapshot.docs.map((doc) =>
    serializeFirestoreValue({
      id: doc.id,
      ...doc.data()
    }) as T
  );
});

async function upsertCollectionDocument<T extends { id: string }>(
  collection: string,
  value: T
) {
  const db = getAdminDb();

  if (!db) {
    return mutateReviewStore((draft) => {
      const key = collection as ReviewCollectionName;
      const current = draft[key] as unknown as Array<T>;
      const index = current.findIndex((entry) => entry.id === value.id);

      if (index >= 0) {
        current[index] = value;
      } else {
        current.push(value);
      }

      return value;
    });
  }

  await db.collection(collection).doc(value.id).set(value);
  return value;
}

async function upsertUserProfile(value: UserProfile) {
  const db = getAdminDb();

  if (!db) {
    return mutateReviewStore((draft) => {
      const index = draft.users.findIndex((entry) => entry.uid === value.uid);
      if (index >= 0) {
        draft.users[index] = value;
      } else {
        draft.users.push(value);
      }

      return value;
    });
  }

  await db.collection("users").doc(value.uid).set(value);
  return value;
}

async function listOrgUsers(orgId: string) {
  const users = await readOrgCampaignCollection<UserProfile>("users", orgId);
  return users.filter((user) => orgIdOf(user) === orgId);
}

async function getOrganizations() {
  return readCampaignCollection<Organization>("organizations");
}

async function getCampaigns() {
  return readCampaignCollection<Campaign>("campaigns");
}

async function getCampaignVersions() {
  return readCampaignCollection<CampaignVersion>("campaign_versions");
}

async function getCampaignLinks() {
  return readCampaignCollection<CampaignLink>("campaign_links");
}

async function getCampaignAssignments() {
  return readCampaignCollection<CampaignAssignment>("campaign_assignments");
}

async function getCampaignResponses() {
  return readCampaignCollection<CampaignResponse>("campaign_responses");
}

function sanitizeStorageName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function haversineDistanceMeters(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371_000;

  const deltaLatitude = toRadians(end.latitude - start.latitude);
  const deltaLongitude = toRadians(end.longitude - start.longitude);
  const latitude1 = toRadians(start.latitude);
  const latitude2 = toRadians(end.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadius * c);
}

function buildGeoCheck(
  geo: ResponseGeoCheck,
  center?: { latitude: number; longitude: number },
  radiusMeters?: number
) {
  if (!center) {
    return geo;
  }

  const distanceMeters = haversineDistanceMeters(geo, center);
  return {
    ...geo,
    distanceMeters,
    withinRange:
      typeof radiusMeters === "number" ? distanceMeters <= radiusMeters : geo.withinRange
  };
}

function buildAuditEvent(
  session: AuthSession,
  action: string,
  targetId: string
) {
  return {
    id: createId("audit"),
    orgId: session.orgId,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action,
    targetType: "campaign",
    targetId,
    timestamp: new Date().toISOString()
  };
}

async function appendAuditLog(session: AuthSession, action: string, targetId: string) {
  await upsertCollectionDocument("audit_logs", buildAuditEvent(session, action, targetId));
}

async function resolveOrganizationForUser(uid: string) {
  const users = await readCollection<UserProfile>("users");
  const user = users.find((entry) => entry.uid === uid);

  if (user?.orgId) {
    return user.orgId;
  }

  const organizations = await getOrganizations();
  return organizations[0]?.id ?? DEMO_ORG_ID;
}

export async function ensureOrgAwareUserProfile(params: {
  uid: string;
  email: string;
  name: string;
  requestedRole?: WorkspaceRole;
  organizationName?: string;
}) {
  const db = getAdminDb();
  const requestedRole = params.requestedRole ?? "admin";

  function buildSelfRegisteredUser(input: {
    orgId: string;
    now: string;
    role: WorkspaceRole;
    projectId?: string;
  }): UserProfile {
    return {
      uid: params.uid,
      orgId: input.orgId,
      name: params.name,
      email: params.email,
      role: input.role,
      status: "active",
      scopes:
        input.role === "admin"
          ? [{ district: "All Districts", block: "All Blocks" }]
          : [{ district: "South District", block: "Block A", cluster: "Ward 7" }],
      assignmentLabel:
        input.role === "admin" ? "Organization owner" : "Field employee",
      assignedTemplateVersion: "template-unassigned",
      projectId: input.projectId,
      createdAt: input.now,
      lastLoginAt: input.now
    };
  }

  if (!db) {
    return mutateReviewStore(async (draft) => {
      const normalizedEmail = params.email.trim().toLowerCase();
      const existing = draft.users.find(
        (user) =>
          user.uid === params.uid ||
          (normalizedEmail.length > 0 &&
            typeof user.email === "string" &&
            user.email.trim().toLowerCase() === normalizedEmail)
      );
      const now = new Date().toISOString();

      if (existing) {
        existing.uid = params.uid;
        existing.name = params.name || existing.name;
        existing.email = params.email || existing.email;
        existing.lastLoginAt = now;
        existing.status = "active";
        existing.orgId = existing.orgId ?? draft.organizations[0]?.id ?? DEMO_ORG_ID;

        return {
          role: existing.role === "admin" ? "admin" : "employee",
          status: existing.status,
          orgId: existing.orgId,
          scopes: existing.scopes,
          projectId: existing.projectId
        };
      }

      let organization =
        requestedRole === "employee"
          ? draft.organizations.find((entry) => entry.id !== DEMO_ORG_ID) ??
            draft.organizations[0]
          : undefined;

      if (!organization) {
        organization = {
          id: createId("org"),
          name: params.organizationName?.trim() || "CensusSync Organization",
          slug: slugify(params.organizationName?.trim() || "CensusSync Organization"),
          createdBy: params.uid,
          createdAt: now,
          updatedAt: now
        };
        draft.organizations.push(organization);
      }

      const user = buildSelfRegisteredUser({
        orgId: organization.id,
        now,
        role: requestedRole,
        projectId: draft.projects[0]?.id
      });
      draft.users.push(user);

      return {
        role: user.role === "admin" ? ("admin" as const) : ("employee" as const),
        status: "active" as const,
        orgId: organization.id,
        scopes: user.scopes ?? [],
        projectId: user.projectId
      };
    });
  }

  const userRef = db.collection("users").doc(params.uid);
  const userSnapshot = await userRef.get();
  const existing = userSnapshot.exists ? (userSnapshot.data() as UserProfile) : null;

  if (existing) {
    const role = existing.role === "admin" ? "admin" : "employee";
    await userRef.set(
      {
        ...existing,
        orgId: existing.orgId ?? (await resolveOrganizationForUser(params.uid)),
        name: params.name || existing.name,
        email: params.email || existing.email,
        status: "active",
        lastLoginAt: new Date().toISOString()
      },
      { merge: true }
    );

    return {
      role,
      status: "active" as const,
      orgId: existing.orgId ?? (await resolveOrganizationForUser(params.uid)),
      scopes: existing.scopes ?? [],
      projectId: existing.projectId
    };
  }

  const usersSnapshot = await db.collection("users").limit(1).get();
  if (!usersSnapshot.empty && !params.requestedRole) {
    throw new Error("Your organization admin must invite you before you can access CensusSync.");
  }

  const now = new Date().toISOString();
  let organization: Organization;

  if (requestedRole === "employee") {
    const organizations = await getOrganizations();
    organization =
      organizations.find((entry) => entry.id !== DEMO_ORG_ID) ??
      organizations[0] ?? {
        id: createId("org"),
        name: params.organizationName?.trim() || "CensusSync Organization",
        slug: slugify(params.organizationName?.trim() || "CensusSync Organization"),
        createdBy: params.uid,
        createdAt: now,
        updatedAt: now
      };

    if (!organizations.some((entry) => entry.id === organization.id)) {
      await db.collection("organizations").doc(organization.id).set(organization);
    }
  } else {
    organization = {
      id: createId("org"),
      name: params.organizationName?.trim() || "CensusSync Organization",
      slug: slugify(params.organizationName?.trim() || "CensusSync Organization"),
      createdBy: params.uid,
      createdAt: now,
      updatedAt: now
    };

    await db.collection("organizations").doc(organization.id).set(organization);
  }

  const user = buildSelfRegisteredUser({
    orgId: organization.id,
    now,
    role: requestedRole
  });

  await userRef.set(user);

  const auth = getAdminAuth();
  if (auth) {
    await auth.setCustomUserClaims(params.uid, {
      role: requestedRole,
      orgId: organization.id
    });
  }

  return {
    role: requestedRole === "admin" ? ("admin" as const) : ("employee" as const),
    status: "active" as const,
    orgId: organization.id,
    scopes: user.scopes ?? [],
    projectId: user.projectId
  };
}

export async function inviteWorkspaceUser(
  payload: {
    name: string;
    email: string;
    password: string;
    role: WorkspaceRole;
    scopes?: Scope[];
  },
  session: AuthSession
) {
  assertAdmin(session);

  const auth = getAdminAuth();
  const now = new Date().toISOString();
  let uid = createId("user");

  if (auth) {
    const userRecord = await auth.createUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.name
    });
    uid = userRecord.uid;
    await auth.setCustomUserClaims(uid, {
      role: payload.role,
      orgId: session.orgId
    });
  }

  const nextUser: UserProfile = {
    uid,
    orgId: session.orgId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    status: "invited",
    scopes: payload.scopes ?? [],
    assignmentLabel: payload.role === "admin" ? "Organization admin" : "Field employee",
    assignedTemplateVersion: "template-unassigned",
    createdAt: now,
    lastLoginAt: undefined
  };

  await upsertUserProfile(nextUser);
  await appendAuditLog(session, "invite_workspace_user", uid);

  return { uid, status: nextUser.status };
}

export async function createOrUpdateCampaign(
  payload: unknown,
  session: AuthSession
) {
  assertAdmin(session);
  const parsed = campaignCreateSchema.parse(payload);
  const now = new Date().toISOString();
  const scope = resolveScope(parsed);
  const campaignId = parsed.campaignId ?? createId("campaign");
  const versionId = createId("campaign-version");
  const campaign: Campaign = {
    id: campaignId,
    orgId: session.orgId,
    name: parsed.name,
    slug: slugify(parsed.name),
    purpose: parsed.purpose,
    description: parsed.description,
    targetAudience: parsed.targetAudience,
    status: "published",
    collectionMode: parsed.collectionMode,
    geofenceCenter: parsed.geofenceCenter,
    geofenceRadiusMeters: parsed.geofenceRadiusMeters,
    locationScope: scope,
    activeVersionId: versionId,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now
  };
  const version: CampaignVersion = {
    id: versionId,
    orgId: session.orgId,
    campaignId,
    versionLabel: parsed.versionLabel ?? `v${Date.now()}`,
    status: "published",
    sections: normalizeQuestionDrafts(parsed.sections),
    source: "manual",
    createdBy: session.uid,
    createdAt: now,
    publishedAt: now
  };

  await upsertCollectionDocument("campaigns", campaign);
  await upsertCollectionDocument("campaign_versions", version);
  await appendAuditLog(session, "upsert_campaign", campaign.id);

  return {
    campaign,
    version
  };
}

export async function createAiCampaignDraft(
  payload: unknown,
  session: AuthSession
) {
  const providerConfig = await getUserGeminiProviderConfig(session.uid);
  return generateCampaignDraft(payload, providerConfig);
}

async function getCampaignVersionForCreate(
  campaignId: string,
  campaignVersionId?: string
) {
  const [campaigns, versions] = await Promise.all([getCampaigns(), getCampaignVersions()]);
  const campaign = campaigns.find((entry) => entry.id === campaignId);
  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const version =
    versions.find((entry) => entry.id === campaignVersionId) ??
    versions.find((entry) => entry.id === campaign.activeVersionId);

  if (!version) {
    throw new Error("Campaign version not found.");
  }

  return { campaign, version };
}

export async function createCampaignLink(
  payload: unknown,
  session: AuthSession
) {
  assertAdmin(session);
  const parsed = campaignLinkCreateSchema.parse(payload);
  const { campaign, version } = await getCampaignVersionForCreate(
    parsed.campaignId,
    parsed.campaignVersionId
  );

  if (campaign.orgId !== session.orgId || version.orgId !== session.orgId) {
    throw new Error("You do not have access to this campaign.");
  }

  const users = await listOrgUsers(session.orgId);
  const rawToken = createCampaignLinkToken();
  const linkId = createId("campaign-link");
  const now = new Date().toISOString();
  let assignment: CampaignAssignment | undefined;

  if (parsed.type === "employee") {
    if (!parsed.employeeId) {
      throw new Error("Select an employee before generating an employee link.");
    }

    const employee = users.find((user) => user.uid === parsed.employeeId);
    if (!employee) {
      throw new Error("Employee not found.");
    }

    const assignmentId = parsed.assignmentId ?? createId("campaign-assignment");
    assignment = {
      id: assignmentId,
      orgId: session.orgId,
      campaignId: campaign.id,
      campaignVersionId: version.id,
      employeeId: employee.uid,
      employeeName: employee.name,
      label: `${campaign.name} • ${scopeLabel(campaign.locationScope)}`,
      scope: campaign.locationScope,
      geofenceCenter: campaign.geofenceCenter,
      geofenceRadiusMeters: campaign.geofenceRadiusMeters,
      targetResponses: undefined,
      status: "active",
      employeeLinkId: linkId,
      activeFrom: now,
      activeTo: undefined,
      createdBy: session.uid,
      createdAt: now,
      updatedAt: now
    };
    await upsertCollectionDocument("campaign_assignments", assignment);
  }

  const link: CampaignLink = {
    id: linkId,
    orgId: session.orgId,
    campaignId: campaign.id,
    campaignVersionId: version.id,
    assignmentId: assignment?.id,
    type: parsed.type,
    tokenHash: hashCampaignToken(rawToken),
    tokenPreview: buildTokenPreview(rawToken),
    status: "active",
    createdBy: session.uid,
    createdAt: now
  };

  await upsertCollectionDocument("campaign_links", link);
  await appendAuditLog(session, "create_campaign_link", link.id);

  return {
    link,
    assignment,
    token: rawToken,
    sharePath:
      parsed.type === "employee" ? `/field/${rawToken}` : `/survey/${rawToken}`,
    shareUrl: `${env.appUrl}${parsed.type === "employee" ? "/field" : "/survey"}/${rawToken}`
  };
}

export async function revokeCampaignLink(linkId: string, session: AuthSession) {
  assertAdmin(session);
  const links = await getCampaignLinks();
  const link = links.find((entry) => entry.id === linkId && entry.orgId === session.orgId);
  if (!link) {
    throw new Error("Campaign link not found.");
  }

  const revoked: CampaignLink = {
    ...link,
    status: "revoked",
    revokedAt: new Date().toISOString()
  };
  await upsertCollectionDocument("campaign_links", revoked);
  await appendAuditLog(session, "revoke_campaign_link", link.id);
  return revoked;
}

async function resolveCampaignLinkByToken(token: string) {
  const links = await getCampaignLinks();
  const tokenHash = hashCampaignToken(token);
  return links.find((entry) => entry.tokenHash === tokenHash && entry.status === "active");
}

export async function getCampaignFieldPackageByToken(
  token: string,
  session: AuthSession
) {
  const link = await resolveCampaignLinkByToken(token);
  if (!link || link.type !== "employee") {
    return null;
  }

  const [campaigns, versions, assignments] = await Promise.all([
    getCampaigns(),
    getCampaignVersions(),
    getCampaignAssignments()
  ]);
  const campaign = campaigns.find((entry) => entry.id === link.campaignId);
  const version = versions.find((entry) => entry.id === link.campaignVersionId);
  const assignment = assignments.find((entry) => entry.id === link.assignmentId);

  if (!campaign || !version || !assignment) {
    return null;
  }

  if (campaign.orgId !== session.orgId || assignment.employeeId !== session.uid) {
    return null;
  }

  return {
    campaign,
    version,
    assignment,
    link
  } satisfies CampaignFieldPackage;
}

export async function getCampaignFieldPackageByAssignmentId(
  assignmentId: string,
  session: AuthSession
) {
  const [assignments, campaigns, versions, links] = await Promise.all([
    getCampaignAssignments(),
    getCampaigns(),
    getCampaignVersions(),
    getCampaignLinks()
  ]);

  const assignment = assignments.find(
    (entry) => entry.id === assignmentId && entry.employeeId === session.uid
  );
  if (!assignment) {
    return null;
  }

  const campaign = campaigns.find((entry) => entry.id === assignment.campaignId);
  const version = versions.find((entry) => entry.id === assignment.campaignVersionId);
  const link = links.find((entry) => entry.id === assignment.employeeLinkId);

  if (!campaign || !version || !link) {
    return null;
  }

  return {
    campaign,
    version,
    assignment,
    link
  } satisfies CampaignFieldPackage;
}

export async function getPublicCampaignPackageByToken(token: string) {
  const link = await resolveCampaignLinkByToken(token);
  if (!link || link.type !== "public") {
    return null;
  }

  const [campaigns, versions] = await Promise.all([getCampaigns(), getCampaignVersions()]);
  const campaign = campaigns.find((entry) => entry.id === link.campaignId);
  const version = versions.find((entry) => entry.id === link.campaignVersionId);

  if (!campaign || !version) {
    return null;
  }

  return {
    campaign,
    version,
    link
  } satisfies PublicCampaignPackage;
}

async function uploadResponsePhoto(
  responseId: string,
  file: File,
  geo: ResponseGeoCheck
) {
  const storage = getAdminStorage();
  if (!storage) {
    return {
      fileName: sanitizeStorageName(file.name || "respondent-photo.jpg"),
      mimeType: file.type || "image/jpeg",
      byteSize: file.size,
      capturedAt: geo.capturedAt,
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: geo.accuracy,
      storagePath: `.runtime/campaign-responses/${responseId}`
    } satisfies ResponsePhotoEvidence;
  }

  const bucket = storage.bucket();
  const fileName = sanitizeStorageName(file.name || "respondent-photo.jpg");
  const storagePath = `campaign-responses/${responseId}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fingerprint = createHash("sha256").update(buffer).digest("hex");

  await bucket.file(storagePath).save(buffer, {
    contentType: file.type || "image/jpeg",
    resumable: false
  });

  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: "2500-01-01"
  });

  return {
    fileName,
    mimeType: file.type || "image/jpeg",
    byteSize: file.size,
    capturedAt: geo.capturedAt,
    latitude: geo.latitude,
    longitude: geo.longitude,
    accuracy: geo.accuracy,
    storagePath,
    downloadUrl,
    fingerprint
  } satisfies ResponsePhotoEvidence;
}

export async function ingestEmployeeCampaignResponse(
  payload: unknown,
  photoFile: File | null,
  session: AuthSession
) {
  if (session.role !== "employee" && session.role !== "admin") {
    throw new Error("Only employees can submit field campaign responses.");
  }

  const parsed = employeeCampaignResponseSchema.parse(payload);
  const fieldPackage = await getCampaignFieldPackageByToken(parsed.token, session);
  if (!fieldPackage || fieldPackage.assignment.id !== parsed.assignmentId) {
    throw new Error("Campaign field package not found for this employee.");
  }

  const validationIssues = validateCampaignAnswers(fieldPackage.version.sections, parsed.answers);
  if (Object.keys(validationIssues).length) {
    throw new Error("Complete all required questions before submitting.");
  }

  if (!photoFile) {
    throw new Error("A respondent photo is required for employee submissions.");
  }

  const unlockedAt = buildGeoCheck(
    parsed.unlockGeo,
    fieldPackage.assignment.geofenceCenter,
    fieldPackage.assignment.geofenceRadiusMeters
  );
  const submittedAt = buildGeoCheck(
    parsed.submitGeo,
    fieldPackage.assignment.geofenceCenter,
    fieldPackage.assignment.geofenceRadiusMeters
  );

  if (!unlockedAt.withinRange || !submittedAt.withinRange) {
    throw new Error("This response must be submitted from inside the campaign geofence.");
  }

  const responseId = createId("campaign-response");
  const now = new Date().toISOString();
  const photo = await uploadResponsePhoto(responseId, photoFile, submittedAt);
  const response: CampaignResponse = {
    id: responseId,
    orgId: fieldPackage.campaign.orgId,
    campaignId: fieldPackage.campaign.id,
    campaignVersionId: fieldPackage.version.id,
    linkId: fieldPackage.link.id,
    assignmentId: fieldPackage.assignment.id,
    channel: "employee",
    employeeId: session.uid,
    employeeName: session.name,
    respondentName: parsed.respondentName,
    respondentEmail: parsed.respondentEmail || undefined,
    respondentPhone: parsed.respondentPhone,
    answers: parsed.answers,
    verification: {
      unlockedAt,
      submittedAt,
      respondentPhoto: photo
    },
    syncStatus: "synced",
    validationStatus: "approved",
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  };

  await upsertCollectionDocument("campaign_responses", response);
  await appendAuditLog(session, "employee_campaign_response", response.id);
  return response;
}

export async function ingestPublicCampaignResponse(payload: unknown) {
  const parsed = publicCampaignResponseSchema.parse(payload);
  const publicPackage = await getPublicCampaignPackageByToken(parsed.token);
  if (!publicPackage) {
    throw new Error("Public campaign link is not active.");
  }

  const validationIssues = validateCampaignAnswers(publicPackage.version.sections, parsed.answers);
  if (Object.keys(validationIssues).length) {
    throw new Error("Complete all required questions before submitting.");
  }

  const now = new Date().toISOString();
  const response: CampaignResponse = {
    id: createId("campaign-response"),
    orgId: publicPackage.campaign.orgId,
    campaignId: publicPackage.campaign.id,
    campaignVersionId: publicPackage.version.id,
    linkId: publicPackage.link.id,
    channel: "public",
    respondentName: parsed.respondentName,
    respondentEmail: parsed.respondentEmail || undefined,
    respondentPhone: parsed.respondentPhone,
    answers: parsed.answers,
    submissionContext:
      parsed.submitGeo || parsed.submissionMeta
        ? {
            submitGeo: parsed.submitGeo,
            userAgent: parsed.submissionMeta?.userAgent,
            locale: parsed.submissionMeta?.locale,
            timezone: parsed.submissionMeta?.timezone
          }
        : undefined,
    syncStatus: "synced",
    validationStatus: "approved",
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  };

  await upsertCollectionDocument("campaign_responses", response);
  return response;
}

function formatDayKey(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "2-digit"
  }).format(new Date(value));
}

function getResponseParticipantLabel(response: CampaignResponse) {
  return response.employeeName ?? response.respondentName ?? response.respondentEmail ?? "Anonymous";
}

function formatQuestionValue(question: CampaignQuestion, value: unknown) {
  if (question.type === "boolean" && typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (question.type === "single_select") {
    const option = question.options?.find((entry) => entry.value === value);
    return option?.label ?? String(value);
  }

  if (question.type === "multi_select" && Array.isArray(value)) {
    return value
      .map((item) => question.options?.find((entry) => entry.value === item)?.label ?? String(item))
      .join(", ");
  }

  return String(value);
}

function findResponseGeo(response: CampaignResponse) {
  return response.verification?.submittedAt ?? response.submissionContext?.submitGeo;
}

function findLocationAnswer(response: CampaignResponse, version?: CampaignVersion) {
  if (!version) {
    return undefined;
  }

  const locationQuestion = version.sections
    .flatMap((section) => section.questions)
    .find((question) => {
      const prompt = question.prompt.toLowerCase();
      const key = question.key.toLowerCase();
      return (
        prompt.includes("location") ||
        prompt.includes("where") ||
        prompt.includes("address") ||
        key.includes("location") ||
        key.includes("address")
      );
    });

  if (!locationQuestion) {
    return undefined;
  }

  const answer = response.answers[locationQuestion.key];
  if (answer === undefined || answer === null || answer === "") {
    return undefined;
  }

  return formatQuestionValue(locationQuestion, answer);
}

function summarizeQuestion(
  question: CampaignQuestion,
  responses: CampaignResponse[]
): CampaignQuestionBreakdown | null {
  const answeredResponses = responses.flatMap((response) => {
    const value = response.answers[question.key];
    if (value === undefined || value === null || value === "") {
      return [];
    }

    if (Array.isArray(value) && value.length === 0) {
      return [];
    }

    return [{ response, value }] as const;
  });

  if (!answeredResponses.length) {
    return null;
  }

  if (question.type === "single_select" || question.type === "multi_select") {
    const counts = new Map<string, number>();
    answeredResponses.forEach(({ value }) => {
      const items = Array.isArray(value) ? value : [value];
      items.forEach((item) => {
        const key =
          question.options?.find((option) => option.value === item)?.label ?? String(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    return {
      questionId: question.id,
      questionPrompt: question.prompt,
      type: question.type,
      totalAnswered: answeredResponses.length,
      values: Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
    };
  }

  if (question.type === "rating" || question.type === "number" || question.type === "boolean") {
    const counts = new Map<string, number>();
    answeredResponses.forEach(({ value }) => {
      const key = formatQuestionValue(question, value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return {
      questionId: question.id,
      questionPrompt: question.prompt,
      type: question.type,
      totalAnswered: answeredResponses.length,
      values: Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
    };
  }

  return {
    questionId: question.id,
    questionPrompt: question.prompt,
    type: question.type,
    totalAnswered: answeredResponses.length,
    values: [{ label: "Answered", value: answeredResponses.length }],
    textResponses: answeredResponses
      .map(({ response, value }) => ({
        responseId: response.id,
        respondentLabel: getResponseParticipantLabel(response),
        answer: formatQuestionValue(question, value),
        submittedAt: response.submittedAt
      }))
      .sort(
        (left, right) =>
          new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
      )
  };
}

export async function getCampaignAdminWorkspace(session: AuthSession) {
  assertAdmin(session);
  const [organizationId, campaigns, versions, links, assignments, responses, users] =
    await Promise.all([
      Promise.resolve(session.orgId),
      readOrgCampaignCollection<Campaign>("campaigns", session.orgId),
      readOrgCampaignCollection<CampaignVersion>("campaign_versions", session.orgId),
      readOrgCampaignCollection<CampaignLink>("campaign_links", session.orgId),
      readOrgCampaignCollection<CampaignAssignment>("campaign_assignments", session.orgId),
      readOrgCampaignCollection<CampaignResponse>("campaign_responses", session.orgId),
      listOrgUsers(session.orgId)
    ]);

  return {
    organization:
      (await getOrganizations()).find((entry) => entry.id === organizationId) ?? null,
    campaigns,
    versions,
    links,
    assignments,
    responses,
    users
  };
}

export async function getEmployeeCampaignWorkspace(session: AuthSession) {
  const [assignments, campaigns, versions, links, responses] = await Promise.all([
    readOrgCampaignCollection<CampaignAssignment>("campaign_assignments", session.orgId),
    readOrgCampaignCollection<Campaign>("campaigns", session.orgId),
    readOrgCampaignCollection<CampaignVersion>("campaign_versions", session.orgId),
    readOrgCampaignCollection<CampaignLink>("campaign_links", session.orgId),
    readOrgCampaignCollection<CampaignResponse>("campaign_responses", session.orgId)
  ]);

  const employeeAssignments = assignments.filter(
    (entry) => entry.employeeId === session.uid && entry.orgId === session.orgId
  );

  return employeeAssignments.map((assignment) => ({
    assignment,
    campaign: campaigns.find((entry) => entry.id === assignment.campaignId) ?? null,
    version: versions.find((entry) => entry.id === assignment.campaignVersionId) ?? null,
    link: links.find((entry) => entry.id === assignment.employeeLinkId) ?? null,
    responseCount: responses.filter((entry) => entry.assignmentId === assignment.id).length
  }));
}

function buildCampaignAnalytics({
  campaigns,
  versions,
  links,
  assignments,
  responses
}: Pick<
  Awaited<ReturnType<typeof getCampaignAdminWorkspace>>,
  "campaigns" | "versions" | "links" | "assignments" | "responses"
>) {
  const summary = {
    totalResponses: responses.length,
    employeeResponses: responses.filter((entry) => entry.channel === "employee").length,
    publicResponses: responses.filter((entry) => entry.channel === "public").length,
    completionRate: assignments.length
      ? Math.round(
          (responses.filter((entry) => entry.channel === "employee").length /
            assignments.length) *
            100
        )
      : responses.length
        ? 100
        : 0,
    activeCampaigns: campaigns.filter((entry) => entry.status === "published").length,
    verifiedResponses: responses.filter((entry) => entry.verification?.respondentPhoto).length
  };

  const responsesOverTimeMap = new Map<string, number>();
  responses.forEach((response) => {
    const label = formatDayKey(response.submittedAt);
    responsesOverTimeMap.set(label, (responsesOverTimeMap.get(label) ?? 0) + 1);
  });

  const employeeActivityMap = new Map<string, number>();
  responses
    .filter((entry) => entry.channel === "employee")
    .forEach((response) => {
      const label = response.employeeName ?? "Employee";
      employeeActivityMap.set(label, (employeeActivityMap.get(label) ?? 0) + 1);
    });

  const geoPoints: CampaignGeoPoint[] = responses
    .filter((entry) => Boolean(findResponseGeo(entry)))
    .map((response) => ({
      responseId: response.id,
      campaignName:
        campaigns.find((entry) => entry.id === response.campaignId)?.name ?? "Campaign",
      channel: response.channel,
      participantLabel: getResponseParticipantLabel(response),
      latitude: findResponseGeo(response)!.latitude,
      longitude: findResponseGeo(response)!.longitude,
      accuracy: findResponseGeo(response)!.accuracy,
      submittedAt: response.submittedAt
    }));

  const recentResponses: CampaignRecentResponse[] = responses
    .map((response) => {
      const version = versions.find((entry) => entry.id === response.campaignVersionId);
      const geo = findResponseGeo(response);

      return {
        responseId: response.id,
        campaignName: campaigns.find((entry) => entry.id === response.campaignId)?.name ?? "Campaign",
        channel: response.channel,
        respondentLabel: getResponseParticipantLabel(response),
        respondentEmail: response.respondentEmail,
        respondentPhone: response.respondentPhone,
        locationAnswer: findLocationAnswer(response, version),
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        accuracy: geo?.accuracy,
        submittedAt: response.submittedAt
      };
    })
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
    .slice(0, 12);

  const questionBreakdowns = versions
    .filter((version) => campaigns.some((campaign) => campaign.activeVersionId === version.id))
    .flatMap((version) =>
      version.sections.flatMap((section) =>
        section.questions
          .map((question) =>
            summarizeQuestion(
              question,
              responses.filter((response) => response.campaignVersionId === version.id)
            )
          )
          .filter((value): value is CampaignQuestionBreakdown => Boolean(value))
      )
    );

  return {
    summary,
    responsesOverTime: Array.from(responsesOverTimeMap.entries()).map(([label, value]) => ({
      label,
      responses: value
    })),
    channelSplit: [
      { label: "Employee", value: summary.employeeResponses },
      { label: "Public", value: summary.publicResponses }
    ],
    completionFunnel: [
      { label: "Links", value: links.length },
      { label: "Assignments", value: assignments.length },
      { label: "Responses", value: responses.length },
      { label: "Verified", value: summary.verifiedResponses }
    ],
    employeeActivity: Array.from(employeeActivityMap.entries()).map(([label, value]) => ({
      label,
      value
    })),
    questionBreakdowns,
    geoPoints,
    recentResponses
  } satisfies CampaignAnalyticsPayload;
}

export async function getCampaignAnalytics(session: AuthSession) {
  assertAdmin(session);
  const workspace = await getCampaignAdminWorkspace(session);
  return buildCampaignAnalytics(workspace);
}

export async function getAdminCampaignDashboard(session: AuthSession) {
  const workspace = await getCampaignAdminWorkspace(session);
  return {
    workspace,
    analytics: buildCampaignAnalytics(workspace)
  };
}
