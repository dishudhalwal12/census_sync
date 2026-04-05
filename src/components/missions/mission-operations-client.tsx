"use client";

import { jsPDF } from "jspdf";
import { Download, ShieldAlert } from "lucide-react";

import { MissionCoverageMap } from "@/components/missions/mission-coverage-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MissionAssignmentPackage,
  MissionCoveragePoint,
  MissionOperationsSnapshot,
  MissionSubmission
} from "@/types/domain";

function downloadProofPack(
  submission: MissionSubmission,
  pkg?: MissionAssignmentPackage
) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("CensusSync Mission Proof Pack", 14, 20);
  doc.setFontSize(11);
  const lines = [
    `Mission: ${pkg?.assignment.label ?? submission.assignmentId}`,
    `Project: ${pkg?.project.name ?? submission.projectId}`,
    `Enumerator: ${submission.enumeratorName}`,
    `Submitted: ${new Date(submission.capturedAt).toLocaleString()}`,
    `Start distance: ${submission.geoCheckAtStart.distanceMeters} m`,
    `Submit distance: ${submission.geoCheckAtSubmit.distanceMeters} m`,
    `Proof file: ${submission.evidence.fileName}`,
    `Proof URL: ${submission.evidence.downloadUrl ?? "Stored in Firebase Storage"}`,
    `Validation: ${submission.validationStatus}`,
    `Anomaly flags: ${submission.anomalyFlags.length ? submission.anomalyFlags.join(", ") : "None"}`
  ];

  lines.forEach((line, index) => {
    doc.text(line, 14, 35 + index * 9);
  });

  let cursor = 35 + lines.length * 9 + 8;
  doc.setFontSize(13);
  doc.text("Answer summary", 14, cursor);
  cursor += 8;
  doc.setFontSize(10);
  Object.entries(submission.answers).forEach(([key, value]) => {
    doc.text(`${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`, 14, cursor);
    cursor += 7;
  });

  doc.save(`mission-proof-${submission.submissionId}.pdf`);
}

export function MissionOperationsClient({
  packages,
  submissions,
  snapshot,
  coveragePoints
}: {
  packages: MissionAssignmentPackage[];
  submissions: MissionSubmission[];
  snapshot: MissionOperationsSnapshot;
  coveragePoints: MissionCoveragePoint[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm text-muted-foreground">Opened</p>
            <p className="mt-1 text-2xl font-bold">{snapshot.opened}</p>
          </div>
          <div className="rounded-2xl bg-peach-50 p-4">
            <p className="text-sm text-muted-foreground">In progress</p>
            <p className="mt-1 text-2xl font-bold">{snapshot.inProgress}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-muted-foreground">Proof compliant</p>
            <p className="mt-1 text-2xl font-bold">{snapshot.proofCompliant}</p>
          </div>
          <div className="rounded-2xl bg-butter-50 p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="mt-1 text-2xl font-bold">{snapshot.overdue}</p>
          </div>
        </CardContent>
      </Card>

      <MissionCoverageMap points={coveragePoints} />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold">Mission funnel and proof review</h3>
              <p className="text-sm text-muted-foreground">
                Review assignment status, anomaly flags, and export-ready proof packs.
              </p>
            </div>
            <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium">
              Capacity limit {snapshot.capacityLimit}
            </div>
          </div>

          <div className="space-y-3">
            {packages.map((pkg) => {
              const submission = submissions.find(
                (item) => item.assignmentId === pkg.assignment.id
              );

              return (
                <div
                  key={pkg.assignment.id}
                  className="rounded-[1.75rem] border border-black/5 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={pkg.assignment.activationStatus ?? "sent"} />
                        {submission?.anomalyFlags.length ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {submission.anomalyFlags.join(", ").replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold">{pkg.assignment.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {pkg.assignee?.name ?? "Assigned enumerator"} • {pkg.assignment.scope.district} / {pkg.assignment.scope.block}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Share link: /field/{pkg.assignment.shareCode}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {submission ? (
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => downloadProofPack(submission, pkg)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Proof pack
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {submission ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-lavender-50 p-4">
                        <p className="text-sm text-muted-foreground">Submit distance</p>
                        <p className="mt-1 text-2xl font-bold">
                          {submission.geoCheckAtSubmit.distanceMeters} m
                        </p>
                      </div>
                      <div className="rounded-2xl bg-peach-50 p-4">
                        <p className="text-sm text-muted-foreground">Proof photo</p>
                        <p className="mt-1 text-base font-semibold">{submission.evidence.fileName}</p>
                      </div>
                      <div className="rounded-2xl bg-butter-50 p-4">
                        <p className="text-sm text-muted-foreground">Validation</p>
                        <p className="mt-1 text-base font-semibold">{submission.validationMessage}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-black/10 p-4 text-sm text-muted-foreground">
                      No completed mission submission has been synced for this assignment yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
