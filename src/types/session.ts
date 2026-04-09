import type { Scope, UserStatus, WorkspaceRole } from "@/types/domain";

export interface AuthSession {
  uid: string;
  orgId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  status: UserStatus;
  projectId?: string;
  scopes: Scope[];
  isDemo: boolean;
}
