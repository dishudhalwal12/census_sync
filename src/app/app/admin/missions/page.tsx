import { PageHeader } from "@/components/layout/page-header";
import { MissionBuilderClient } from "@/components/missions/mission-builder-client";
import { MissionOperationsClient } from "@/components/missions/mission-operations-client";
import { getAdminDashboardData, getMissionOperationsData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminMissionsPage() {
  const session = await requireSession(["admin"]);
  const [{ users }, missions] = await Promise.all([
    getAdminDashboardData(session),
    getMissionOperationsData(session)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mission builder"
        title="Publish secure census missions with geofence and proof controls"
        description="Create the mission, assign the enumerator, publish the secure field link, and monitor proof-backed completion from one admin workflow."
      />
      <MissionBuilderClient users={users} missionPackages={missions.packages} />
      <MissionOperationsClient
        packages={missions.packages}
        submissions={missions.submissions}
        snapshot={missions.snapshot}
        coveragePoints={missions.coveragePoints}
      />
    </div>
  );
}
