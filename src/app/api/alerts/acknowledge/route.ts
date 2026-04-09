import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase/admin";
import { mutateReviewStore } from "@/lib/review-store/server";
import { jsonError, requireRouteSession } from "@/lib/server/api-route";
import { getServerRuntimeMode } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    await requireRouteSession();
    const body = (await request.json()) as { alertId?: string };

    if (!body.alertId) {
      return jsonError(new Error("alertId is required."));
    }

    if (getServerRuntimeMode() === "review-safe") {
      await mutateReviewStore((draft) => {
        draft.alerts = draft.alerts.map((alert) =>
          alert.id === body.alertId
            ? {
                ...alert,
                status: "acknowledged",
                acknowledgedAt: new Date().toISOString()
              }
            : alert
        );
      });
    } else {
      const db = getAdminDb();
      if (!db) {
        throw new Error("Firebase Admin credentials are not configured.");
      }

      await db.collection("alerts").doc(body.alertId).set(
        {
          status: "acknowledged",
          acknowledgedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, String(error).includes("Authentication") ? 401 : 400);
  }
}
