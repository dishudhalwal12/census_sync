import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCampaignAdminWorkspace, getCampaignAnalytics } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminDashboardPage() {
  const session = await requireSession(["admin"]);
  const [workspace, analytics] = await Promise.all([
    getCampaignAdminWorkspace(session),
    getCampaignAnalytics(session)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Run multi-tenant census campaigns from creation through live analytics"
        description="Publish AI-assisted campaign versions, issue employee and public links, invite users, and monitor verified response flow from one org-scoped console."
        action={{ label: "Open campaign builder", href: "/app/admin/campaigns" }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Campaigns", workspace.campaigns.length],
          ["Assignments", workspace.assignments.length],
          ["Links", workspace.links.length],
          ["Responses", analytics.summary.totalResponses],
          ["Users", workspace.users.length]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Recent campaigns</h3>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/admin/campaigns">Manage campaigns</Link>
              </Button>
            </div>
            {workspace.campaigns.length ? (
              workspace.campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-[1.5rem] border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{campaign.name}</p>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">
                      {campaign.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{campaign.purpose}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {campaign.collectionMode.replaceAll("_", " ")}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No campaigns are published yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Workspace shortcuts</h3>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/admin/analytics">Open analytics</Link>
              </Button>
            </div>
            {[
              {
                label: "Campaign builder",
                href: "/app/admin/campaigns",
                description: "Generate AI drafts, publish versions, and issue links."
              },
              {
                label: "Analytics",
                href: "/app/admin/analytics",
                description: "Track real-time response volume, question breakdowns, and map points."
              },
              {
                label: "Users",
                href: "/app/admin/users",
                description: "Invite employees and provision additional organization admins."
              }
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-[1.5rem] border border-black/5 p-4 transition hover:bg-black/5"
              >
                <p className="font-semibold">{item.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
