import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { isRole, normalizeRole } from "@/lib/roles";
import type { AuthSession } from "@/types/session";
import type { UserProfile, WorkspaceRole } from "@/types/domain";

function decodeDemoSession(value: string | undefined): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AuthSession;

    if (!decoded?.uid || !decoded.role || !isRole(decoded.role)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

async function getUserProfile(uid: string) {
  const db = getAdminDb();

  if (!db) {
    return null;
  }

  const snapshot = await db.collection("users").doc(uid).get();
  return snapshot.exists ? (snapshot.data() as UserProfile) : null;
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get(env.demoSessionCookieName)?.value;
  const demoSession = decodeDemoSession(demoCookie);

  if (demoSession) {
    return demoSession;
  }

  const sessionCookie = cookieStore.get(env.sessionCookieName)?.value;

  if (!sessionCookie) {
    return null;
  }

  const auth = getAdminAuth();
  if (!auth) {
    return null;
  }

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const profile = await getUserProfile(decoded.uid);
    const resolvedRole = normalizeRole(profile?.role ?? decoded.role);

    if (!profile) {
      return null;
    }

    return {
      uid: decoded.uid,
      orgId:
        profile.orgId ??
        (typeof decoded.orgId === "string" ? decoded.orgId : "org-demo-censussync"),
      email: decoded.email ?? profile.email ?? "",
      name: profile.name ?? decoded.name ?? decoded.email?.split("@")[0] ?? "CensusSync User",
      role: resolvedRole,
      status: profile?.status ?? "active",
      projectId: profile.projectId,
      scopes: profile?.scopes ?? [],
      isDemo: false
    };
  } catch {
    return null;
  }
}

export async function requireSession(allowedRoles?: WorkspaceRole[]) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/unauthorized");
  }

  return session;
}
