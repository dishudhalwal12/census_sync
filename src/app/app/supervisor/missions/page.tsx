import { PageHeader } from "@/components/layout/page-header";
import { MissionOperationsClient } from "@/components/missions/mission-operations-client";
import { getMissionOperationsData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function SupervisorMissionOpsPage() {
  const session = await requireSession(["admin"]);
  const missions = await getMissionOperationsData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mission operations"
        title="Proof-backed census execution across assigned field missions"
        description="Track opens, in-progress missions, completed proof packs, geofence anomalies, and final map points from one supervisor view."
      />
      <MissionOperationsClient
        packages={missions.packages}
        submissions={missions.submissions}
        snapshot={missions.snapshot}
        coveragePoints={missions.coveragePoints}
      />
    </div>
  );
}
