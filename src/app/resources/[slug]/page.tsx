import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getResourceArticle, resourceArticles } from "@/lib/resources";

export function generateStaticParams() {
  return resourceArticles.map((article) => ({ slug: article.slug }));
}

export default async function ResourceArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getResourceArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="section-shell min-h-screen py-8">
      <PageHeader
        eyebrow="Resource article"
        title={article.title}
        description={article.summary}
      />
      <Card className="mt-8">
        <CardContent className="space-y-8 p-8">
          <p className="text-base leading-8 text-black/75">{article.intro}</p>
          {article.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
