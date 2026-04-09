import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEnumeratorDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function EnumeratorSubmissionsPage() {
  const session = await requireSession(["employee", "admin"]);
  const data = await getEnumeratorDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Submission history"
        title="Track synced, pending, failed, and flagged household records"
        description="Your submission timeline includes validation status, assignment scope, and the final sync state for each household."
      />
      <Card>
        <CardContent className="overflow-x-auto p-6">
          {data.submissions.length ? (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pb-3">Household</th>
                  <th className="pb-3">Scope</th>
                  <th className="pb-3">Validation</th>
                  <th className="pb-3">Sync</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((submission) => (
                  <tr key={submission.submissionId} className="border-t border-black/5">
                    <td className="py-4">
                      <p className="font-semibold">{submission.householdId}</p>
                      <p className="text-muted-foreground">{submission.headOfHousehold}</p>
                    </td>
                    <td className="py-4">
                      {submission.scope.district} / {submission.scope.block}
                    </td>
                    <td className="py-4">
                      <StatusBadge status={submission.validationStatus} />
                    </td>
                    <td className="py-4">
                      <StatusBadge status={submission.syncStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-muted-foreground">
              No synced submissions yet. Complete a field record and sync it to see history here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
