import { HERO, STATUS_PANEL } from "@/lib/site/landing";
import { CtaLink } from "./cta-link";
import { Reveal } from "./motion/reveal";
import { StatusTag } from "./status-tag";

/**
 * The first screen: a left-aligned product statement beside a panel of system
 * facts. The panel is the hero visual on purpose — the most credible thing an
 * infrastructure product can show first is an honest status readout, and every
 * row in it must stay true against the repository.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative border-b border-edge">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] site-grid-faint"
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pt-16 pb-16 md:px-8 md:pt-24 md:pb-20 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <Reveal index={0}>
            <p className="inline-flex items-center gap-2 rounded-md border border-edge bg-panel px-2.5 py-1 font-mono text-[11px] tracking-tight text-graphite">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-confirmed-ink" />
              {HERO.statusNote} · built in the open
            </p>
          </Reveal>

          <Reveal index={1}>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.03em] text-balance text-carbon md:text-[3.25rem] md:leading-[1.08]">
              {HERO.headline}
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-6 max-w-xl text-base/7 text-pretty text-graphite">
              {HERO.support}
            </p>
          </Reveal>

          <Reveal index={3}>
            <p className="mt-3 max-w-xl text-sm/6 text-mist">{HERO.clarifier}</p>
          </Reveal>

          <Reveal index={4}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaLink href="#product">Explore the system</CtaLink>
              <CtaLink variant="secondary" href={signedIn ? "/today" : "/login"}>
                {signedIn ? "Open ASI.OS" : "Request access"}
              </CtaLink>
            </div>
          </Reveal>
        </div>

        <Reveal index={2} className="lg:col-span-5">
          <div className="rounded-lg border border-edge bg-panel shadow-lift">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                System status
              </p>
              <p className="font-mono text-[11px] text-mist">asi.os</p>
            </div>
            <dl>
              {STATUS_PANEL.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 border-b border-edge px-4 py-2.5 last:border-b-0"
                >
                  <dt className="shrink-0 text-[13px] text-mist">{row.label}</dt>
                  <dd className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right text-[13px] text-carbon">
                    {row.value}
                    {row.status ? <StatusTag status={row.status} /> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
