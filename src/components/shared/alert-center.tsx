"use client";

import { BellRing } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AlertEvent } from "@/types/domain";

export function AlertCenter({ alerts, title = "Alert center" }: { alerts: AlertEvent[]; title?: string }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-lavender-500" />
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">
              Operational alerts for trust risk, coverage gaps, and field performance.
            </p>
          </div>
        </div>
        {alerts.length ? (
          alerts.slice(0, 6).map((alert) => (
            <div key={alert.id} className="rounded-[1.5rem] border border-black/5 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{alert.title}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    alert.severity === "critical"
                      ? "bg-rose-50 text-rose-700"
                      : alert.severity === "warning"
                        ? "bg-butter-50 text-amber-700"
                        : "bg-lavender-50 text-lavender-700"
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{alert.description}</p>
            </div>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 p-4 text-sm text-muted-foreground">
            No active alerts right now. Trust, coverage, and field-health signals are within range.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
