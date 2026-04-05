import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsPanels } from "@/components/charts/analytics-panels";
import { KpiGrid } from "@/components/shared/kpi-grid";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSupervisorDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function SupervisorDashboardPage() {
  const session = await requireSession(["supervisor", "admin"]);
  const data = await getSupervisorDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisor dashboard"
        title="Validation, coverage, and field performance in one live district view"
        description="Monitor census progress, inspect flagged submissions, compare demographic distributions, and keep mission proof operations moving across the active survey scope."
        action={{ label: "Open mission ops", href: "/app/supervisor/missions" }}
      />
      <KpiGrid items={data.kpis} />
      <AnalyticsPanels submissions={data.submissions} />
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm text-muted-foreground">Mission links sent</p>
            <p className="mt-1 text-2xl font-bold">{data.missions.snapshot.sent}</p>
          </div>
          <div className="rounded-2xl bg-peach-50 p-4">
            <p className="text-sm text-muted-foreground">Opened</p>
            <p className="mt-1 text-2xl font-bold">{data.missions.snapshot.opened}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-bold">{data.missions.snapshot.completed}</p>
          </div>
          <div className="rounded-2xl bg-butter-50 p-4">
            <p className="text-sm text-muted-foreground">Geo anomaly flags</p>
            <p className="mt-1 text-2xl font-bold">{data.missions.snapshot.failedGeoChecks}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Validation backlog</h3>
            {data.flagged.length ? (
              data.flagged.map((submission) => (
                <div key={submission.submissionId} className="rounded-[1.75rem] bg-butter-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{submission.householdId}</p>
                      <p className="text-sm text-muted-foreground">{submission.validationMessage}</p>
                    </div>
                    <StatusBadge status={submission.validationStatus} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No flagged submissions are waiting for review in your current project scope.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="overflow-x-auto p-6">
            <h3 className="mb-4 text-xl font-semibold">Enumerator performance</h3>
            {data.submissions.length ? (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-3">Enumerator</th>
                    <th className="pb-3">Submissions</th>
                    <th className="pb-3">Flagged</th>
                    <th className="pb-3">Average members</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(data.submissions.map((item) => item.enumeratorId))).map((enumeratorId) => {
                    const subset = data.submissions.filter((item) => item.enumeratorId === enumeratorId);
                    const flagged = subset.filter((item) => item.validationStatus === "flagged").length;
                    const averageMembers = subset.length
                      ? (
                          subset.reduce((sum, item) => sum + item.members.length, 0) / subset.length
                        ).toFixed(1)
                      : "0.0";

                    return (
                      <tr key={enumeratorId} className="border-t border-black/5">
                        <td className="py-4">{subset[0]?.enumeratorName}</td>
                        <td className="py-4">{subset.length}</td>
                        <td className="py-4">{flagged}</td>
                        <td className="py-4">{averageMembers}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-muted-foreground">
                Enumerator performance will appear here once records are synced into this scope.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
