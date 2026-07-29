import { PROBLEM } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { Stagger } from "./motion/stagger";
import { SectionHeading } from "./section-heading";

/**
 * The product problem, stated in the product's own calm terms: disconnected
 * inputs above, one context layer below. The diagram is boxes and hairlines
 * because the problem is structural, not dramatic.
 */
export function ProblemSection() {
  return (
    <section id="product" className="scroll-mt-16 border-b border-edge">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-5">
          <SectionHeading
            eyebrow="The problem"
            title={PROBLEM.headline}
            lead={PROBLEM.body[0]}
          />
          <p className="mt-4 max-w-2xl text-[15px]/6 text-graphite">{PROBLEM.body[1]}</p>
          <p className="mt-6 border-l-2 border-edge-strong pl-4 text-sm/6 text-mist">
            Your tools remember files. ASI.OS is being built to remember direction.
          </p>
        </Reveal>

        <div className="lg:col-span-7" aria-label="Fragmented inputs flowing into one context layer">
          <Stagger
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            itemClassName="min-w-0"
          >
            {PROBLEM.inputs.map((input) => (
              <div
                key={input}
                className="rounded-md border border-edge bg-panel px-3 py-2.5 text-[13px] text-graphite"
              >
                <span aria-hidden="true" className="mr-2 inline-block size-1.5 rounded-full bg-edge-strong align-middle" />
                {input}
              </div>
            ))}
          </Stagger>

          <Reveal index={2}>
            <div aria-hidden="true" className="mx-auto h-8 w-px bg-edge-strong" />
            <div className="rounded-md border border-carbon/20 bg-carbon px-4 py-3.5 text-center">
              <p className="text-sm font-medium text-white">{PROBLEM.outcome}</p>
              <p className="mt-0.5 font-mono text-[11px] text-white/60">
                goals · history · decisions · what happens next
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
