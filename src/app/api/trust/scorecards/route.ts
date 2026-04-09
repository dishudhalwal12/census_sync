import { NextResponse } from "next/server";

import { getEnumeratorScorecards } from "@/lib/data/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function GET() {
  try {
    const session = await requireRouteSession(["admin"]);
    const scorecards = await getEnumeratorScorecards(session);
    return NextResponse.json({ scorecards });
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
