import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { KpiGrid } from "@/components/shared/kpi-grid";
import { StatusBadge } from "@/components/shared/status-badge";
import { SyncOverview } from "@/components/sync/sync-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEnumeratorDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function EnumeratorDashboardPage() {
  const session = await requireSession(["employee", "admin"]);
  const data = await getEnumeratorDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enumerator workspace"
        title="Capture field records with confidence in low-connectivity environments"
        description="Review your assigned censuses, queue health, and recent submissions before opening a secure mission or using the legacy household form."
        action={{ label: "Open assigned censuses", href: "/app/enumerator/missions" }}
      />
      <KpiGrid items={data.kpis} />
      <SyncOverview session={session} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Revisit task inbox</h3>
              <span className="rounded-full bg-butter-50 px-3 py-1 text-xs font-semibold">
                {data.revisitTasks.length} open
              </span>
            </div>
            {data.revisitTasks.length ? (
              data.revisitTasks.map((task) => (
                <div key={task.id} className="rounded-[1.75rem] bg-butter-50 p-5">
                  <p className="font-semibold">{task.reviewCaseId}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reasons: {task.reasons.join(", ").replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{task.notes}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No revisit tasks are waiting right now. Approved and low-risk work will appear here only when follow-up is needed.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Suggested route plan</h3>
              <span className="rounded-full bg-lavender-50 px-3 py-1 text-xs font-semibold">
                {data.routePlan?.totalDistanceMeters ?? 0} m
              </span>
            </div>
            {data.routePlan?.stops.length ? (
              data.routePlan.stops.map((stop) => (
                <div key={stop.id} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <p className="font-semibold">
                    {stop.order}. {stop.label}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reason: {stop.reason.replaceAll("_", " ")} • {stop.latitude.toFixed(3)}, {stop.longitude.toFixed(3)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                Route suggestions will appear once missions or revisit tasks have map coordinates.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Assigned census missions</h3>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/settings">View settings</Link>
              </Button>
            </div>
            {data.missionPackages.length ? (
              data.missionPackages.map((pkg) => (
                <div key={pkg.assignment.id} className="rounded-[1.75rem] bg-lavender-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{pkg.assignment.label}</p>
                    <StatusBadge status={pkg.assignment.activationStatus ?? "sent"} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{pkg.project.objective}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pkg.assignment.scope.district} / {pkg.assignment.scope.block} / {pkg.assignment.scope.cluster}
                  </p>
                </div>
              ))
            ) : data.assignments.length ? (
              data.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-[1.75rem] bg-lavender-50 p-5">
                  <p className="font-semibold">{assignment.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {assignment.scope.district} / {assignment.scope.block} / {assignment.scope.cluster}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Target: {assignment.targetCount ?? 0} records
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No active assignments yet. Once an admin assigns your project scope, it will appear here.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Recent submissions</h3>
            {data.missionSubmissions.length ? (
              data.missionSubmissions.map((submission) => (
                <div key={submission.submissionId} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{submission.assignmentId}</p>
                      <p className="text-sm text-muted-foreground">
                        {submission.evidence.fileName}
                      </p>
                    </div>
                    <StatusBadge status={submission.validationStatus} />
                  </div>
                </div>
              ))
            ) : data.submissions.length ? (
              data.submissions.map((submission) => (
                <div key={submission.submissionId} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{submission.householdId}</p>
                      <p className="text-sm text-muted-foreground">{submission.headOfHousehold}</p>
                    </div>
                    <StatusBadge status={submission.validationStatus} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No synced submissions yet. Your first completed field record will appear here after sync.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
