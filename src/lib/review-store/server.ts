import "server-only";

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  demoAssignments,
  demoAuditLogs,
  demoExports,
  demoMissionSubmissions,
  demoProjects,
  demoSubmissions,
  demoTemplates,
  demoUsers
} from "@/lib/data/mock";
import type {
  Assignment,
  AuditLogEvent,
  ExportRequest,
  HouseholdSubmission,
  MissionSubmission,
  Project,
  TemplateVersion,
  UserProfile
} from "@/types/domain";

export interface ReviewStoreState {
  version: number;
  updatedAt: string;
  assignments: Assignment[];
  audit_logs: AuditLogEvent[];
  exports: ExportRequest[];
  mission_submissions: MissionSubmission[];
  projects: Project[];
  submissions: HouseholdSubmission[];
  template_versions: TemplateVersion[];
  users: UserProfile[];
}

export type ReviewCollectionName = keyof Omit<ReviewStoreState, "version" | "updatedAt">;

const REVIEW_STORE_VERSION = 1;
const REVIEW_STORE_PATH = path.join(
  process.cwd(),
  ".runtime",
  "censussync-review-store.json"
);

function buildSeedStore(): ReviewStoreState {
  return structuredClone({
    version: REVIEW_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    assignments: demoAssignments,
    audit_logs: demoAuditLogs,
    exports: demoExports,
    mission_submissions: demoMissionSubmissions,
    projects: demoProjects,
    submissions: demoSubmissions,
    template_versions: demoTemplates,
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
      Array.isArray(parsed.assignments) &&
      Array.isArray(parsed.audit_logs) &&
      Array.isArray(parsed.exports) &&
      Array.isArray(parsed.mission_submissions) &&
      Array.isArray(parsed.projects) &&
      Array.isArray(parsed.submissions) &&
      Array.isArray(parsed.template_versions) &&
      Array.isArray(parsed.users)
    ) {
      return {
        version: REVIEW_STORE_VERSION,
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
        assignments: parsed.assignments,
        audit_logs: parsed.audit_logs,
        exports: parsed.exports,
        mission_submissions: parsed.mission_submissions,
        projects: parsed.projects,
        submissions: parsed.submissions,
        template_versions: parsed.template_versions,
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
