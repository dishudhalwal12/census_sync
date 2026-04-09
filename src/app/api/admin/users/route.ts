import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { inviteWorkspaceUser } from "@/lib/campaigns/server";
import { isRole } from "@/lib/roles";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as {
      uid?: string;
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      scopes?: Array<{ district: string; block: string; cluster?: string }>;
    };

    if (!body.name || !body.email || !body.password || !body.role || !isRole(body.role)) {
      return jsonError(new Error("Name, email, password, and a valid role are required."));
    }

    const result = await inviteWorkspaceUser({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      scopes: body.scopes
    }, session);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
