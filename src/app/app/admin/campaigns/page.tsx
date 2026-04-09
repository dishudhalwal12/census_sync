import { CampaignBuilderClient } from "@/components/admin/campaign-builder-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCampaignAdminWorkspace } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminCampaignsPage() {
  const session = await requireSession(["admin"]);
  const workspace = await getCampaignAdminWorkspace(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaign builder"
        title="Design surveys, generate AI drafts, and publish tokenized access links"
        description="Create org-scoped campaign versions, assign employees, and control public participation from one admin workspace."
      />
      <CampaignBuilderClient
        campaigns={workspace.campaigns}
        versions={workspace.versions}
        links={workspace.links}
        assignments={workspace.assignments}
        users={workspace.users}
      />
    </div>
  );
}
