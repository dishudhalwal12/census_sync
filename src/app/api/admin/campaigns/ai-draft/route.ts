import { NextResponse } from "next/server";

import { createAiCampaignDraft } from "@/lib/campaigns/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = await request.json();
    const result = await createAiCampaignDraft(body, session);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the draft.";
    return jsonError(
      new Error(message),
      message.includes("Authentication") ? 401 : 400
    );
  }
}
