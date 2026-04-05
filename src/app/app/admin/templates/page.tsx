import { PageHeader } from "@/components/layout/page-header";
import { TemplateManagementClient } from "@/components/admin/template-management-client";
import { getAdminDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function TemplatesPage() {
  const session = await requireSession(["admin"]);
  const { templates, projects } = await getAdminDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Template versions"
        title="Manage active census schemas without losing backwards compatibility"
        description="Control release versions, publish the current form template, and maintain a clear record of schema evolution. Use Mission Builder for assignment-linked census missions."
        action={{ label: "Mission builder", href: "/app/admin/missions" }}
      />
      <TemplateManagementClient templates={templates} projects={projects} />
    </div>
  );
}
