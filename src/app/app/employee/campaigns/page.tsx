import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEmployeeCampaignWorkspace } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function EmployeeCampaignInboxPage() {
  const session = await requireSession(["employee", "admin"]);
  const assignments = await getEmployeeCampaignWorkspace(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaign inbox"
        title="Assigned campaigns and cached field workspaces"
        description="Continue work from assignment cards after the original secure field link has been opened once."
      />

      <div className="grid gap-6">
        {assignments.length ? (
          assignments.map((entry) => (
            <Card key={entry.assignment.id}>
              <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xl font-semibold">{entry.assignment.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.campaign?.purpose}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.assignment.scope
                      ? [entry.assignment.scope.district, entry.assignment.scope.block, entry.assignment.scope.cluster]
                          .filter(Boolean)
                          .join(" / ")
                      : "General field collection"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium">
                    {entry.responseCount} response(s)
                  </div>
                  <Button asChild>
                    <Link href={`/app/employee/campaigns/${entry.assignment.id}`}>Open workspace</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No assignments are cached for this employee yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
