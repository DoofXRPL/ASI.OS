import { PRINCIPLE_COPY } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { Stagger } from "./motion/stagger";
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

        {/*
         * The lift lives on the article, not on the reveal wrapper: both effects
         * are transforms, and an element cannot serve two transition shorthands
         * at once. The cell keeps the card colour so nothing shows through
         * beneath a lifted article.
         */}
        <Stagger
          from={1}
          className="mt-14 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-2 lg:grid-cols-3"
          itemClassName="group bg-surface"
        >
          {PRINCIPLE_COPY.map((principle, index) => (
            <article
              key={principle.title}
              className="flex h-full flex-col bg-surface p-6 hover-raise hover:bg-raised"
            >
              <p className="font-mono text-[11px] text-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-sm font-medium text-ink">
                {principle.title}
              </h3>
              <p className="mt-3 flex-1 text-sm/6 text-ink-muted">
                {principle.body}
              </p>
              <p className="mt-5 border-t border-line pt-4 font-mono text-[11px] text-ink-faint transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:text-accent">
                {principle.enforcedBy}
              </p>
            </article>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
