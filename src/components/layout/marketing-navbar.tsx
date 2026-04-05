import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { LANDING_NAV } from "@/lib/constants";

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="section-shell">
        <div className="glass soft-ring flex items-center justify-between rounded-full px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 lg:flex">
            {LANDING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-black/70 transition hover:text-black"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href="/login#demo-access">Book Demo</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
