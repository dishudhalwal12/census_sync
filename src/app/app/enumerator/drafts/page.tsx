import { PageHeader } from "@/components/layout/page-header";
import { DraftsQueueClient } from "@/components/sync/drafts-queue-client";
import { requireSession } from "@/lib/server/session";

export default async function DraftsPage() {
  const session = await requireSession(["employee", "admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Drafts and pending sync"
        title="Resume local work and monitor the offline queue"
        description="All drafts persist in IndexedDB, and every queued submission keeps its own retry-safe sync status."
      />
      <DraftsQueueClient session={session} />
    </div>
  );
}
