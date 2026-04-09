import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { reviewManagedSubmission } from "@/lib/server/mutation-service";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["admin"]);
    const body = (await request.json()) as {
      submissionId?: string;
      action?:
        | "resolved"
        | "under_review"
        | "revisit_requested"
        | "approved"
        | "rejected"
        | "escalated";
      reviewNotes?: string;
      revisitReasons?: Array<
        | "retake_geo"
        | "retake_photo"
        | "address_mismatch"
        | "member_count_mismatch"
        | "duplicate_check"
        | "missing_fields"
      >;
    };

    if (!body.submissionId || !body.action) {
      return jsonError(new Error("submissionId and action are required."));
    }

    const result = await reviewManagedSubmission(
      {
        submissionId: body.submissionId,
        action: body.action,
        reviewNotes: body.reviewNotes,
        revisitReasons: body.revisitReasons
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
