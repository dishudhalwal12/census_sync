"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { NAV_BY_ROLE, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AuthSession } from "@/types/session";

export function SidebarNav({ session }: { session: AuthSession }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[session.role];

  return (
    <aside className="surface hidden w-80 shrink-0 flex-col gap-8 p-6 xl:flex">
      <div className="space-y-3">
        <Badge variant="lavender">{ROLE_LABELS[session.role]}</Badge>
        <div>
          <p className="font-display text-3xl font-semibold">CensusSync</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Premium census operations cockpit for offline-first collection.
          </p>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-lavender-100 text-foreground shadow-sm"
                  : "text-black/65 hover:bg-black/5 hover:text-black"
              )}
            >
              {item.label}
              {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-lavender-400" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl bg-gradient-to-br from-lavender-100 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">
          Assignment Scope
        </p>
        <p className="mt-3 text-base font-semibold">
          {session.scopes[0]?.district ?? "District scope pending"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.scopes[0]?.block ?? "Block scope pending"}
        </p>
      </div>
    </aside>
  );
}
