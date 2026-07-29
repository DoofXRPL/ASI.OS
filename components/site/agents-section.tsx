import { AGENTS, ROUTING } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { Stagger } from "./motion/stagger";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * Orchestration as a process, not a cast of characters: a horizontal flow, a
 * quiet roster, and the honest note that the design begins with one
 * Coordinator. Model routing lives here too, marked for what it is — a design
 * constraint, with no provider shown as integrated because none is.
 */
export function AgentsSection() {
  return (
    <section id="agents" className="scroll-mt-16 border-b border-edge">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Agent orchestration"
            aside={<StatusTag status={AGENTS.status} label={`Planned — ${AGENTS.phase}`} />}
            title={AGENTS.headline}
            lead="Agents are not isolated chatbots. They are designed to work through one shared context layer, under defined permissions, toward a recommendation a person can inspect."
          />
        </Reveal>

        {/* The flow: five stations on one line. */}
        <Reveal index={1} className="mt-10">
          <ol className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
            {AGENTS.flow.map((step, index) => (
              <li key={step} className="flex items-center gap-2 md:flex-1">
                <div className="w-full rounded-md border border-edge bg-panel px-3 py-2.5 md:w-auto md:flex-1">
                  <p className="font-mono text-[11px] text-mist">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-carbon">{step}</p>
                </div>
                {index < AGENTS.flow.length - 1 ? (
                  <span aria-hidden="true" className="hidden h-px w-6 shrink-0 bg-edge-strong md:block" />
                ) : null}
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
              Planned specialists
            </p>
            <Stagger className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {AGENTS.roster.map((agent) => (
                <div
                  key={agent}
                  className="rounded-md border border-edge bg-panel px-3 py-2 font-mono text-xs text-graphite"
                >
                  {agent}
                </div>
              ))}
            </Stagger>
            <p className="mt-4 max-w-lg text-[13px]/5 text-mist">{AGENTS.honesty}</p>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Model routing
              </p>
              <StatusTag status={ROUTING.status} />
            </div>
            <p className="mt-4 max-w-lg text-sm/6 text-graphite">
              {ROUTING.headline} The choice is specified to weigh:
            </p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {ROUTING.criteria.map((criterion) => (
                <li
                  key={criterion}
                  className="rounded border border-edge bg-wash px-2 py-1 font-mono text-[11px] text-graphite"
                >
                  {criterion}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-lg text-[13px]/5 text-mist">{ROUTING.honesty}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
