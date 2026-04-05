"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { HouseholdSubmission } from "@/types/domain";

export function ValidationQueueClient({
  flaggedSubmissions
}: {
  flaggedSubmissions: HouseholdSubmission[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(flaggedSubmissions);

  async function updateStatus(submissionId: string, action: "resolved" | "escalated") {
    try {
      const response = await fetch("/api/supervisor/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submissionId,
          action,
          reviewNotes:
            action === "resolved"
              ? "Supervisor resolved the duplicate or validation issue."
              : "Supervisor escalated this record for admin review."
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to update the review status.");
      }

      setItems((current) =>
        action === "resolved"
          ? current.filter((item) => item.submissionId !== submissionId)
          : current.map((item) =>
              item.submissionId === submissionId
                ? {
                    ...item,
                    reviewStatus: "escalated",
                    validationMessage: "Escalated to admin for further review."
                  }
                : item
            )
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
                  <h3 className="text-xl font-semibold">{item.householdId}</h3>
                  <StatusBadge status={item.validationStatus} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.scope.district} / {item.scope.block} • {item.enumeratorName}
                </p>
                <p className="text-sm leading-7 text-black/70">
                  {item.validationMessage ?? "Flagged for duplicate or validation review."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Review status: {item.reviewStatus.replaceAll("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.flags.map((flag) => (
                    <span key={flag} className="rounded-full bg-butter-50 px-3 py-1 text-xs font-semibold">
                      {flag.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Button variant="secondary" onClick={() => updateStatus(item.submissionId, "resolved")}>
                  Resolve
                </Button>
                <Button onClick={() => updateStatus(item.submissionId, "escalated")}>Escalate</Button>
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
