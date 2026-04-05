import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKpi } from "@/types/domain";

const toneClasses: Record<NonNullable<DashboardKpi["tone"]>, string> = {
  lavender: "from-lavender-100 to-white",
  peach: "from-peach-100 to-white",
  yellow: "from-butter-100 to-white",
  mint: "from-emerald-50 to-white"
};

export function KpiGrid({ items }: { items: DashboardKpi[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.id}
          className={`bg-gradient-to-br ${item.tone ? toneClasses[item.tone] : "from-white to-white"}`}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-3 text-4xl font-extrabold tracking-tight">{item.value}</p>
              </div>
              <span className="rounded-full bg-white/80 p-2 shadow-sm">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-sm text-black/60">{item.trend}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
