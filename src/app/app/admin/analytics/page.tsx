import { CampaignAnalyticsClient } from "@/components/admin/campaign-analytics-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCampaignAnalytics } from "@/lib/campaigns/server";
import { requireSession } from "@/lib/server/session";

export default async function AdminAnalyticsPage() {
  const session = await requireSession(["admin"]);
  const analytics = await getCampaignAnalytics(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live analytics"
        title="Track response volume, employee activity, channel mix, and verified field coverage"
        description="Analytics refresh automatically so admins can monitor campaigns in near real time."
      />
      <CampaignAnalyticsClient initialPayload={analytics} />
    </div>
  );
}
