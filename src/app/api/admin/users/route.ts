import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { upsertManagedUser } from "@/lib/server/mutation-service";
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
      projectId?: string;
      assignmentLabel?: string;
      targetCount?: number;
      scopes?: Array<{ district: string; block: string; cluster?: string }>;
    };

    if (!body.name || !body.email || !body.role || !isRole(body.role)) {
      return jsonError(new Error("Name, email, and a valid role are required."));
    }

    const result = await upsertManagedUser(
      {
        uid: body.uid,
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
        projectId: body.projectId,
        assignmentLabel: body.assignmentLabel,
        targetCount: body.targetCount,
        scopes: body.scopes
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
