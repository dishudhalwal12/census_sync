import { NextResponse } from "next/server";

import { createOrUpdateCampaign } from "@/lib/campaigns/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = await request.json();
    const result = await createOrUpdateCampaign(body, session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
