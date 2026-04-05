import { describe, expect, it } from "vitest";

import { hasRole, isRole } from "@/lib/roles";

describe("role helpers", () => {
  it("identifies valid roles", () => {
    expect(isRole("enumerator")).toBe(true);
    expect(isRole("observer")).toBe(false);
  });

  it("checks allowed role sets", () => {
    expect(hasRole("admin", ["admin", "supervisor"])).toBe(true);
    expect(hasRole("enumerator", ["admin", "supervisor"])).toBe(false);
  });
});
