import { NextResponse } from "next/server";

import { getCampaignAnalytics } from "@/lib/campaigns/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function GET() {
  try {
    const session = await requireRouteSession(["admin"]);
    const payload = await getCampaignAnalytics(session);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
