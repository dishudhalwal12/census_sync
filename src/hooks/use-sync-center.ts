"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition } from "react";
import { toast } from "sonner";

import { listMissionQueueItems, syncMissionQueue } from "@/lib/missions/service";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getDrafts, listQueueItems, syncQueue } from "@/lib/offline/service";
import type { AuthSession } from "@/types/session";

export function useSyncCenter(session: AuthSession) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const draftsQuery = useQuery({
    queryKey: ["drafts", session.uid],
    queryFn: () => getDrafts(session.uid)
  });

  const queueQuery = useQuery({
    queryKey: ["sync-queue", session.uid],
    queryFn: () => listQueueItems(session.uid)
  });

  const missionQueueQuery = useQuery({
    queryKey: ["mission-sync-queue", session.uid],
    queryFn: () => listMissionQueueItems(session.uid)
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["drafts", session.uid] }),
      queryClient.invalidateQueries({ queryKey: ["sync-queue", session.uid] }),
      queryClient.invalidateQueries({ queryKey: ["mission-sync-queue", session.uid] })
    ]);
  }

  async function runSync() {
    if (!isOnline) {
      toast.warning("You are offline. Sync will resume automatically once connectivity returns.");
      return;
    }

    startTransition(async () => {
      const [householdResults, missionResults] = await Promise.all([
        syncQueue(session),
        syncMissionQueue(session)
      ]);
      const results = [...householdResults, ...missionResults];
      await refresh();

      const failures = results.filter((result) => result.status === "failed");
      if (failures.length) {
        toast.error(`${failures.length} record(s) still need attention in the queue.`);
        return;
      }

      if (results.length) {
        toast.success(`${results.length} queued record(s) processed successfully.`);
      }
    });
  }

  return {
    isOnline,
    drafts: draftsQuery.data ?? [],
    queue: queueQuery.data ?? [],
    missionQueue: missionQueueQuery.data ?? [],
    refresh,
    runSync,
    isLoading:
      draftsQuery.isLoading || queueQuery.isLoading || missionQueueQuery.isLoading
  };
}
