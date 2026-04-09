import { PageHeader } from "@/components/layout/page-header";
import { UserManagementClient } from "@/components/admin/user-management-client";
import { getCampaignAdminWorkspace } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function UsersPage() {
  const session = await requireSession(["admin"]);
  const { users } = await getCampaignAdminWorkspace(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User management"
        title="Invite employees and assign organization admins"
        description="Employee access is invite-only after the first organization admin is created."
      />
      <UserManagementClient users={users} />
    </div>
  );
}
