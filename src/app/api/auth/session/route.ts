import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env, isDemoMode, isReviewSafeMode } from "@/lib/env";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isRole } from "@/lib/roles";
import type { AuthSession } from "@/types/session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;
const USE_SECURE_COOKIES =
  process.env.NODE_ENV === "production" && env.appUrl.startsWith("https://");

export async function POST(request: Request) {
  const body = (await request.json()) as {
    idToken?: string;
    demoRole?: string;
    demoName?: string;
    demoEmail?: string;
    fallbackSession?: Partial<AuthSession>;
  };

  const cookieStore = await cookies();

  if (isDemoMode && body.demoRole && isRole(body.demoRole)) {
    const demoSession: AuthSession = {
      uid: `demo-${body.demoRole}`,
      email: body.demoEmail ?? `${body.demoRole}@demo.censussync.app`,
      name: body.demoName ?? `Demo ${body.demoRole}`,
      role: body.demoRole,
      status: "active",
      projectId: "project-census-2026",
      scopes: [
        {
          district: "South District",
          block: body.demoRole === "admin" ? "All Blocks" : "Block A"
        }
      ],
      isDemo: true
    };

    cookieStore.set(
      env.demoSessionCookieName,
      Buffer.from(JSON.stringify(demoSession)).toString("base64url"),
      {
        httpOnly: true,
        secure: USE_SECURE_COOKIES,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE
      }
    );
    cookieStore.delete(env.sessionCookieName);

    return NextResponse.json({ ok: true, mode: "demo" });
  }

  if (!body.idToken) {
    return NextResponse.json(
      { message: "Missing Firebase ID token." },
      { status: 400 }
    );
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    if (
      isReviewSafeMode &&
      body.fallbackSession?.uid &&
      body.fallbackSession.email &&
      body.fallbackSession.name &&
      body.fallbackSession.role &&
      isRole(body.fallbackSession.role)
    ) {
      const fallbackSession: AuthSession = {
        uid: body.fallbackSession.uid,
        email: body.fallbackSession.email,
        name: body.fallbackSession.name,
        role: body.fallbackSession.role,
        status:
          body.fallbackSession.status === "disabled"
            ? "disabled"
            : body.fallbackSession.status === "invited"
              ? "invited"
              : "active",
        projectId: body.fallbackSession.projectId,
        scopes: body.fallbackSession.scopes ?? [],
        isDemo: false
      };

      cookieStore.set(
        env.demoSessionCookieName,
        Buffer.from(JSON.stringify(fallbackSession)).toString("base64url"),
        {
          httpOnly: true,
          secure: USE_SECURE_COOKIES,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE
        }
      );
      cookieStore.delete(env.sessionCookieName);

      return NextResponse.json({ ok: true, mode: "local-fallback" });
    }

    if (
      process.env.NODE_ENV !== "production" &&
      body.fallbackSession?.uid &&
      body.fallbackSession.email &&
      body.fallbackSession.name &&
      body.fallbackSession.role &&
      isRole(body.fallbackSession.role)
    ) {
      const fallbackSession: AuthSession = {
        uid: body.fallbackSession.uid,
        email: body.fallbackSession.email,
        name: body.fallbackSession.name,
        role: body.fallbackSession.role,
        status:
          body.fallbackSession.status === "disabled"
            ? "disabled"
            : body.fallbackSession.status === "invited"
              ? "invited"
              : "active",
        projectId: body.fallbackSession.projectId,
        scopes: body.fallbackSession.scopes ?? [],
        isDemo: false
      };

      cookieStore.set(
        env.demoSessionCookieName,
        Buffer.from(JSON.stringify(fallbackSession)).toString("base64url"),
        {
          httpOnly: true,
          secure: USE_SECURE_COOKIES,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE
        }
      );
      cookieStore.delete(env.sessionCookieName);

      return NextResponse.json({ ok: true, mode: "local-fallback" });
    }

    return NextResponse.json(
      { message: "Firebase Admin credentials are not configured." },
      { status: 503 }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const signedInRecently =
      Date.now() / 1000 - Number(decoded.auth_time ?? 0) < 5 * 60;

    if (!signedInRecently) {
      return NextResponse.json(
        { message: "Recent sign-in required before starting a session." },
        { status: 401 }
      );
    }

    const sessionCookie = await adminAuth.createSessionCookie(body.idToken, {
      expiresIn: SESSION_MAX_AGE * 1000
    });

    cookieStore.set(env.sessionCookieName, sessionCookie, {
      httpOnly: true,
      secure: USE_SECURE_COOKIES,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE
    });
    cookieStore.delete(env.demoSessionCookieName);

    return NextResponse.json({ ok: true, mode: "firebase" });
  } catch {
    return NextResponse.json(
      { message: "Failed to create the authenticated session." },
      { status: 401 }
    );
  }
}
