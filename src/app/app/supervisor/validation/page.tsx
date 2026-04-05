import { PageHeader } from "@/components/layout/page-header";
import { ValidationQueueClient } from "@/components/supervisor/validation-queue-client";
import { getSupervisorDashboardData } from "@/lib/data/server";
import { requireSession } from "@/lib/server/session";

export default async function ValidationPage() {
  const session = await requireSession(["supervisor", "admin"]);
  const data = await getSupervisorDashboardData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Validation queue"
        title="Review flagged and duplicate submissions"
        description="Inspect validation failures, resolve duplicate household records, or escalate suspicious entries for central review."
      />
      <ValidationQueueClient flaggedSubmissions={data.flagged} />
    </div>
  );
}
