"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ReviewCase, RevisitReason } from "@/types/domain";

export function ValidationQueueClient({
  flaggedSubmissions
}: {
  flaggedSubmissions: ReviewCase[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(flaggedSubmissions);

  function inferRevisitReasons(item: ReviewCase): RevisitReason[] {
    const reasons: RevisitReason[] = [];

    if (item.riskSignals.some((signal) => signal.includes("geo"))) {
      reasons.push("retake_geo");
    }
    if (item.riskSignals.some((signal) => signal.includes("proof"))) {
      reasons.push("retake_photo");
    }
    if (item.duplicateCandidates.length) {
      reasons.push("duplicate_check");
    }
    if (item.riskSignals.some((signal) => signal.includes("address"))) {
      reasons.push("address_mismatch");
    }

    return reasons.length ? reasons : ["missing_fields"];
  }

  async function updateStatus(
    item: ReviewCase,
    action: "under_review" | "revisit_requested" | "approved" | "rejected" | "escalated"
  ) {
    try {
      const response = await fetch("/api/supervisor/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submissionId: item.currentSubmissionId,
          action,
          reviewNotes:
            action === "approved"
              ? "Supervisor approved the record after trust and duplicate review."
              : action === "revisit_requested"
                ? "Field revisit required to clear trust and validation concerns."
                : action === "under_review"
                  ? "Supervisor started reviewing this case."
                  : action === "rejected"
                    ? "Supervisor rejected the record because the evidence does not reconcile."
                    : "Supervisor escalated this record for admin review.",
          revisitReasons:
            action === "revisit_requested" ? inferRevisitReasons(item) : undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to update the review status.");
      }

      setItems((current) =>
        current
          .map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: action,
                  latestActionAt: new Date().toISOString(),
                  revisitTask:
                    action === "revisit_requested"
                      ? {
                          id: entry.revisitTask?.id ?? `${entry.id}-revisit`,
                          submissionId: entry.currentSubmissionId,
                          reviewCaseId: entry.id,
                          enumeratorId: entry.enumeratorId,
                          reasons: inferRevisitReasons(entry),
                          status: "open" as const,
                          requestedAt: new Date().toISOString(),
                          requestedBy: "current-user",
                          requestedByName: "Supervisor",
                          notes: "Follow-up required."
                        }
                      : entry.revisitTask
                }
              : entry
          )
          .filter((entry) => !["approved", "rejected"].includes(entry.status))
      );
      toast.success(`Submission ${action}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update the review status."
      );
    }
  }

  return (
    <div className="space-y-4">
      {items.length ? (
        items.map((item) => (
          <Card key={item.submissionId}>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_220px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold">{item.householdId ?? item.currentSubmissionId}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.scope.district} / {item.scope.block} • {item.enumeratorId}
                </p>
                <p className="text-sm leading-7 text-black/70">
                  {item.comments[item.comments.length - 1]?.message ??
                    "Flagged for duplicate or trust-risk review."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Risk score: {item.riskScore} • Review status: {item.status.replaceAll("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.riskSignals.map((flag) => (
                    <span key={flag} className="rounded-full bg-butter-50 px-3 py-1 text-xs font-semibold">
                      {flag.replaceAll("_", " ")}
                    </span>
                  ))}
                  {item.duplicateCandidates.map((candidate) => (
                    <span
                      key={candidate.matchedSubmissionId}
                      className="rounded-full bg-lavender-50 px-3 py-1 text-xs font-semibold"
                    >
                      duplicate {candidate.confidence}
                    </span>
                  ))}
                </div>
                {item.revisitTask ? (
                  <p className="text-sm text-muted-foreground">
                    Revisit reasons: {item.revisitTask.reasons.join(", ").replaceAll("_", " ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                <Button variant="secondary" onClick={() => updateStatus(item, "under_review")}>
                  Mark under review
                </Button>
                <Button variant="secondary" onClick={() => updateStatus(item, "revisit_requested")}>
                  Request revisit
                </Button>
                <Button onClick={() => updateStatus(item, "approved")}>Approve</Button>
                <Button variant="secondary" onClick={() => updateStatus(item, "escalated")}>
                  Escalate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No flagged records right now. The validation queue is clear.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
