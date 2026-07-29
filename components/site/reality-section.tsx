import { Badge, StatusDot } from "@/components/ui/badge";
import type { LandingLedger } from "@/lib/site/landing";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/**
 * The ledger: what works, and what is missing.
 *
 * The left column is generated from the navigation spine, so this page cannot
 * name a surface the application does not serve. The right column is written
 * copy, but each entry disappears the moment its surface enters that spine — the
 * list can go out of date only by becoming shorter.
 *
 * Paths are shown as text rather than as links. A signed-out visitor clicking
 * one would be bounced to sign-in, and an invitation-only product should not hand
 * out doors that do not open.
 */
export function RealitySection({
  ledger,
  signedIn,
}: {
  ledger: LandingLedger;
  signedIn: boolean;
}) {
  return (
    <section id="reality" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="What runs today"
            title="Five surfaces exist. The rest return a real 404."
            lead="A surface enters the navigation in the release that makes it work, never earlier. Empty shells badged “soon” are the most expensive kind of dishonesty in a product about trust, so the routes below are the whole system."
          />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="flex items-center gap-2">
              <StatusDot tone="confirmed" />
              <h3 className="font-mono text-[11px] tracking-[0.24em] text-ink-muted uppercase">
                Working, with your records
              </h3>
            </div>

            <ul className="mt-6 divide-y divide-line border-y border-line">
              {ledger.working.map((surface) => (
                <li
                  key={surface.href}
                  className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-baseline sm:gap-5"
                >
                  <div className="flex shrink-0 items-baseline gap-2.5 sm:w-40">
                    <span className="text-sm font-medium text-ink">
                      {surface.label}
                    </span>
                    <code className="font-mono text-[11px] text-ink-faint">
                      {surface.href}
                    </code>
                  </div>
                  <p className="text-sm/6 text-ink-muted">{surface.purpose}</p>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-ink-faint">
              {signedIn
                ? "You are signed in — these are already yours."
                : "Signing in is the only way past this page. Every row behind it belongs to one account and is isolated by the database."}
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="flex items-center gap-2">
              <StatusDot tone="neutral" />
              <h3 className="font-mono text-[11px] tracking-[0.24em] text-ink-muted uppercase">
                Not built
              </h3>
            </div>

            <ul className="mt-6 divide-y divide-line border-y border-line">
              {ledger.absent.map((item) => (
                <li key={item.label} className="py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-ink-muted">
                      {item.label}
                    </span>
                    <Badge tone="neutral" className="text-ink-faint">
                      {item.phase}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm/6 text-ink-faint">{item.detail}</p>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-ink-faint">
              Listed because they are absent, not because they are imminent. None
              of them appears in the interface until it holds real data.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
