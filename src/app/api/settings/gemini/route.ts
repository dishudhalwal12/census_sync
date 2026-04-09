import { NextResponse } from "next/server";

import { requireRouteSession, jsonError } from "@/lib/server/api-route";
import { updateUserGeminiSettings } from "@/lib/server/user-settings";

export async function PATCH(request: Request) {
  try {
    const session = await requireRouteSession();
    const body = await request.json();
    const result = await updateUserGeminiSettings(body, session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
