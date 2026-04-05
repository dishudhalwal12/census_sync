import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { createManagedProject } from "@/lib/server/mutation-service";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      type?: "census" | "community_survey" | "campus_outreach" | "social_audit";
      district?: string;
      block?: string;
      cluster?: string;
      targetSubmissions?: number;
    };

    if (!body.name || !body.district || !body.block) {
      return jsonError(new Error("Project name, district, and block are required."));
    }

    const result = await createManagedProject(
      {
        name: body.name,
        description: body.description,
        type: body.type,
        district: body.district,
        block: body.block,
        cluster: body.cluster,
        targetSubmissions: body.targetSubmissions
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
