import { Bell, Smartphone, UserCog } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/server/session";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Profile, preferences, and device sync controls"
        description="Manage your account profile, notification preferences, and offline device behavior."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-4 p-6">
            <UserCog className="h-10 w-10 text-lavender-500" />
            <h3 className="text-xl font-semibold">Profile</h3>
            <p className="text-sm text-muted-foreground">{session.name}</p>
            <p className="text-sm text-muted-foreground">{session.email}</p>
            <p className="text-sm text-muted-foreground">
              Role: <span className="font-semibold capitalize text-foreground">{session.role}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Smartphone className="h-10 w-10 text-lavender-500" />
            <h3 className="text-xl font-semibold">Offline device behavior</h3>
            <p className="text-sm text-muted-foreground">
              PWA caching is enabled, drafts persist locally, and queued submissions retry when the
              device reconnects.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Bell className="h-10 w-10 text-lavender-500" />
            <h3 className="text-xl font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Toasts surface sync progress, validation results, and export activity directly inside
              the app workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
