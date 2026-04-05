import type { UserRole } from "@/types/domain";

export const ROLE_LABELS: Record<UserRole, string> = {
  enumerator: "Enumerator",
  supervisor: "Supervisor",
  admin: "Administrator"
};

export const APP_NAME = "CensusSync";
export const APP_DESCRIPTION =
  "Offline-first field survey operations for enumerators, supervisors, and administrators.";

export const ROLE_HOME: Record<UserRole, string> = {
  enumerator: "/app/enumerator",
  supervisor: "/app/supervisor",
  admin: "/app/admin"
};

export const NAV_BY_ROLE: Record<UserRole, { label: string; href: string }[]> = {
  enumerator: [
    { label: "Overview", href: "/app/enumerator" },
    { label: "Assigned Censuses", href: "/app/enumerator/missions" },
    { label: "Legacy Household Form", href: "/app/enumerator/forms/new" },
    { label: "Drafts & Queue", href: "/app/enumerator/drafts" },
    { label: "Submission History", href: "/app/enumerator/submissions" },
    { label: "Settings", href: "/app/settings" }
  ],
  supervisor: [
    { label: "Overview", href: "/app/supervisor" },
    { label: "Mission Ops", href: "/app/supervisor/missions" },
    { label: "Validation Queue", href: "/app/supervisor/validation" },
    { label: "Coverage Map", href: "/app/supervisor/map" },
    { label: "Reports", href: "/app/supervisor/reports" },
    { label: "Settings", href: "/app/settings" }
  ],
  admin: [
    { label: "Overview", href: "/app/admin" },
    { label: "Mission Builder", href: "/app/admin/missions" },
    { label: "Users", href: "/app/admin/users" },
    { label: "Templates", href: "/app/admin/templates" },
    { label: "Audit Logs", href: "/app/admin/audit" },
    { label: "Reports", href: "/app/supervisor/reports" },
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
