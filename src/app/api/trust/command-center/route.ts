import { NextResponse } from "next/server";

import { getAdminDashboardData } from "@/lib/data/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function GET() {
  try {
    const session = await requireRouteSession(["admin"]);
    const data = await getAdminDashboardData(session);
    return NextResponse.json({
      alerts: data.alerts,
      coverageGaps: data.coverageGaps,
      scorecards: data.scorecards,
      predictions: data.predictions,
      reviewCases: data.reviewCases,
      routePlans: data.routePlans
    });
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
