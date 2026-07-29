import type { LandingLedger } from "@/lib/site/landing";
import { CURRENT_STATUS, ROADMAP } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { Stagger } from "./motion/stagger";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * The build, stated plainly: the surfaces that run (generated from the
 * navigation spine, so the list cannot lie), the surfaces that are absent, and
 * a roadmap where exactly one phase is in progress and nothing is marked done
 * until it ships.
 */
export function StatusRoadmapSection({ ledger }: { ledger: LandingLedger }) {
  return (
    <section id="roadmap" className="scroll-mt-16 border-b border-edge bg-wash">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Status"
            title={CURRENT_STATUS.headline}
            lead={CURRENT_STATUS.body}
          />
          <ul className="mt-5 flex flex-wrap gap-2">
            {CURRENT_STATUS.facts.map((fact) => (
              <li
                key={fact}
                className="rounded border border-edge bg-panel px-2.5 py-1 font-mono text-[11px] text-graphite"
              >
                {fact}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* What runs, from the navigation spine. */}
          <Reveal index={1} className="lg:col-span-6">
            <h3 className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
              Running today, with real records
            </h3>
            <ul className="mt-4 divide-y divide-edge border-y border-edge">
              {ledger.working.map((surface) => (
                <li key={surface.href} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                  <div className="flex w-36 shrink-0 items-baseline gap-2.5">
                    <span className="text-sm font-medium text-carbon">{surface.label}</span>
                    <code className="font-mono text-[11px] text-mist">{surface.href}</code>
                  </div>
                  <p className="text-[13px]/5 text-graphite">{surface.purpose}</p>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
              Not built
            </h3>
            <ul className="mt-3 space-y-2.5">
              {ledger.absent.map((item) => (
                <li key={item.label} className="text-[13px]/5 text-mist">
                  <span className="font-medium text-graphite">{item.label}</span>
                  <span className="mx-1.5 font-mono text-[11px]">({item.phase})</span>
                  — {item.detail}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* The roadmap. */}
          <div className="lg:col-span-6">
            <Reveal index={1}>
              <h3 className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Built in deliberate stages
              </h3>
            </Reveal>
            <Stagger from={2} className="mt-4">
              {ROADMAP.map((phase) => (
                <div
                  key={phase.index}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-b border-edge py-3 first:border-t"
                >
                  <span className="font-mono text-[11px] text-mist">{phase.index}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-carbon">{phase.name}</p>
                    <p className="mt-0.5 text-[13px]/5 text-graphite">{phase.body}</p>
                  </div>
                  <StatusTag
                    status={phase.status === "in_progress" ? "in_development" : "planned"}
                    label={phase.status === "in_progress" ? "In progress" : "Planned"}
                  />
                </div>
              ))}
            </Stagger>
            <p className="mt-4 text-[13px]/5 text-mist">
              Nothing here is marked complete until it ships. Where a phase is partly real, the
              running parts are listed on the left.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
