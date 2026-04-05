import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { ingestManagedSubmission } from "@/lib/server/mutation-service";
import type { HouseholdSubmission } from "@/types/domain";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["enumerator", "admin"]);
    const body = (await request.json()) as { submission?: HouseholdSubmission };

    if (!body.submission) {
      return jsonError(new Error("submission is required."));
    }

    const result = await ingestManagedSubmission({ submission: body.submission }, session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
