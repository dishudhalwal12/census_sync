import { NextResponse } from "next/server";

import {
  createCampaignLink,
  revokeCampaignLink
} from "@/lib/campaigns/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as { revokeLinkId?: string };

    if (body.revokeLinkId) {
      const result = await revokeCampaignLink(body.revokeLinkId, session);
      return NextResponse.json(result);
    }

    const result = await createCampaignLink(body, session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
