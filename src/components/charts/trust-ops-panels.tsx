import { Card, CardContent } from "@/components/ui/card";
import type {
  CoverageGap,
  EnumeratorScorecard,
  PredictionSnapshot
} from "@/types/domain";
import { formatDate } from "@/lib/utils";

export function TrustOpsPanels({
  coverageGaps,
  scorecards,
  predictions
}: {
  coverageGaps: CoverageGap[];
  scorecards: EnumeratorScorecard[];
  predictions: PredictionSnapshot[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-xl font-semibold">Coverage gap intelligence</h3>
            <p className="text-sm text-muted-foreground">
              Under-covered blocks, revisit backlog, and trust-risk coverage pressure.
            </p>
          </div>
          {coverageGaps.length ? (
            coverageGaps.map((gap) => (
              <div key={gap.id} className="rounded-[1.5rem] bg-lavender-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {gap.scope.district} / {gap.scope.block}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      gap.riskLevel === "high"
                        ? "bg-rose-50 text-rose-700"
                        : gap.riskLevel === "medium"
                          ? "bg-butter-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {gap.riskLevel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {gap.approvedCount} approved of {gap.targetCount} target, {gap.flaggedCount} flagged,{" "}
                  {gap.revisitBacklog} revisit backlog
                </p>
                <div className="mt-3 h-2 rounded-full bg-white/90">
                  <div
                    className={`h-2 rounded-full ${
                      gap.riskLevel === "high"
                        ? "bg-rose-400"
                        : gap.riskLevel === "medium"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.min(100, gap.completionRate)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Coverage targets will appear here once assignments are loaded.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-xl font-semibold">Enumerator trust scorecards</h3>
            <p className="text-sm text-muted-foreground">
              Approval, revisit, geo compliance, sync delay, and completion speed by enumerator.
            </p>
          </div>
          {scorecards.length ? (
            <div className="space-y-3">
              {scorecards.map((scorecard) => {
                const prediction = predictions.find(
                  (item) => item.projectId && scorecard.enumeratorId
                );

                return (
                  <div key={scorecard.enumeratorId} className="rounded-[1.5rem] border border-black/5 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{scorecard.enumeratorName}</p>
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">
                        {scorecard.approvalRate}% approval
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Completed</p>
                        <p className="mt-1 text-lg font-semibold">{scorecard.submissionsCompleted}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Revisits</p>
                        <p className="mt-1 text-lg font-semibold">{scorecard.revisitCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Geo</p>
                        <p className="mt-1 text-lg font-semibold">{scorecard.geoComplianceRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Avg sync</p>
                        <p className="mt-1 text-lg font-semibold">{scorecard.averageSyncDelayMinutes} min</p>
                      </div>
                    </div>
                    {prediction ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Predicted finish: {formatDate(prediction.projectedFinishDate)} • {prediction.confidence}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Scorecards will populate when submissions are synced.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
