import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { reviewManagedSubmission } from "@/lib/server/mutation-service";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["supervisor", "admin"]);
    const body = (await request.json()) as {
      submissionId?: string;
      action?: "resolved" | "escalated";
      reviewNotes?: string;
    };

    if (!body.submissionId || !body.action) {
      return jsonError(new Error("submissionId and action are required."));
    }

    const result = await reviewManagedSubmission(
      {
        submissionId: body.submissionId,
        action: body.action,
        reviewNotes: body.reviewNotes
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
