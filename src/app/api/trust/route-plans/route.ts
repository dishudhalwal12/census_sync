import { NextResponse } from "next/server";

import { getRoutePlans } from "@/lib/data/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function GET() {
  try {
    const session = await requireRouteSession();
    const routePlans = await getRoutePlans(session);
    return NextResponse.json({ routePlans });
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
