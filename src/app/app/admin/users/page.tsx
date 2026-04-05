import { PageHeader } from "@/components/layout/page-header";
import { UserManagementClient } from "@/components/admin/user-management-client";
import { getAdminDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function UsersPage() {
  const session = await requireSession(["admin"]);
  const { users, projects } = await getAdminDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User management"
        title="Provision roles and map assignments by district or block"
        description="Create field accounts, review role status, and keep enumerator and supervisor access aligned with current operations."
      />
      <UserManagementClient users={users} projects={projects} />
    </div>
  );
}
