import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/server/session";
import type { WorkspaceRole } from "@/types/domain";

export async function requireRouteSession(allowedRoles?: WorkspaceRole[]) {
  const session = await getSession();

  if (!session) {
    throw new Error("Authentication is required.");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new Error("You do not have access to this action.");
  }

  return session;
}

export function jsonError(error: unknown, status = 400) {
  return NextResponse.json(
    {
      message: error instanceof Error ? error.message : "Request failed."
    },
    { status }
  );
}
