import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEmployeeCampaignWorkspace } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function EmployeeDashboardPage() {
  const session = await requireSession(["employee", "admin"]);
  const assignments = await getEmployeeCampaignWorkspace(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employee workspace"
        title="Collect verified campaign responses online or offline"
        description="Open assigned campaigns, capture respondent evidence, and keep queued syncs moving from one installable field workspace."
        action={{ label: "Open campaign inbox", href: "/app/employee/campaigns" }}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Campaign inbox</h3>
            {assignments.length ? (
              assignments.slice(0, 4).map((entry) => (
                <div key={entry.assignment.id} className="rounded-[1.5rem] border border-black/5 p-4">
                  <p className="font-semibold">{entry.assignment.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.campaign?.purpose}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Responses synced: {entry.responseCount}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No campaign assignments are available yet. Ask your admin to generate an employee link or assignment.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Offline-first workflow</h3>
            <div className="rounded-[1.5rem] bg-teal-50/60 p-5 text-sm text-muted-foreground">
              Open a field link once while online to cache the campaign package on this device.
              After that, you can continue collection offline and sync later.
            </div>
            <Button asChild variant="secondary">
              <Link href="/app/employee/campaigns">View all assignments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
