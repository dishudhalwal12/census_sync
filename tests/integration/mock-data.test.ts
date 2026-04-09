import { describe, expect, it } from "vitest";

import {
  demoAlerts,
  demoProjects,
  demoReviewCases,
  demoSubmissions,
  demoUsers
} from "@/lib/data/mock";

describe("mock data integrity", () => {
  it("ships a starter project for explicit demo seeding", () => {
    expect(demoProjects[0]?.status).toBe("active");
    expect(demoProjects[0]?.activeTemplateVersionId).toBe("template-v1");
  });

  it("ships demo users for the admin and employee workspaces", () => {
    const roles = demoUsers.map((user) => user.role).sort();
    expect(roles).toEqual(["admin", "admin", "employee"]);
  });

  it("includes a flagged submission for the validation queue", () => {
    expect(demoSubmissions.some((submission) => submission.validationStatus === "flagged")).toBe(true);
    expect(demoSubmissions.some((submission) => submission.reviewStatus === "pending_review")).toBe(true);
  });

  it("ships trust-ops demo entities for alerts and review workflows", () => {
    expect(demoReviewCases.length).toBeGreaterThan(0);
    expect(demoAlerts.length).toBeGreaterThan(0);
  });
});
