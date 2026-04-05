import { PageHeader } from "@/components/layout/page-header";
import { ReportsExporter } from "@/components/reports/reports-exporter";
import { getExportRequests, getProjects, getSubmissions } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function ReportsPage() {
  const session = await requireSession(["supervisor", "admin"]);
  const [submissions, exportsHistory, projects] = await Promise.all([
    getSubmissions(session),
    getExportRequests(session),
    getProjects(session)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports and exports"
        title="Build district-ready CSV and PDF outputs"
        description="Filtered exports are available for operational reporting, archival workflows, and policy review packs."
      />
      <ReportsExporter
        submissions={submissions}
        exportsHistory={exportsHistory}
        projects={projects}
      />
    </div>
  );
}
