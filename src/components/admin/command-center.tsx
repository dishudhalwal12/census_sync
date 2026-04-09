import { AlertCenter } from "@/components/shared/alert-center";
import { Card, CardContent } from "@/components/ui/card";
import { TrustOpsPanels } from "@/components/charts/trust-ops-panels";
import type {
  AlertEvent,
  CoverageGap,
  EnumeratorScorecard,
  PredictionSnapshot,
  ReviewCase,
  RoutePlan
} from "@/types/domain";

export function CommandCenter({
  alerts,
  coverageGaps,
  scorecards,
  predictions,
  reviewCases,
  routePlans
}: {
  alerts: AlertEvent[];
  coverageGaps: CoverageGap[];
  scorecards: EnumeratorScorecard[];
  predictions: PredictionSnapshot[];
  reviewCases: ReviewCase[];
  routePlans: RoutePlan[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm text-muted-foreground">Open alerts</p>
            <p className="mt-1 text-2xl font-bold">{alerts.length}</p>
          </div>
          <div className="rounded-2xl bg-peach-50 p-4">
            <p className="text-sm text-muted-foreground">Review cases</p>
            <p className="mt-1 text-2xl font-bold">{reviewCases.length}</p>
          </div>
          <div className="rounded-2xl bg-butter-50 p-4">
            <p className="text-sm text-muted-foreground">Coverage gaps</p>
            <p className="mt-1 text-2xl font-bold">
              {coverageGaps.filter((gap) => gap.riskLevel !== "low").length}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-muted-foreground">Route plans</p>
            <p className="mt-1 text-2xl font-bold">{routePlans.length}</p>
          </div>
        </CardContent>
      </Card>

      <AlertCenter alerts={alerts} title="Command center alerts" />
      <TrustOpsPanels
        coverageGaps={coverageGaps}
        scorecards={scorecards}
        predictions={predictions}
      />
    </div>
  );
}
