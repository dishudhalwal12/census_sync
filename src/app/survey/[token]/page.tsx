import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PublicCampaignForm } from "@/components/public/public-campaign-form";
import { getPublicCampaignPackageByToken } from "@/lib/campaigns/server";

export default async function PublicSurveyPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pkg = await getPublicCampaignPackageByToken(token);

  if (!pkg) {
    redirect("/unauthorized");
  }

  return (
    <div className="section-shell min-h-screen py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Badge variant="warning">Public survey</Badge>
      </div>
      <div className="mx-auto max-w-4xl">
        <PublicCampaignForm pkg={pkg} token={token} />
      </div>
    </div>
  );
}
