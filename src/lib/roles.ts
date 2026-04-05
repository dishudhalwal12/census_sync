import type { UserRole } from "@/types/domain";

export function isRole(value: string): value is UserRole {
  return value === "enumerator" || value === "supervisor" || value === "admin";
}

export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}
