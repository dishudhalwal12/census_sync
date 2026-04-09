import { PageHeader } from "@/components/layout/page-header";
import { MissionWorkspace } from "@/components/missions/mission-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { getMissionPackageByAssignmentId } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function MissionWorkspacePage({
  params
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireSession(["employee", "admin"]);
  const { assignmentId } = await params;
  const missionPackage = await getMissionPackageByAssignmentId(assignmentId, session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mission workspace"
        title="Geofenced census execution with proof-of-visit"
        description="Answer the configured census questions, stay inside the assigned radius, and attach one proof photo before the mission is queued for sync."
      />
      {missionPackage ? (
        <MissionWorkspace
          session={session}
          initialPackage={missionPackage}
          assignmentId={assignmentId}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This mission is not assigned to the current enumerator, or it has not been cached on
            this device yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
