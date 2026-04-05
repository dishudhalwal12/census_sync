import { describe, expect, it } from "vitest";

import { demoProjects, demoSubmissions, demoUsers } from "@/lib/data/mock";

describe("mock data integrity", () => {
  it("ships a starter project for explicit demo seeding", () => {
    expect(demoProjects[0]?.status).toBe("active");
    expect(demoProjects[0]?.activeTemplateVersionId).toBe("template-v1");
  });

  it("ships demo users for all three product roles", () => {
    const roles = demoUsers.map((user) => user.role).sort();
    expect(roles).toEqual(["admin", "enumerator", "supervisor"]);
  });

  it("includes a flagged submission for the validation queue", () => {
    expect(demoSubmissions.some((submission) => submission.validationStatus === "flagged")).toBe(true);
    expect(demoSubmissions.some((submission) => submission.reviewStatus === "pending_review")).toBe(true);
  });
});
