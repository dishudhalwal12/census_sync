import { CampaignWorkspace } from "@/components/employee/campaign-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { getCampaignFieldPackageByAssignmentId } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function EmployeeCampaignWorkspacePage({
  params
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const session = await requireSession(["employee", "admin"]);
  const pkg = await getCampaignFieldPackageByAssignmentId(assignmentId, session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field workspace"
        title="Continue a cached employee campaign assignment"
        description="If this assignment was previously opened from its secure field link, the workspace can continue from the local cache even when connectivity drops."
      />
      <CampaignWorkspace session={session} initialPackage={pkg} assignmentId={assignmentId} />
    </div>
  );
}
