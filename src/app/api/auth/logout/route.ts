import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(env.sessionCookieName);
  cookieStore.delete(env.demoSessionCookieName);

  return NextResponse.json({ ok: true });
}
