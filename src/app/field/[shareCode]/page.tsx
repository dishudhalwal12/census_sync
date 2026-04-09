import { redirect } from "next/navigation";

import { CampaignWorkspace } from "@/components/employee/campaign-workspace";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCampaignFieldPackageByToken } from "@/lib/campaigns/server";
import { getSession } from "@/lib/server/session";

export default async function EmployeeFieldCampaignPage({
  params
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/field/${shareCode}`)}`);
  }

  if (session.role !== "employee" && session.role !== "admin") {
    redirect("/unauthorized");
  }

  const campaignPackage = await getCampaignFieldPackageByToken(shareCode, session);

  return (
    <div className="section-shell min-h-screen py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Badge variant="lavender">Secure field link</Badge>
      </div>
      {campaignPackage ? (
        <CampaignWorkspace
          session={session}
          initialPackage={campaignPackage}
          assignmentId={campaignPackage.assignment.id}
          token={shareCode}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This secure field link is not available for the signed-in employee. Make sure the assigned
            employee opens the correct link once while online before relying on offline mode.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
