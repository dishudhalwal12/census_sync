"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, MapPin } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  cacheMissionPackage,
  listCachedMissionPackages,
  listMissionQueueItems
} from "@/lib/missions/service";
import type { MissionAssignmentPackage } from "@/types/domain";
import type { AuthSession } from "@/types/session";

export function AssignedMissionsClient({
  session,
  initialPackages
}: {
  session: AuthSession;
  initialPackages: MissionAssignmentPackage[];
}) {
  const [packages, setPackages] = useState<MissionAssignmentPackage[]>(initialPackages);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      await Promise.all(initialPackages.map((pkg) => cacheMissionPackage(pkg, session.uid)));
      const [cached, queue] = await Promise.all([
        listCachedMissionPackages(session.uid),
        listMissionQueueItems(session.uid)
      ]);

      if (!mounted) {
        return;
      }

      const merged = new Map<string, MissionAssignmentPackage>();
      initialPackages.forEach((pkg) => merged.set(pkg.assignment.id, pkg));
      cached.forEach((row) => merged.set(row.assignmentId, row.data));

      setPackages(Array.from(merged.values()));
      setQueuedCount(queue.length);
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [initialPackages, session.uid]);

  const completedCount = useMemo(
    () =>
      packages.filter((pkg) => pkg.assignment.activationStatus === "completed").length,
    [packages]
  );

  async function copyLink(pkg: MissionAssignmentPackage) {
    if (!pkg.assignment.shareCode) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/field/${pkg.assignment.shareCode}`);
    toast.success("Mission link copied.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm text-muted-foreground">Assigned censuses</p>
            <p className="mt-1 text-2xl font-bold">{packages.length}</p>
          </div>
          <div className="rounded-2xl bg-butter-50 p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-bold">{completedCount}</p>
          </div>
          <div className="rounded-2xl bg-peach-50 p-4">
            <p className="text-sm text-muted-foreground">Queued sync</p>
            <p className="mt-1 text-2xl font-bold">{queuedCount}</p>
          </div>
        </CardContent>
      </Card>

      {packages.length ? (
        <div className="grid gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.assignment.id}>
              <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={pkg.assignment.activationStatus ?? "sent"} />
                    <span className="text-sm text-muted-foreground">
                      {pkg.project.type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{pkg.assignment.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{pkg.project.objective}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {pkg.assignment.scope.district} / {pkg.assignment.scope.block}
                    </span>
                    <span>{pkg.project.serviceRadiusMeters ?? 1000} m radius</span>
                    <span>{pkg.project.capacityLimit ?? pkg.project.targetSubmissions ?? 0} capacity</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {pkg.assignment.shareCode ? (
                    <Button variant="secondary" type="button" onClick={() => void copyLink(pkg)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                  ) : null}
                  <Button asChild>
                    <Link href={`/app/enumerator/missions/${pkg.assignment.id}`}>Open census</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No assigned censuses are cached on this device yet. Open a secure mission link once
            while online to bring it into offline mode.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
