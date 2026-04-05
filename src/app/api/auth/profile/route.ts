import { NextResponse } from "next/server";

import { isReviewSafeMode } from "@/lib/env";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { isRole } from "@/lib/roles";
import type { Scope, UserRole, UserStatus } from "@/types/domain";
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
    email?: string;
    name?: string;
  };

  if (!body.idToken) {
    return NextResponse.json(
      { message: "Missing Firebase ID token." },
      { status: 400 }
    );
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  if (!adminAuth || !adminDb) {
    if (isReviewSafeMode || process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        role: "enumerator",
        status: "active",
        projectId: null,
        scopes: [],
        mode: "local-fallback"
      });
    }

    return NextResponse.json(
      { message: "Firebase Admin credentials are not configured." },
      { status: 503 }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const userRecord = await adminAuth.getUser(decoded.uid);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const existing = await userRef.get();
    const existingData = existing.data() ?? {};
    const role = (
      typeof existingData.role === "string" && isRole(existingData.role)
        ? existingData.role
        : isRole(String(decoded.role))
          ? (decoded.role as UserRole)
          : "enumerator"
    ) as UserRole;
    const status = normalizeStatus(existingData.status);
    const scopes = normalizeScopes(existingData.scopes);
    const projectId =
      typeof existingData.projectId === "string" ? existingData.projectId : undefined;
    const assignedTemplateVersion =
      typeof existingData.assignedTemplateVersion === "string"
        ? existingData.assignedTemplateVersion
        : "template-unassigned";

    await userRef.set(
      {
        uid: decoded.uid,
        name:
          body.name?.trim() ||
          existingData.name ||
          userRecord.displayName ||
          userRecord.email?.split("@")[0] ||
          "Field User",
        email: body.email ?? existingData.email ?? userRecord.email ?? "",
        role,
        status,
        projectId: projectId ?? null,
        assignmentLabel: existingData.assignmentLabel ?? "Awaiting assignment",
        scopes,
        assignedTemplateVersion,
        lastLoginAt: new Date().toISOString(),
        createdAt: existingData.createdAt ?? new Date().toISOString()
      },
      { merge: true }
    );

    await adminAuth.setCustomUserClaims(decoded.uid, {
      role,
      projectId: projectId ?? null,
      districts: scopes.map((scope) => scope.district),
      blocks: scopes.map((scope) => scope.block)
    });

    return NextResponse.json({
      ok: true,
      role,
      status,
      projectId: projectId ?? null,
      scopes
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to verify the signed-in Firebase user." },
      { status: 401 }
    );
  }
}
