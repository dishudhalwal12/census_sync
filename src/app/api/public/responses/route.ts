import { NextResponse } from "next/server";

import { ingestPublicCampaignResponse } from "@/lib/campaigns/server";
import { jsonError } from "@/lib/server/api-route";

const recentPublicWrites = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const token = typeof body?.token === "string" ? body.token : "unknown";
    const key = `${ip}:${token}`;
    const now = Date.now();
    const lastWriteAt = recentPublicWrites.get(key) ?? 0;

    if (now - lastWriteAt < 5_000) {
      return jsonError(new Error("Please wait a few seconds before submitting again."), 429);
    }

    recentPublicWrites.set(key, now);
    const result = await ingestPublicCampaignResponse(body);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
