import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import type { AuthSession } from "@/types/session";

export function AppShell({
  session,
  runtimeModeLabel,
  children
}: {
  session: AuthSession;
  runtimeModeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-shell flex min-h-screen gap-6 py-6">
      <SidebarNav session={session} />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={session.isDemo ? "warning" : "lavender"}>
                {session.isDemo ? "Demo mode active" : "Authenticated session"}
              </Badge>
              <Badge variant={runtimeModeLabel === "Live Firebase" ? "lavender" : "warning"}>
                {runtimeModeLabel}
              </Badge>
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold">
                Welcome back, {session.name.split(" ")[0]}
              </h1>
              <p className="text-sm text-muted-foreground">
                Offline-first field operations with live validation, coverage, and export visibility.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm">
              {session.email}
            </div>
            <Avatar name={session.name} />
            <LogoutButton ownerUid={session.uid} />
          </div>
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
