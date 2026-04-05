import { NextResponse } from "next/server";

import {
  calibrateManagedMissionLocation,
  createManagedMission
} from "@/lib/server/mutation-service";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      objective?: string;
      type?: "census" | "community_survey" | "campus_outreach" | "social_audit";
      district?: string;
      block?: string;
      cluster?: string;
      siteCenter?: { latitude: number; longitude: number };
      serviceRadiusMeters?: number;
      capacityLimit?: number;
      activeTo?: string;
      assigneeUid?: string;
      sections?: unknown;
    };

    if (
      !body.name ||
      !body.district ||
      !body.block ||
      !body.assigneeUid ||
      !body.siteCenter ||
      !Array.isArray(body.sections)
    ) {
      return jsonError(
        new Error("Mission name, assignee, district, block, site center, and sections are required.")
      );
    }

    const result = await createManagedMission(
      {
        name: body.name,
        description: body.description,
        objective: body.objective,
        type: body.type,
        district: body.district,
        block: body.block,
        cluster: body.cluster,
        siteCenter: body.siteCenter,
        serviceRadiusMeters: body.serviceRadiusMeters,
        capacityLimit: body.capacityLimit,
        activeTo: body.activeTo,
        assigneeUid: body.assigneeUid,
        sections: body.sections as never
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as {
      assignmentId?: string;
      siteCenter?: { latitude: number; longitude: number };
      serviceRadiusMeters?: number;
    };

    if (!body.assignmentId || !body.siteCenter) {
      return jsonError(new Error("assignmentId and siteCenter are required."));
    }

    const result = await calibrateManagedMissionLocation(
      {
        assignmentId: body.assignmentId,
        siteCenter: body.siteCenter,
        serviceRadiusMeters: body.serviceRadiusMeters
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
