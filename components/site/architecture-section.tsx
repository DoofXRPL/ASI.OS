import { ARCHITECTURE_LAYERS } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { Stagger } from "./motion/stagger";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * The system as layers, drawn the way an infrastructure company would draw it:
 * rows on a spine, thin connectors, and a status per layer — because the most
 * interesting fact about this architecture is which parts of it are real.
 */
export function ArchitectureSection() {
  return (
    <section id="architecture" className="scroll-mt-16 border-b border-edge">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Architecture"
            title="Intelligence should be coordinated, not improvised."
            lead="Six layers with one dependency direction. Each carries its build status, so the diagram is also the truth about the system."
          />
        </Reveal>

        <Stagger className="mt-12" itemClassName="relative">
          {ARCHITECTURE_LAYERS.map((layer, index) => (
            <div
              key={layer.index}
              className="relative grid gap-2 border-l border-edge-strong py-5 pl-6 sm:grid-cols-12 sm:gap-6 md:pl-10"
            >
              {/* The node on the spine. */}
              <span
                aria-hidden="true"
                className="absolute top-[26px] -left-[5px] size-2.5 rounded-full border border-edge-strong bg-panel"
              />
              {index < ARCHITECTURE_LAYERS.length - 1 ? null : (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 -left-px h-5 w-px bg-canvas"
                />
              )}

              <div className="flex items-baseline gap-3 sm:col-span-3">
                <span className="font-mono text-[11px] text-mist">{layer.index}</span>
                <h3 className="text-sm font-semibold text-carbon">{layer.name}</h3>
              </div>
              <p className="text-sm/6 text-graphite sm:col-span-4">{layer.body}</p>
              <p className="text-[13px]/5 text-mist sm:col-span-3">{layer.note}</p>
              <div className="sm:col-span-2 sm:text-right">
                <StatusTag status={layer.status} />
              </div>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
