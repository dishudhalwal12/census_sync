import { PageHeader } from "@/components/layout/page-header";
import { KpiGrid } from "@/components/shared/kpi-grid";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminDashboardPage() {
  const session = await requireSession(["admin"]);
  const data = await getAdminDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin operations"
        title="System-wide users, sync health, templates, and export visibility"
        description="Run CensusSync centrally with secure role management, mission publishing, version controls, audit transparency, and operational oversight."
        action={{ label: "Open mission builder", href: "/app/admin/missions" }}
      />
      <KpiGrid items={data.kpis} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Recent system activity</h3>
            {data.auditLogs.length ? (
              data.auditLogs.map((event) => (
                <div key={event.id} className="rounded-[1.75rem] bg-lavender-50 p-4">
                  <p className="font-semibold">{event.action.replaceAll("_", " ")}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.actorName} • {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                Audit activity will appear here as users are provisioned, records sync, and exports are generated.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Projects and template releases</h3>
            {data.projects.length ? (
              data.projects.map((project) => (
                <div key={project.id} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{project.name}</p>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Active template:{" "}
                    {data.templates.find((template) => template.id === project.activeTemplateVersionId)?.version ?? "Not selected"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
                No projects have been created yet. Create one in Templates to start assigning users and activating forms.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
            <p className="text-sm text-muted-foreground">Proof compliant</p>
            <p className="mt-1 text-2xl font-bold">{data.missions.snapshot.proofCompliant}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
