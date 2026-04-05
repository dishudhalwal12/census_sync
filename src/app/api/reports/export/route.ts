import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { createManagedExport } from "@/lib/server/mutation-service";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["supervisor", "admin"]);
    const body = (await request.json()) as {
      format?: "csv" | "pdf";
      projectId?: string;
      filters?: {
        status?: string;
        enumeratorId?: string;
        dateFrom?: string;
        dateTo?: string;
      };
    };

    if (!body.format) {
      return jsonError(new Error("format is required."));
    }

    const result = await createManagedExport(
      {
        format: body.format,
        projectId: body.projectId,
        filters: body.filters
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
