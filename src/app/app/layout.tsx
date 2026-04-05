import { AppShell } from "@/components/layout/app-shell";
import { getRuntimeModeLabel } from "@/lib/server/runtime";
import { requireSession } from "@/lib/server/session";

export default async function AuthenticatedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const runtimeModeLabel = getRuntimeModeLabel();

  return (
    <AppShell session={session} runtimeModeLabel={runtimeModeLabel}>
      {children}
    </AppShell>
  );
}
