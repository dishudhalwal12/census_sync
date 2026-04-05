"use client";

import { jsPDF } from "jspdf";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExportRequest, HouseholdSubmission, Project } from "@/types/domain";

function downloadBlob(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsExporter({
  submissions,
  exportsHistory,
  projects
}: {
  submissions: HouseholdSubmission[];
  exportsHistory: ExportRequest[];
  projects: Project[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectId, setProjectId] = useState("all");

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        (projectId === "all" ? true : submission.projectId === projectId) &&
        (statusFilter === "all"
          ? true
          : submission.validationStatus === statusFilter ||
            submission.syncStatus === statusFilter ||
            submission.reviewStatus === statusFilter)
      ),
    [projectId, statusFilter, submissions]
  );

  async function fetchExportRows(format: "csv" | "pdf") {
    const response = await fetch("/api/reports/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        format,
        projectId: projectId === "all" ? undefined : projectId,
        filters: {
          status: statusFilter === "all" ? undefined : statusFilter
        }
      })
    });
    const payload = (await response.json()) as {
      message?: string;
      rows: Array<{
        householdId: string;
        headOfHousehold: string;
        district: string;
        block: string;
        members: number;
        syncStatus: string;
        validationStatus: string;
        reviewStatus: string;
        capturedAt: string;
      }>;
    };

    if (!response.ok) {
      throw new Error(payload.message ?? "Unable to generate the export.");
    }

    return payload;
  }

  async function exportCsv() {
    try {
      const payload = await fetchExportRows("csv");
      const csv = Papa.unparse(payload.rows);
      downloadBlob(
        "censussync-export.csv",
        new Blob([csv], { type: "text/csv;charset=utf-8;" })
      );
      toast.success("CSV export downloaded.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate the CSV export."
      );
    }
  }

  async function exportPdf() {
    try {
      const payload = await fetchExportRows("pdf");
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("CensusSync Export Summary", 14, 20);
      doc.setFontSize(11);
      payload.rows.slice(0, 12).forEach((submission, index) => {
        doc.text(
          `${submission.householdId} • ${submission.headOfHousehold} • ${submission.block} • ${submission.validationStatus}`,
          14,
          35 + index * 10
        );
      });
      doc.save("censussync-export.pdf");
      toast.success("PDF export downloaded.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate the PDF export."
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h3 className="text-xl font-semibold">Export builder</h3>
            <p className="text-sm text-muted-foreground">
              Generate operational CSV or PDF packs from the filtered dashboard dataset.
            </p>
          </div>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
          >
            <option value="all">All accessible projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 w-full rounded-2xl border border-white/70 bg-white px-4 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="pending_sync">Pending sync</option>
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => void exportCsv()}>Download CSV</Button>
            <Button variant="secondary" onClick={() => void exportPdf()}>
              Download PDF
            </Button>
          </div>
          <div className="rounded-[1.75rem] bg-lavender-50 p-4 text-sm text-muted-foreground">
            {filteredSubmissions.length} record(s) match the current report filter.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold">Export history</h3>
          {exportsHistory.map((item) => (
            <div key={item.id} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold uppercase">{item.format}</p>
                  <p className="text-sm text-muted-foreground">
                    Requested by {item.requesterName} on {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
