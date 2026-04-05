import { NextResponse } from "next/server";

import { activateManagedTemplate } from "@/lib/server/mutation-service";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as { templateId?: string };

    if (!body.templateId) {
      return jsonError(new Error("templateId is required."));
    }

    const result = await activateManagedTemplate({ templateId: body.templateId }, session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
