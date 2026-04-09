import type { UserRole, WorkspaceRole } from "@/types/domain";

export function isRole(value: string): value is WorkspaceRole {
  return value === "employee" || value === "admin";
}

export function hasRole(role: WorkspaceRole, allowedRoles: WorkspaceRole[]) {
  return allowedRoles.includes(role);
}

export function normalizeRole(value: unknown): WorkspaceRole {
  if (value === "admin" || value === "supervisor") {
    return "admin";
  }

  return "employee";
}

export function isLegacyRole(value: unknown): value is Extract<UserRole, "enumerator" | "supervisor"> {
  return value === "enumerator" || value === "supervisor";
}
