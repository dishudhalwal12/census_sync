import Link from "next/link";
import { ArrowRight, Globe2, MapPinned, ShieldCheck } from "lucide-react";

import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingPage() {
  return (
    <div className="pb-20">
      <MarketingNavbar />

      <section className="section-shell relative pt-10 lg:pt-14">
        <div className="surface relative overflow-hidden rounded-[2.5rem] px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="absolute inset-0 bg-hero-grid opacity-90" />
          <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-2xl">
              <Badge variant="lavender" className="mb-6">
                Offline-first field survey operations platform
              </Badge>
              <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-black sm:text-6xl lg:text-7xl">
                Meet the Offline-first Field Survey Operations Platform
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-black/65 sm:text-lg">
                CensusSync gives field enumerators resilient offline collection, while supervisors
                and admins track validation, geo-tagged coverage, sync health, and export-ready
                reporting for census drives, NGO surveys, campus outreach, and local audits.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">Get Started - Free</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login#demo-access">Book a Demo</Link>
                </Button>
              </div>
            </div>

            <div className="relative flex items-center justify-center pb-10 lg:pb-0">
              <div className="absolute inset-x-16 top-16 h-72 rounded-full bg-lavender-100/70 blur-3xl" />
              <Card className="relative z-10 w-full max-w-md rounded-[2.5rem] p-4">
                <CardContent className="space-y-4 p-4">
                  <div className="rounded-[2rem] bg-gradient-to-br from-[#1f1731] to-[#4d3782] p-5 text-white shadow-halo">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/60">
                          Field capture
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold">Household Survey</h3>
                      </div>
                      <Badge className="bg-white/15 text-white">Offline ready</Badge>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-white/10 p-4">
                        <p className="text-white/60">Sync health</p>
                        <p className="mt-2 text-xl font-semibold">98%</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <p className="text-white/60">Coverage</p>
                        <p className="mt-2 text-xl font-semibold">78%</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <div className="rounded-[2rem] bg-lavender-50 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-black/45">
                            Household profile
                          </p>
                          <p className="mt-2 text-lg font-semibold">Sunita Verma</p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                          Synced
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-black/65">
                        <p>Ward 7, Block A</p>
                        <p>4 members, owned dwelling, geo-tag captured</p>
                      </div>
                    </div>
                    <div className="rounded-[2rem] bg-[#fff7d8] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-black/45">Dashboards</p>
                      <div className="mt-3 space-y-2">
                        <div className="h-2 rounded-full bg-black/10" />
                        <div className="h-2 w-4/5 rounded-full bg-black/20" />
                        <div className="h-24 rounded-[1.5rem] bg-white/80" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </section>

      <section className="section-shell mt-8">
        <div className="surface rounded-[2.25rem] px-6 py-6">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.26em] text-black/45">
            Used by districts, survey teams, and public-sector field operations
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-center text-sm font-semibold text-black/45 sm:grid-cols-3 lg:grid-cols-6">
            {["South District Ops", "Civic Census Lab", "Metro Ward Office", "Block Survey Cell", "Rural Data Unit", "Population Mission"].map(
              (org) => (
                <div key={org} className="rounded-full border border-black/5 bg-white px-4 py-3">
                  {org}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section id="product" className="section-shell mt-14">
        <div className="mb-10 text-center">
          <Badge variant="lavender">Premium workflows</Badge>
          <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
            A field operations platform designed for real survey teams
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Every surface is tuned for fast field capture, elegant oversight, and confident export
            workflows across census, community, campus, and audit projects without falling back to
            stale paper systems.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="overflow-hidden bg-gradient-to-br from-lavender-100 to-white">
            <CardContent className="grid gap-8 p-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <Badge variant="lavender">Offline Field Collection</Badge>
                <h3 className="mt-4 font-display text-3xl font-semibold">
                  Enumerators keep moving even when networks drop
                </h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Multi-step household forms auto-save locally, capture optional geo-tags, and queue
                  submissions with resilient retry logic.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Draft recovery", "Autosave", "Validation at source", "Retry-safe sync"].map(
                    (chip) => (
                      <Badge key={chip} variant="default">
                        {chip}
                      </Badge>
                    )
                  )}
                </div>
              </div>
              <div className="rounded-[2rem] bg-white/90 p-5 shadow-soft">
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-[#1d1830] p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/55">Tablet form</p>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 rounded-full bg-white/20" />
                      <div className="h-2 w-4/5 rounded-full bg-white/15" />
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="h-16 rounded-2xl bg-white/10" />
                        <div className="h-16 rounded-2xl bg-white/10" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-peach-50 p-4 text-sm font-semibold">Geo-tag</div>
                    <div className="rounded-2xl bg-butter-50 p-4 text-sm font-semibold">Draft</div>
                    <div className="rounded-2xl bg-lavender-50 p-4 text-sm font-semibold">Queued</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {[
              {
                title: "Live Sync Monitoring",
                body: "Supervisors see sync lag, field health, and validation movement in one clean pane.",
                tone: "from-[#fff1bb] to-white"
              },
              {
                title: "Geo-tagged Coverage Mapping",
                body: "Interactive district maps surface coverage gaps, proof of visit, and missing-coordinate counts.",
                tone: "from-[#f8ddff] to-white"
              }
            ].map((card) => (
              <Card key={card.title} className={`bg-gradient-to-br ${card.tone}`}>
                <CardContent className="p-8">
                  <h3 className="font-display text-3xl font-semibold">{card.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{card.body}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge variant="default">Coverage live</Badge>
                    <Badge variant="default">Filter aware</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="workflows" className="section-shell mt-14">
        <Card className="rounded-[2.5rem] p-8">
          <div className="text-center">
            <Badge variant="lavender">Operational benchmark gains</Badge>
            <h2 className="mt-4 font-display text-4xl font-semibold">
              Achieving superior field operation benchmarks
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { value: "392%", label: "increase in reporting visibility" },
              { value: "11.7 min", label: "faster review cycles" },
              { value: "20x", label: "improvement in submission discoverability" },
              { value: "288%", label: "better sync transparency" }
            ].map((metric) => (
              <div key={metric.label} className="rounded-[2rem] border border-black/5 bg-lavender-50 p-6 text-center">
                <p className="text-4xl font-extrabold">{metric.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section id="solutions" className="section-shell mt-14 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-8">
          <Badge variant="lavender">Results from the field</Badge>
          <div className="mt-5 grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="rounded-[2rem] bg-gradient-to-br from-peach-100 to-butter-50 p-6" />
            <div>
              <p className="text-lg font-semibold">
                “CensusSync gave our supervisors the first reliable view of offline field progress,
                flagged duplicates faster, and helped us close district coverage gaps before the
                reporting deadline.”
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Rahul Mehta, District Supervisor
              </p>
              <div className="mt-6 flex gap-2">
                <span className="h-2.5 w-8 rounded-full bg-black" />
                <span className="h-2.5 w-2.5 rounded-full bg-black/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-black/20" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-lavender-100 to-white p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
            Supporting stat panel
          </p>
          <div className="mt-8 space-y-5">
            {[
              { label: "Households synchronized", value: "9677" },
              { label: "Export-ready summaries", value: "140.1K" },
              { label: "Coverage confidence uplift", value: "29.95%" }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/80 p-4">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section id="resources" className="section-shell mt-14">
        <div className="mb-8 text-center">
          <Badge variant="lavender">Latest insights</Badge>
          <h2 className="mt-4 font-display text-4xl font-semibold">Field intelligence from the blog</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "How offline-first systems improve district coverage",
              icon: Globe2,
              slug: "offline-first-coverage"
            },
            {
              title: "Reducing census delays with sync-aware workflows",
              icon: ShieldCheck,
              slug: "sync-aware-workflows"
            },
            {
              title: "Why geo-tagged submissions improve accountability",
              icon: MapPinned,
              slug: "geotagged-accountability"
            }
          ].map((item, index) => (
            <Card key={item.title} className={index === 0 ? "bg-lavender-50" : index === 1 ? "bg-butter-50" : "bg-peach-50"}>
              <CardContent className="p-8">
                <item.icon className="h-10 w-10 text-black/70" />
                <h3 className="mt-6 text-2xl font-semibold leading-snug">{item.title}</h3>
                <Button asChild variant="ghost" className="mt-6 px-0">
                  <Link href={`/resources/${item.slug}`}>
                    Read more <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pricing" className="section-shell mt-14">
        <Card className="rounded-[2.5rem] bg-gradient-to-br from-[#201633] to-[#4d3782] p-10 text-white">
          <div className="max-w-3xl">
            <Badge className="bg-white/15 text-white">Launch your next census operation</Badge>
            <h2 className="mt-5 font-display text-4xl font-semibold sm:text-5xl">
              Move from paper lag to live district visibility with one premium platform.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
              Bring enumerators, supervisors, and administrators into the same offline-first
              workflow with beautiful dashboards, validation controls, and export-ready analytics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/login#demo-access">Book a Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-white text-black hover:bg-white/90">
                <Link href="/login">Launch CensusSync</Link>
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <footer className="section-shell mt-10 flex flex-col gap-4 pb-10 text-sm text-black/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 CensusSync. Premium census operations software.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/">Product</Link>
          <Link href="/">Company</Link>
          <Link href="/">Resources</Link>
          <Link href="/">Legal</Link>
        </div>
      </footer>
    </div>
  );
}
