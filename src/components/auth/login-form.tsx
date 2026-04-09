"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  env,
  isDemoMode,
  isFirebaseClientConfigured,
  isReviewSafeMode
} from "@/lib/env";
import { firebaseAuth } from "@/lib/firebase/client";
import { setActiveOfflineOwner } from "@/lib/offline/service";
import { isRole } from "@/lib/roles";
import type { UserStatus, WorkspaceRole } from "@/types/domain";
import type { AuthSession } from "@/types/session";

const authSchema = z.object({
  name: z.string().optional(),
  organizationName: z.string().optional(),
  requestedRole: z.enum(["admin", "employee"]),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().optional()
});

type AuthValues = z.infer<typeof authSchema>;
type AuthMode = "signin" | "register";

function normalizeStatus(value: unknown): UserStatus {
  return value === "disabled" || value === "invited" ? value : "active";
}

function getAuthErrorMessage(error: unknown, authMode: AuthMode) {
  const code = (error as FirebaseError | undefined)?.code;

  switch (code) {
    case "auth/email-already-in-use":
      return "That email address is already in use.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled for this Firebase project.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return error instanceof Error
        ? error.message
        : authMode === "register"
          ? "Registration failed."
          : "Login failed.";
  }
}

export function LoginForm({ nextPath = "/app" }: { nextPath?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const canUseFirebaseLogin = Boolean(firebaseAuth && isFirebaseClientConfigured);

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      name: "",
      organizationName: "",
      requestedRole: "admin",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  async function ensureUserProfile({
    uid,
    email,
    name,
    organizationName,
    requestedRole
  }: {
    uid: string;
    email: string;
    name: string;
    organizationName?: string;
    requestedRole?: WorkspaceRole;
  }) {
    const auth = firebaseAuth;

    if (!auth || !isFirebaseClientConfigured) {
      throw new Error("Firebase authentication is not available.");
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Unable to resolve the authenticated user.");
    }

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idToken,
          uid,
          email,
          name,
          organizationName,
          requestedRole
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(
          payload.message ?? `Unable to ensure the user profile (${response.status}).`
        );
      }

      return (await response.json()) as {
        role?: string;
        status?: UserStatus;
        projectId?: string;
        orgId?: string;
        scopes?: AuthSession["scopes"];
      };
    } catch (error) {
      throw error;
    }
  }

  async function establishSession(
    idToken: string,
    ownerUid: string,
    fallbackSession: Partial<AuthSession>
  ) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idToken, fallbackSession })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message ?? "Unable to establish the authenticated session.");
    }

    await setActiveOfflineOwner(ownerUid);
  }

  async function onSubmit(values: AuthValues) {
    const auth = firebaseAuth;

    if (!auth || !isFirebaseClientConfigured) {
      return;
    }

    setIsPending(true);

    try {
      let sessionUser:
        | {
            uid: string;
            email: string;
            name: string;
          }
        | undefined;

      if (authMode === "register") {
        const trimmedName = values.name?.trim();

        if (!trimmedName) {
          form.setError("name", { message: "Enter your full name." });
          return;
        }

        if (values.password !== values.confirmPassword) {
          form.setError("confirmPassword", {
            message: "Passwords do not match."
          });
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );

        await updateProfile(credential.user, {
          displayName: trimmedName
        });

        sessionUser = {
          uid: credential.user.uid,
          email: credential.user.email ?? values.email,
          name: trimmedName
        };
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );

        sessionUser = {
          uid: credential.user.uid,
          email: credential.user.email ?? values.email,
          name:
            credential.user.displayName ??
            values.email.split("@")[0] ??
            "Field User"
        };
      }

      if (!sessionUser) {
        throw new Error("Unable to resolve the authenticated user.");
      }

      const profile = await ensureUserProfile({
        ...sessionUser,
        organizationName: values.organizationName?.trim(),
        requestedRole: authMode === "register" ? values.requestedRole : undefined
      });
      if (profile.role && !isRole(profile.role)) {
        throw new Error("Your account role is not recognized by the platform.");
      }

      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        throw new Error("Unable to create a secure session.");
      }

      const resolvedRole: AuthSession["role"] = isRole(profile.role ?? "")
        ? (profile.role as AuthSession["role"])
        : "employee";

      await establishSession(idToken, sessionUser.uid, {
        uid: sessionUser.uid,
        orgId: profile.orgId ?? "org-demo-censussync",
        email: sessionUser.email,
        name: sessionUser.name,
        role: resolvedRole,
        status: normalizeStatus(profile.status),
        projectId: profile.projectId,
        scopes: Array.isArray(profile.scopes) ? profile.scopes : []
      });

      toast.success(
        authMode === "register"
          ? "Account created successfully."
          : `Signed in successfully as ${profile.role ?? "employee"}.`
      );
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(
        getAuthErrorMessage(error, authMode)
      );
    } finally {
      setIsPending(false);
    }
  }

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    form.clearErrors();
    form.setValue("password", "");
    form.setValue("confirmPassword", "");
    if (mode === "signin") {
      form.setValue("name", "");
      form.setValue("organizationName", "");
      form.setValue("requestedRole", "admin");
    }
  }

  async function loginWithDemo(role: string) {
    if (!isRole(role)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          demoRole: role,
          demoName: `Demo ${role}`,
          demoEmail: `${role}@demo.censussync.app`
        })
      });

      if (!response.ok) {
        toast.error("Unable to start demo mode.");
        return;
      }

      await setActiveOfflineOwner(role === "employee" ? "demo-enumerator" : `demo-${role}`);
      toast.success(`Entered demo mode as ${role}.`);
      router.replace(nextPath);
      router.refresh();
    });
  }

  async function sendResetLink() {
    const email = form.getValues("email")?.trim();

    if (!email) {
      toast.error("Enter your work email first to request a reset link.");
      return;
    }

    if (!firebaseAuth || !isFirebaseClientConfigured || isReviewSafeMode) {
      toast.info(
        "Password reset links are available when live Firebase authentication is configured."
      );
      return;
    }

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      toast.success("Password reset link sent.");
    } catch (error) {
      toast.error(getAuthErrorMessage(error, "signin"));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded-[2rem] p-2">
        <CardHeader>
          <div className="rounded-full bg-lavender-50 p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  authMode === "signin" ? "bg-white shadow-sm" : "text-black/55"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  authMode === "register" ? "bg-white shadow-sm" : "text-black/55"
                }`}
              >
                Register
              </button>
            </div>
          </div>
          <CardTitle className="font-display text-3xl">
            {authMode === "signin"
              ? "Secure role-based sign-in"
              : "Create your workspace account"}
          </CardTitle>
          <CardDescription>
            {authMode === "signin"
              ? "Email/password authentication with server-issued sessions, scoped data access, and real Firebase persistence."
              : "Choose whether this account should open the administrator or employee experience after signup."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-sm text-rose-500">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      role: "admin",
                      label: "Administrator",
                      description: "Manage campaigns, analytics, and users."
                    },
                    {
                      role: "employee",
                      label: "Employee",
                      description: "Collect data and work assigned field flows."
                    }
                  ] as const).map((option) => {
                    const selected = form.watch("requestedRole") === option.role;

                    return (
                      <button
                        key={option.role}
                        type="button"
                        onClick={() => form.setValue("requestedRole", option.role)}
                        className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                          selected
                            ? "border-lavender-400 bg-lavender-50"
                            : "border-black/10 bg-white"
                        }`}
                      >
                        <p className="font-semibold">{option.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization name</Label>
                <Input
                  id="organizationName"
                  placeholder={
                    form.watch("requestedRole") === "admin"
                      ? "Acme Research Group"
                      : "Optional organization name"
                  }
                  {...form.register("organizationName")}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                placeholder="admin@acme.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-rose-500">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {authMode === "signin" ? (
                  <button
                    type="button"
                    onClick={() => void sendResetLink()}
                    className="text-xs font-semibold text-lavender-500"
                  >
                    Password reset
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-rose-500">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>
            {authMode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword ? (
                  <p className="text-sm text-rose-500">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isPending || !canUseFirebaseLogin}
            >
              {canUseFirebaseLogin
                ? isPending
                  ? authMode === "signin"
                    ? "Signing in..."
                    : "Creating account..."
                  : authMode === "signin"
                    ? "Sign in to CensusSync"
                    : "Register and continue"
                : "Firebase web config required"}
            </Button>
          </form>
          {!canUseFirebaseLogin ? (
            <div className="rounded-[1.75rem] border border-dashed border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
              Real email/password login is disabled on this machine because the Firebase web config
              is not loaded. Add `NEXT_PUBLIC_FIREBASE_*` values and restart the dev server. Demo
              access still works below when explicitly enabled.
            </div>
          ) : null}
          <div className="rounded-[1.75rem] bg-lavender-50 p-4 text-sm text-muted-foreground">
            {authMode === "signin"
              ? "Disabled account? Contact your organization admin for reactivation or invite support."
              : "Choose the role you want for this account before registering. The app will route you into the matching workspace after signup."}
          </div>
        </CardContent>
      </Card>

      <Card
        id="demo-access"
        className="rounded-[2rem] bg-gradient-to-br from-lavender-50 via-white to-butter-50 p-2"
      >
        <CardHeader>
          <CardTitle className="font-display text-3xl">Demo-ready preview access</CardTitle>
          <CardDescription>
            Demo access is explicit and isolated. It uses `{env.demoSessionCookieName}` only when
            demo mode is enabled for seeded preview accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDemoMode ? (
            <>
              {[
                {
                  role: "employee",
                  description: "Preview the offline field collection flow, cached assignments, and sync experience."
                },
                {
                  role: "admin",
                  description: "Inspect organization analytics, campaign builder, user invites, and links."
                }
              ].map((entry) => (
                <button
                  key={entry.role}
                  type="button"
                  onClick={() => loginWithDemo(entry.role)}
                  className="w-full rounded-[1.75rem] border border-white/70 bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <p className="text-lg font-semibold capitalize">{entry.role} demo</p>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>
                </button>
              ))}
            </>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 p-5 text-sm text-muted-foreground">
              Demo mode is disabled. Add your Firebase credentials and sign in with a real account.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
