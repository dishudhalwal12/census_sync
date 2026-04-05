import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="section-shell flex min-h-screen items-center justify-center py-12">
      <Card className="max-w-xl rounded-[2.5rem] p-6 text-center">
        <CardContent className="space-y-5 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
            Access denied
          </p>
          <h1 className="font-display text-4xl font-semibold">
            Your account does not have access to this workspace.
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            CensusSync protects each route by role and jurisdiction scope. Head back to your home
            area or contact an admin if your assignment recently changed.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/app">Go to my dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
