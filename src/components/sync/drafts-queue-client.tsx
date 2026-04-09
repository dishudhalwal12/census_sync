"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteDraft } from "@/lib/offline/service";
import { useSyncCenter } from "@/hooks/use-sync-center";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AuthSession } from "@/types/session";

export function DraftsQueueClient({ session }: { session: AuthSession }) {
  const router = useRouter();
  const { drafts, queue, runSync, isOnline, refresh } = useSyncCenter(session);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Saved drafts</h3>
            <span className="text-sm text-muted-foreground">{drafts.length} local draft(s)</span>
          </div>
          <div className="space-y-3">
            {drafts.length ? (
              drafts.map((draft) => (
                <div key={draft.id} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{draft.householdId || "Untitled household draft"}</p>
                      <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                        Updated {new Date(draft.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/app/enumerator/forms/new?draft=${draft.submissionId}`}>Resume</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await deleteDraft(draft.submissionId, session.uid);
                          await refresh();
                          toast.success("Draft removed.");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-6 text-sm text-muted-foreground">
                No drafts yet. Start a new household form and autosave will appear here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Pending sync queue</h3>
              <p className="text-sm text-muted-foreground">
                {isOnline ? "Connected" : "Offline"} - background retries preserve idempotency.
              </p>
            </div>
            <Button onClick={runSync}>Retry sync</Button>
          </div>
          <div className="space-y-3">
            {queue.length ? (
              queue.map((item) => (
                <div key={item.id} className="rounded-[1.75rem] border border-black/5 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.householdId}</p>
                      <p className="text-sm text-muted-foreground">
                        Attempts: {item.attempts} {item.error ? `• ${item.error}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-black/10 p-6 text-sm text-muted-foreground">
                Queue is clear. Synced items will disappear from this local queue once acknowledged.
              </div>
            )}
          </div>
          <Button variant="secondary" asChild>
            <Link href="/app/enumerator/forms/new" onClick={() => router.refresh()}>
              Capture another household
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
