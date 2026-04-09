import type { WorkspaceRole } from "@/types/domain";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  employee: "Employee",
  admin: "Administrator"
};

export const APP_NAME = "CensusSync";
export const APP_DESCRIPTION =
  "Offline-first census campaigns for employees, public participants, and administrators.";

export const ROLE_HOME: Record<WorkspaceRole, string> = {
  employee: "/app/employee",
  admin: "/app/admin"
};

export const NAV_BY_ROLE: Record<WorkspaceRole, { label: string; href: string }[]> = {
  employee: [
    { label: "Overview", href: "/app/employee" },
    { label: "Campaign Inbox", href: "/app/employee/campaigns" },
    { label: "Settings", href: "/app/settings" }
  ],
  admin: [
    { label: "Overview", href: "/app/admin" },
    { label: "Campaign Builder", href: "/app/admin/campaigns" },
    { label: "Analytics", href: "/app/admin/analytics" },
    { label: "Users", href: "/app/admin/users" },
    { label: "Legacy Ops", href: "/app/admin/command-center" },
    { label: "Settings", href: "/app/settings" }
  ]
};

export const LANDING_NAV = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "Workflows", href: "#workflows" },
  { label: "Resources", href: "#resources" },
  { label: "Pricing", href: "#pricing" }
];
