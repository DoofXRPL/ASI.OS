import { MEMORY } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * Obsidian Brain, presented as what it is: a specified memory architecture,
 * not a running feature. The most honest visual for an unbuilt memory system
 * is its schema — the fields every memory will carry, and the lifecycle that
 * keeps it correctable. No decorative graph.
 */
export function MemorySection() {
  return (
    <section id="memory" className="scroll-mt-16 border-b border-edge bg-wash">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-5">
          <SectionHeading
            eyebrow="Obsidian Brain"
            aside={<StatusTag status={MEMORY.status} label={`Planned — ${MEMORY.phase}`} />}
            title={MEMORY.headline}
            lead={MEMORY.body[0]}
          />
          <p className="mt-4 max-w-2xl text-[15px]/6 text-graphite">{MEMORY.body[1]}</p>

          <p className="mt-8 font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
            Designed to preserve
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {MEMORY.remembers.map((item) => (
              <li key={item} className="text-[13px]/6 text-graphite">
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal index={1} className="lg:col-span-7">
          <div className="rounded-lg border border-edge bg-panel shadow-lift">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Anatomy of a memory
              </p>
              <p className="font-mono text-[11px] text-mist">specification</p>
            </div>

            <dl>
              {MEMORY.fields.map((field) => (
                <div
                  key={field.name}
                  className="grid grid-cols-[7rem_1fr] gap-4 border-b border-edge px-4 py-3"
                >
                  <dt className="font-mono text-xs text-accent-ink">{field.name}</dt>
                  <dd className="text-[13px]/5 text-graphite">{field.detail}</dd>
                </div>
              ))}
            </dl>

            <div className="border-b border-edge px-4 py-3">
              <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Lifecycle
              </p>
              <p className="mt-2 font-mono text-xs text-graphite">
                suggested → confirmed → superseded <span className="text-mist">|</span> forgotten
              </p>
            </div>

            <ul className="space-y-2 px-4 py-3">
              {MEMORY.rules.map((rule) => (
                <li key={rule} className="flex gap-2.5 text-[13px]/5 text-graphite">
                  <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-carbon" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
