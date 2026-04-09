import { describe, expect, it } from "vitest";

import { hasRole, isRole } from "@/lib/roles";

describe("role helpers", () => {
  it("identifies valid roles", () => {
    expect(isRole("employee")).toBe(true);
    expect(isRole("observer")).toBe(false);
  });

  it("checks allowed role sets", () => {
    expect(hasRole("admin", ["admin", "employee"])).toBe(true);
    expect(hasRole("employee", ["admin"])).toBe(false);
  });
});
