import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-3", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-soft">
        <span className="text-lg font-extrabold text-lavender-500">C</span>
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight">
        CensusSync
      </span>
    </Link>
  );
}
