import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ATTENTION_RULES } from "@/lib/site/landing";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/**
 * The closest thing to a product screenshot on this page.
 *
 * It is the real ranking, listed by the reason codes the derivation emits, rather
 * than a mockup with invented projects in it. A landing page that fakes a
 * dashboard to sell a product whose first rule is "never fabricate" would be
 * arguing against itself.
 */
export function TodaySection() {
  return (
    <section id="today" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="How Today decides"
            title="Four rules over your own rows, in a fixed order"
            lead="Today is a pure function. It reads projects and captures you wrote, applies these four rules, and every item it produces carries the id of the record it came from. Nothing is scored, weighted, or called urgent — elapsed time is a fact, while lateness would be a judgement about a commitment nobody made."
          />

          <p className="mt-6 text-sm/6 text-ink-muted">
            Explicit signals outrank inferred ones: a blocker you wrote down beats
            a project missing its next action, which beats a queue you have not
            looked at, which beats mere inactivity.
          </p>

          <p className="mt-6 text-sm/6 text-ink-muted">
            When none of the four fires, Today says so with confidence and names
            why. &ldquo;Nothing needs you&rdquo; is a designed state, not a blank
            one.
          </p>
        </Reveal>

        <Reveal delayMs={80}>
          <Card>
            <CardHeader
              title="Attention rules"
              description="From lib/derive/attention.ts — the whole list, in evaluation order."
            />
            <CardBody className="p-0">
              <ol className="divide-y divide-line">
                {ATTENTION_RULES.map((rule, index) => (
                  <li key={rule.reason} className="flex gap-4 px-4 py-4">
                    <span className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-accent">{rule.reason}</p>
                      <p className="mt-1.5 text-sm/6 text-ink-muted">
                        {rule.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <p className="mt-4 text-xs text-ink-faint">
            Each item links back to the record that produced it. An assertion with
            no row behind it cannot be rendered, because the type has nowhere to
            put one.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
