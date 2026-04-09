import { NextResponse } from "next/server";

import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { ingestManagedMissionSubmission } from "@/lib/server/mutation-service";
import type { MissionSubmission } from "@/types/domain";

export async function POST(request: Request) {
  try {
    const session = await requireRouteSession(["employee", "admin"]);
    const formData = await request.formData();
    const serializedSubmission = formData.get("submission");
    const proofFile = formData.get("proofFile");

    if (typeof serializedSubmission !== "string") {
      return jsonError(new Error("submission is required."));
    }

    const submission = JSON.parse(serializedSubmission) as MissionSubmission;
    const result = await ingestManagedMissionSubmission(
      {
        submission,
        proofFile: proofFile instanceof File ? proofFile : null
      },
      session
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
