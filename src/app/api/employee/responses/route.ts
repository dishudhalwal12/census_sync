import { NextResponse } from "next/server";

import { ingestEmployeeCampaignResponse } from "@/lib/campaigns/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["employee", "admin"]);
    const formData = await request.formData();
    const responsePayload = formData.get("response");
    const photoFile = formData.get("photoFile");

    if (typeof responsePayload !== "string") {
      return jsonError(new Error("response is required."));
    }

    const result = await ingestEmployeeCampaignResponse(
      JSON.parse(responsePayload),
      photoFile instanceof File ? photoFile : null,
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
