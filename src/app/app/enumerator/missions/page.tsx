import { AssignedMissionsClient } from "@/components/missions/assigned-missions-client";
import { PageHeader } from "@/components/layout/page-header";
import { getMissionPackages } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function AssignedMissionsPage() {
  const session = await requireSession(["enumerator"]);
  const missionPackages = await getMissionPackages(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assigned censuses"
        title="Secure mission links and offline-ready field assignments"
        description="Each mission unlocks only inside its configured geofence, saves locally on this device, and requires proof-of-visit before sync."
      />
      <AssignedMissionsClient session={session} initialPackages={missionPackages} />
    </div>
  );
}
