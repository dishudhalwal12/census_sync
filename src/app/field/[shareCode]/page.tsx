import { redirect } from "next/navigation";

import { MissionWorkspace } from "@/components/missions/mission-workspace";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMissionPackageByShareCode } from "@/lib/data/server";
import { getSession } from "@/lib/server/session";

export default async function SharedFieldMissionPage({
  params
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/field/${shareCode}`)}`);
  }

  if (session.role !== "enumerator") {
    redirect("/unauthorized");
  }

  const missionPackage = await getMissionPackageByShareCode(shareCode, session);

  return (
    <div className="section-shell min-h-screen py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Badge variant="lavender">Secure field link</Badge>
      </div>
      {missionPackage ? (
        <MissionWorkspace session={session} initialPackage={missionPackage} shareCode={shareCode} />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This secure field link is not available for the signed-in user. Make sure the assigned
            enumerator opens the link, or cache it once while online before trying again offline.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
