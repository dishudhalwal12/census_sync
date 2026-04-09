import { describe, expect, it } from "vitest";

import {
  DEMO_EMPLOYEE_LINK_TOKEN,
  DEMO_ORG_ID,
  DEMO_PUBLIC_LINK_TOKEN
} from "@/lib/data/campaign-mock";
import {
  getCampaignAnalytics,
  getCampaignFieldPackageByToken,
  getPublicCampaignPackageByToken
} from "@/lib/campaigns/server";
import type { AuthSession } from "@/types/session";

const demoAdminSession: AuthSession = {
  uid: "demo-admin",
  orgId: DEMO_ORG_ID,
  email: "admin@demo.censussync.app",
  name: "Demo Admin",
  role: "admin",
  status: "active",
  scopes: [{ district: "All Districts", block: "All Blocks" }],
  isDemo: true
};

const demoEmployeeSession: AuthSession = {
  uid: "demo-enumerator",
  orgId: DEMO_ORG_ID,
  email: "enumerator@demo.censussync.app",
  name: "Demo Employee",
  role: "employee",
  status: "active",
  projectId: "project-census-2026",
  scopes: [{ district: "South District", block: "Block A", cluster: "Ward 7" }],
  isDemo: true
};

describe("campaign platform integration", () => {
  it("resolves employee and public token packages from seeded review-safe data", async () => {
    const [fieldPackage, publicPackage] = await Promise.all([
      getCampaignFieldPackageByToken(DEMO_EMPLOYEE_LINK_TOKEN, demoEmployeeSession),
      getPublicCampaignPackageByToken(DEMO_PUBLIC_LINK_TOKEN)
    ]);

    expect(fieldPackage?.assignment.employeeId).toBe("demo-enumerator");
    expect(publicPackage?.campaign.collectionMode).toBe("hybrid");
  });

  it("aggregates admin analytics from seeded campaign responses", async () => {
    const analytics = await getCampaignAnalytics(demoAdminSession);

    expect(analytics.summary.totalResponses).toBeGreaterThan(0);
    expect(analytics.summary.employeeResponses).toBeGreaterThan(0);
    expect(analytics.channelSplit.some((row) => row.label === "Public")).toBe(true);
    expect(analytics.questionBreakdowns.length).toBeGreaterThan(0);
  });
});
