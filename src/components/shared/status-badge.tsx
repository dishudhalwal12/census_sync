import { Badge } from "@/components/ui/badge";
import type {
  AssignmentActivationStatus,
  SubmissionSyncStatus,
  SubmissionValidationStatus
} from "@/types/domain";

export function StatusBadge({
  status
}: {
  status: SubmissionSyncStatus | SubmissionValidationStatus | AssignmentActivationStatus | "pending";
}) {
  const variant =
    status === "synced" || status === "approved" || status === "completed"
      ? "success"
      : status === "flagged" ||
          status === "pending_sync" ||
          status === "pending" ||
          status === "sent" ||
          status === "opened" ||
          status === "in_progress"
        ? "warning"
        : status === "failed" || status === "rejected"
          ? "danger"
          : "default";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
