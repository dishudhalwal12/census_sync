import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { resourceArticles } from "@/lib/resources";

export default function ResourcesPage() {
  return (
    <div className="section-shell min-h-screen py-8">
      <PageHeader
        eyebrow="Resources"
        title="Field intelligence for survey and census teams"
        description="Short practical notes on offline workflows, sync operations, and geo-tagged accountability."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {resourceArticles.map((article) => (
          <Card key={article.slug}>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-2xl font-semibold">{article.title}</h2>
              <p className="text-sm leading-7 text-muted-foreground">{article.summary}</p>
              <Link
                href={`/resources/${article.slug}`}
                className="text-sm font-semibold text-lavender-500"
              >
                Read article
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
