import { Badge } from "@/components/ui/badge";
import type {
  AssignmentActivationStatus,
  ReviewCaseStatus,
  SubmissionSyncStatus,
  SubmissionValidationStatus
} from "@/types/domain";

export function StatusBadge({
  status
}: {
  status:
    | SubmissionSyncStatus
    | SubmissionValidationStatus
    | AssignmentActivationStatus
    | ReviewCaseStatus
    | "pending"
    | "under_review"
    | "revisit_requested";
}) {
  const variant =
    status === "synced" ||
    status === "approved" ||
    status === "completed" ||
    status === "open"
      ? "success"
    : status === "flagged" ||
          status === "pending_sync" ||
          status === "pending" ||
          status === "sent" ||
          status === "opened" ||
          status === "in_progress" ||
          status === "under_review" ||
          status === "revisit_requested"
        ? "warning"
        : status === "failed" || status === "rejected" || status === "escalated"
          ? "danger"
          : "default";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
