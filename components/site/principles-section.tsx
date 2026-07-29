import { PRINCIPLE_COPY } from "@/lib/site/landing";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/**
 * The review criteria, stated as claims a reader can check.
 *
 * Each card names where it is enforced. A principle with no enforcement is a
 * preference, and this product does not ask to be trusted on preferences.
 */
export function PrinciplesSection() {
  return (
    <section id="principles" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Principles"
            title="Review criteria, not aspirations"
            lead="Eleven of these govern the repository; six are here. A change that violates one is wrong even if it works."
          />
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLE_COPY.map((principle, index) => (
            <Reveal
              key={principle.title}
              delayMs={index * 50}
              className="group bg-surface transition-colors duration-300 hover:bg-raised"
            >
              <article className="flex h-full flex-col p-6">
                <p className="font-mono text-[11px] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-sm font-medium text-ink">
                  {principle.title}
                </h3>
                <p className="mt-3 flex-1 text-sm/6 text-ink-muted">
                  {principle.body}
                </p>
                <p className="mt-5 border-t border-line pt-4 font-mono text-[11px] text-ink-faint transition-colors duration-300 group-hover:text-accent">
                  {principle.enforcedBy}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
