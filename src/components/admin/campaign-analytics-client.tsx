"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { CampaignGeoMap } from "@/components/campaigns/campaign-geo-map";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignAnalyticsPayload } from "@/types/campaign";

const CHART_COLORS = ["#0f766e", "#ea580c", "#7c3aed", "#eab308", "#2563eb"];

async function fetchAnalytics() {
  const response = await fetch("/api/admin/analytics");
  if (!response.ok) {
    throw new Error("Unable to refresh campaign analytics.");
  }

  return (await response.json()) as CampaignAnalyticsPayload;
}

export function CampaignAnalyticsClient({
  initialPayload
}: {
  initialPayload: CampaignAnalyticsPayload;
}) {
  const { data } = useQuery({
    queryKey: ["campaign-analytics"],
    queryFn: fetchAnalytics,
    initialData: initialPayload,
    refetchInterval: 20_000
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total responses", data.summary.totalResponses],
          ["Employee responses", data.summary.employeeResponses],
          ["Public responses", data.summary.publicResponses],
          ["Completion rate", `${data.summary.completionRate}%`],
          ["Active campaigns", data.summary.activeCampaigns],
          ["Verified field", data.summary.verifiedResponses]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold">Responses over time</h3>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.responsesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="responses" fill="#0f766e" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold">Channel split</h3>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.channelSplit} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110}>
                    {data.channelSplit.map((entry, index) => (
                      <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold">Completion funnel</h3>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.completionFunnel}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ea580c" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold">Employee activity</h3>
            {data.employeeActivity.length ? (
              <div className="mt-4 space-y-3">
                {data.employeeActivity.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-[1.5rem] border border-black/5 px-4 py-3"
                  >
                    <p className="font-medium">{row.label}</p>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-semibold">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Employee activity will populate once field responses arrive.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <CampaignGeoMap points={data.geoPoints} />

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-xl font-semibold">Question breakdowns</h3>
            {data.questionBreakdowns.length ? (
              data.questionBreakdowns.map((breakdown) => (
                <div key={breakdown.questionId} className="rounded-[1.5rem] border border-black/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{breakdown.questionPrompt}</p>
                      <p className="text-sm text-muted-foreground">{breakdown.type.replaceAll("_", " ")}</p>
                    </div>
                    <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                      {breakdown.totalAnswered} answered
                    </div>
                  </div>

                  {breakdown.textResponses?.length ? (
                    <div className="mt-3 space-y-3">
                      {breakdown.textResponses.map((entry) => (
                        <div key={entry.responseId} className="rounded-2xl bg-black/[0.03] px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-black/45">
                            <span>{entry.respondentLabel}</span>
                            <span suppressHydrationWarning>
                              {new Date(entry.submittedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-black/80">{entry.answer}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {breakdown.values.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between text-sm">
                          <span>{entry.label}</span>
                          <span className="font-medium">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Question-level summaries will appear once campaigns collect responses.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-xl font-semibold">Recent response details</h3>
            <p className="text-sm text-muted-foreground">
              Review respondent info, contextual location answers, and captured submit coordinates.
            </p>
          </div>

          {data.recentResponses.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {data.recentResponses.map((response) => (
                <div key={response.responseId} className="rounded-[1.5rem] border border-black/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{response.respondentLabel}</p>
                      <p className="text-sm text-muted-foreground">{response.campaignName}</p>
                    </div>
                    <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                      {response.channel === "employee" ? "Employee" : "Public"}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-black/75">
                    {response.respondentEmail ? <p>Email: {response.respondentEmail}</p> : null}
                    {response.respondentPhone ? <p>Phone: {response.respondentPhone}</p> : null}
                    {response.locationAnswer ? <p>Form location answer: {response.locationAnswer}</p> : null}
                    {typeof response.latitude === "number" && typeof response.longitude === "number" ? (
                      <p>
                        Submit geo: {response.latitude.toFixed(5)}, {response.longitude.toFixed(5)}
                        {typeof response.accuracy === "number"
                          ? ` (±${Math.round(response.accuracy)}m)`
                          : ""}
                      </p>
                    ) : null}
                    <p suppressHydrationWarning>
                      Submitted: {new Date(response.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Submission details will appear once campaigns start collecting responses.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
