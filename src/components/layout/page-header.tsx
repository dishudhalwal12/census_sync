import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: { label: string; href?: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <Badge variant="lavender">{eyebrow}</Badge> : null}
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? (
        <Button asChild>
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : null}
    </div>
  );
}
