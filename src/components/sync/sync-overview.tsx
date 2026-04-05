"use client";

import Link from "next/link";
import { RefreshCcw, Wifi, WifiOff } from "lucide-react";

import { useSyncCenter } from "@/hooks/use-sync-center";
import type { AuthSession } from "@/types/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

export function SyncOverview({ session }: { session: AuthSession }) {
  const { drafts, queue, missionQueue, isOnline, runSync } = useSyncCenter(session);
  const totalQueue = queue.length + missionQueue.length;
  const totalFailures =
    queue.filter((item) => item.status === "failed").length +
    missionQueue.filter((item) => item.status === "failed").length;

  return (
    <Card>
      <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={isOnline ? "synced" : "pending_sync"} />
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {isOnline ? "Connected and ready to sync" : "Offline mode active"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-lavender-50 p-4">
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="mt-1 text-2xl font-bold">{drafts.length}</p>
            </div>
            <div className="rounded-2xl bg-butter-50 p-4">
              <p className="text-sm text-muted-foreground">Pending queue</p>
              <p className="mt-1 text-2xl font-bold">{totalQueue}</p>
            </div>
            <div className="rounded-2xl bg-peach-50 p-4">
              <p className="text-sm text-muted-foreground">Failed records</p>
              <p className="mt-1 text-2xl font-bold">{totalFailures}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" asChild>
            <Link href="/app/enumerator/drafts">Open drafts</Link>
          </Button>
          <Button onClick={runSync}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Sync now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
