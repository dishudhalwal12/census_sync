import type { Scope, UserRole, UserStatus } from "@/types/domain";

export interface AuthSession {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  projectId?: string;
  scopes: Scope[];
  isDemo: boolean;
}
