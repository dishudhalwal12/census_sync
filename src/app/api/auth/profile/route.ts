import { NextResponse } from "next/server";

import { isReviewSafeMode } from "@/lib/env";
import { ensureOrgAwareUserProfile } from "@/lib/campaigns/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isRole, normalizeRole } from "@/lib/roles";
import type { Scope, UserStatus, WorkspaceRole } from "@/types/domain";
import type { AuthSession } from "@/types/session";

function normalizeScopes(scopes: unknown): AuthSession["scopes"] {
  return Array.isArray(scopes)
    ? scopes.filter(
        (scope): scope is Scope =>
          Boolean(
            scope &&
              typeof scope === "object" &&
              "district" in scope &&
              "block" in scope &&
              typeof scope.district === "string" &&
              typeof scope.block === "string"
          )
      )
    : [];
}

function normalizeStatus(value: unknown): UserStatus {
  return value === "disabled" || value === "invited" ? value : "active";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    idToken?: string;
    uid?: string;
    email?: string;
    name?: string;
    organizationName?: string;
    requestedRole?: WorkspaceRole | string;
  };
  const requestedRole = isRole(body.requestedRole ?? "")
    ? (body.requestedRole as WorkspaceRole)
    : undefined;

  if (!body.idToken && !body.uid) {
    return NextResponse.json(
      { message: "Missing Firebase identity context." },
      { status: 400 }
    );
  }

  const adminAuth = getAdminAuth();

  try {
    if (!adminAuth) {
      if (!isReviewSafeMode && process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { message: "Firebase Admin credentials are not configured." },
          { status: 503 }
        );
      }

      const profile = await ensureOrgAwareUserProfile({
        uid: body.uid ?? `local-${Date.now()}`,
        email: body.email ?? "",
        name: body.name?.trim() || "Workspace User",
        organizationName: body.organizationName,
        requestedRole
      });

      return NextResponse.json({
        ok: true,
        role: normalizeRole(profile.role),
        status: normalizeStatus(profile.status),
        projectId: profile.projectId ?? null,
        orgId: profile.orgId,
        scopes: normalizeScopes(profile.scopes),
        mode: "local-fallback"
      });
    }

    if (!body.idToken) {
      return NextResponse.json(
        { message: "Missing Firebase ID token." },
        { status: 400 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const userRecord = await adminAuth.getUser(decoded.uid);
    const profile = await ensureOrgAwareUserProfile({
      uid: decoded.uid,
      email: body.email ?? userRecord.email ?? "",
      name:
        body.name?.trim() ||
        userRecord.displayName ||
        userRecord.email?.split("@")[0] ||
        "Workspace User",
        organizationName: body.organizationName,
      requestedRole
    });

    await adminAuth.setCustomUserClaims(decoded.uid, {
      role: profile.role,
      orgId: profile.orgId,
      projectId: profile.projectId ?? null,
      districts: profile.scopes.map((scope) => scope.district),
      blocks: profile.scopes.map((scope) => scope.block)
    });

    return NextResponse.json({
      ok: true,
      role: profile.role,
      status: normalizeStatus(profile.status),
      projectId: profile.projectId ?? null,
      orgId: profile.orgId,
      scopes: normalizeScopes(profile.scopes)
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to verify the signed-in Firebase user.";

    return NextResponse.json(
      { message },
      {
        status: message.includes("invite") ? 403 : 401
      }
    );
  }
}
