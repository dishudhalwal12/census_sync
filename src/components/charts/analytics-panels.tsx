"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import type { HouseholdSubmission } from "@/types/domain";

const COLORS = ["#b678f8", "#ffb083", "#ffe491", "#8fd3b6", "#82b0ff"];

export function AnalyticsPanels({ submissions }: { submissions: HouseholdSubmission[] }) {
  if (!submissions.length) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No synced records are available yet for analytics. Once enumerators submit field
            records, household size and demographic charts will appear here.
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This project is still waiting for its first approved submissions.
          </CardContent>
        </Card>
      </div>
    );
  }

  const householdSizeData = submissions.map((submission) => ({
    name: submission.householdId,
    value: submission.members.length
  }));

  const ageBuckets = submissions.flatMap((submission) => submission.members).reduce<Record<string, number>>(
    (accumulator, member) => {
      const bucket =
        member.age < 18 ? "0-17" : member.age < 36 ? "18-35" : member.age < 60 ? "36-59" : "60+";
      accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
      return accumulator;
    },
    {}
  );

  const ageData = Object.entries(ageBuckets).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold">Household size distribution</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={householdSizeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#b678f8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold">Age group mix</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ageData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>
                  {ageData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
