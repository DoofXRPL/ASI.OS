import { STACK } from "@/lib/site/landing";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/**
 * The stack, and the deliberate absences in it.
 *
 * Named without version numbers: a version on a page nobody rebuilds is a
 * fabricated fact within a month. The last entry is the most important one.
 */
export function StackSection() {
  return (
    <section id="stack" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Stack"
            title="Small on purpose, and short one whole layer"
            lead="No vector database, queue, worker, realtime channel, or cron job. Each of those arrives when something measurably needs it and can name the problem it solves."
          />
        </Reveal>

        <Reveal delayMs={80}>
          <dl className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {STACK.map((entry) => (
              <div key={entry.name} className="border-t border-line pt-4">
                <dt className="text-sm font-medium text-ink">{entry.name}</dt>
                <dd className="mt-1.5 text-xs/5 text-ink-muted">{entry.role}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
