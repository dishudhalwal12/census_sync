import "server-only";

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  demoCampaignAssignments,
  demoCampaignLinks,
  demoCampaignResponses,
  demoCampaignVersions,
  demoCampaigns,
  demoOrganizations
} from "@/lib/data/campaign-mock";
import {
  demoAlerts,
  demoAssignments,
  demoAuditLogs,
  demoExports,
  demoMissionSubmissions,
  demoProjects,
  demoReviewCases,
  demoSubmissions,
  demoTemplates,
  demoUsers
} from "@/lib/data/mock";
import type {
  Assignment,
  AlertEvent,
  AuditLogEvent,
  ExportRequest,
  HouseholdSubmission,
  MissionSubmission,
  Project,
  ReviewCase,
  TemplateVersion,
  UserPrivateSettings,
  UserProfile
} from "@/types/domain";
import type {
  Campaign,
  CampaignAssignment,
  CampaignLink,
  CampaignResponse,
  CampaignVersion,
  Organization
} from "@/types/campaign";

export interface ReviewStoreState {
  version: number;
  updatedAt: string;
  alerts: AlertEvent[];
  assignments: Assignment[];
  audit_logs: AuditLogEvent[];
  campaign_assignments: CampaignAssignment[];
  campaign_links: CampaignLink[];
  campaign_responses: CampaignResponse[];
  campaign_versions: CampaignVersion[];
  campaigns: Campaign[];
  exports: ExportRequest[];
  mission_submissions: MissionSubmission[];
  organizations: Organization[];
  projects: Project[];
  review_cases: ReviewCase[];
  submissions: HouseholdSubmission[];
  template_versions: TemplateVersion[];
  user_private_settings: UserPrivateSettings[];
  users: UserProfile[];
}

export type ReviewCollectionName = keyof Omit<ReviewStoreState, "version" | "updatedAt">;

const REVIEW_STORE_VERSION = 2;
const REVIEW_STORE_PATH = path.join(
  process.cwd(),
  ".runtime",
  "censussync-review-store.json"
);

function buildSeedStore(): ReviewStoreState {
  return structuredClone({
    version: REVIEW_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    alerts: demoAlerts,
    assignments: demoAssignments,
    audit_logs: demoAuditLogs,
    campaign_assignments: demoCampaignAssignments,
    campaign_links: demoCampaignLinks,
    campaign_responses: demoCampaignResponses,
    campaign_versions: demoCampaignVersions,
    campaigns: demoCampaigns,
    exports: demoExports,
    mission_submissions: demoMissionSubmissions,
    organizations: demoOrganizations,
    projects: demoProjects,
    review_cases: demoReviewCases,
    submissions: demoSubmissions,
    template_versions: demoTemplates,
    user_private_settings: [],
    users: demoUsers
  });
}

async function saveStore(store: ReviewStoreState) {
  await mkdir(path.dirname(REVIEW_STORE_PATH), { recursive: true });
  await writeFile(REVIEW_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function loadStore(): Promise<ReviewStoreState> {
  try {
    const contents = await readFile(REVIEW_STORE_PATH, "utf8");
    const parsed = JSON.parse(contents) as Partial<ReviewStoreState>;

    if (
      parsed &&
      parsed.version === REVIEW_STORE_VERSION &&
      Array.isArray(parsed.alerts) &&
      Array.isArray(parsed.assignments) &&
      Array.isArray(parsed.audit_logs) &&
      Array.isArray(parsed.campaign_assignments) &&
      Array.isArray(parsed.campaign_links) &&
      Array.isArray(parsed.campaign_responses) &&
      Array.isArray(parsed.campaign_versions) &&
      Array.isArray(parsed.campaigns) &&
      Array.isArray(parsed.exports) &&
      Array.isArray(parsed.mission_submissions) &&
      Array.isArray(parsed.organizations) &&
      Array.isArray(parsed.projects) &&
      Array.isArray(parsed.review_cases) &&
      Array.isArray(parsed.submissions) &&
      Array.isArray(parsed.template_versions) &&
      (parsed.user_private_settings === undefined || Array.isArray(parsed.user_private_settings)) &&
      Array.isArray(parsed.users)
    ) {
      return {
        version: REVIEW_STORE_VERSION,
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
        alerts: parsed.alerts,
        assignments: parsed.assignments,
        audit_logs: parsed.audit_logs,
        campaign_assignments: parsed.campaign_assignments,
        campaign_links: parsed.campaign_links,
        campaign_responses: parsed.campaign_responses,
        campaign_versions: parsed.campaign_versions,
        campaigns: parsed.campaigns,
        exports: parsed.exports,
        mission_submissions: parsed.mission_submissions,
        organizations: parsed.organizations,
        projects: parsed.projects,
        review_cases: parsed.review_cases,
        submissions: parsed.submissions,
        template_versions: parsed.template_versions,
        user_private_settings: parsed.user_private_settings ?? [],
        users: parsed.users
      };
    }
  } catch {
    // Seed a fresh runtime store below.
  }

  const seeded = buildSeedStore();
  await saveStore(seeded);
  return seeded;
}

export async function readReviewStore() {
  const store = await loadStore();
  return structuredClone(store);
}

export async function readReviewCollection<T>(name: ReviewCollectionName) {
  const store = await readReviewStore();
  return structuredClone(store[name]) as T[];
}

export async function mutateReviewStore<T>(
  recipe: (draft: ReviewStoreState) => Promise<T> | T
) {
  const store = await loadStore();
  const draft = structuredClone(store);
  const result = await recipe(draft);
  draft.updatedAt = new Date().toISOString();
  await saveStore(draft);
  return result;
}
