import { PageHeader } from "@/components/layout/page-header";
import { CoverageMap } from "@/components/maps/coverage-map";
import { AlertCenter } from "@/components/shared/alert-center";
import { Card, CardContent } from "@/components/ui/card";
import { getSupervisorDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function CoverageMapPage() {
  const session = await requireSession(["admin"]);
  const data = await getSupervisorDashboardData(session);
  const points = data.coveragePoints;
  const missingCoordinates = data.submissions.filter((submission) => !submission.geo).length;
  const coverageConfidence = data.submissions.length
    ? Math.round((points.length / data.submissions.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coverage map"
        title="Geo-tagged district coverage at a glance"
        description="Verify where enumerators have collected data, which records are missing coordinates, and where coverage gaps still remain."
      />
      <CoverageMap points={points} />
      <AlertCenter alerts={data.alerts.filter((alert) => alert.relatedEntityType === "coverage_gap")} title="Coverage alerts" />
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm text-muted-foreground">Geo-tagged</p>
            <p className="mt-1 text-2xl font-bold">{points.length}</p>
          </div>
          <div className="rounded-2xl bg-butter-50 p-4">
            <p className="text-sm text-muted-foreground">Missing coordinates</p>
            <p className="mt-1 text-2xl font-bold">{missingCoordinates}</p>
          </div>
          <div className="rounded-2xl bg-peach-50 p-4">
            <p className="text-sm text-muted-foreground">Coverage confidence</p>
            <p className="mt-1 text-2xl font-bold">{coverageConfidence}%</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold">Gap summary by scope</h3>
          {data.coverageGaps.map((gap) => (
            <div key={gap.id} className="rounded-[1.5rem] border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {gap.scope.district} / {gap.scope.block}
                </p>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">
                  {gap.riskLevel}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {gap.approvedCount} approved of {gap.targetCount} target • {gap.revisitBacklog} revisit backlog
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
