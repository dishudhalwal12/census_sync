import { CommandCenter } from "@/components/admin/command-center";
import { PageHeader } from "@/components/layout/page-header";
import { getAdminDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminCommandCenterPage() {
  const session = await requireSession(["admin"]);
  const data = await getAdminDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command center"
        title="Trust, coverage, and operational readiness in one executive view"
        description="A viva-friendly admin command board for alerts, review pressure, route readiness, and predictive completion insight."
      />
      <CommandCenter
        alerts={data.alerts}
        coverageGaps={data.coverageGaps}
        scorecards={data.scorecards}
        predictions={data.predictions}
        reviewCases={data.reviewCases}
        routePlans={data.routePlans}
      />
    </div>
  );
}
