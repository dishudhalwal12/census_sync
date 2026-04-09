import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { runtimeModeLabel } from "@/lib/env";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams?.next ?? "/app";

  return (
    <div className="section-shell min-h-screen py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Badge variant="lavender">Secure access</Badge>
          <Badge variant={runtimeModeLabel === "Live Firebase" ? "lavender" : "warning"}>
            {runtimeModeLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="surface flex flex-col justify-between rounded-[2.5rem] bg-gradient-to-br from-[#201633] via-[#3b2a63] to-[#6449a0] p-8 text-white">
          <div>
            <Badge className="bg-white/10 text-white">Offline-first GovTech</Badge>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-tight">
              Secure census campaigns for admins, employees, and public participants.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/72">
              Org-scoped access, resilient offline capture, AI-assisted question design, and live analytics in one census operations platform.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              "PWA-ready offline shell",
              "Session-cookie protected routes",
              "Dexie-powered drafts and queue",
              "Scope-aware dashboards"
            ].map((item) => (
              <div key={item} className="rounded-[1.75rem] bg-white/10 p-4">
                <ShieldCheck className="h-5 w-5" />
                <p className="mt-4 text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
