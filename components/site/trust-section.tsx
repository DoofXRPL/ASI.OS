import { TRUST_DESIGNED, TRUST_ENFORCED } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * Trust as implementation detail, split honestly in two: what the repository
 * enforces today, each claim with its mechanism, and what the design commits
 * to for capabilities that do not exist yet. No grade-words, no absolutes —
 * only claims something can be held to.
 */
export function TrustSection() {
  return (
    <section id="security" className="scroll-mt-16 border-b border-edge">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Trust and security"
            title="Intelligence must remain accountable."
            lead="Security claims are cheap; mechanisms are not. Everything on the left is enforced in the repository now. Everything on the right is a commitment the design will be held to as the system grows."
          />
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-8">
          <Reveal index={1}>
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Enforced today
              </h3>
              <StatusTag status="running" />
            </div>
            <ul className="mt-4 divide-y divide-edge border-y border-edge">
              {TRUST_ENFORCED.map((item) => (
                <li key={item.claim} className="py-3.5">
                  <p className="text-sm font-medium text-carbon">{item.claim}</p>
                  <p className="mt-1 font-mono text-xs/5 text-mist">{item.mechanism}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal index={2}>
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                Committed by design
              </h3>
              <StatusTag status="planned" />
            </div>
            <ul className="mt-4 divide-y divide-edge border-y border-edge">
              {TRUST_DESIGNED.map((item) => (
                <li key={item} className="py-3.5 text-sm/6 text-graphite">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-lg text-[13px]/5 text-mist">
              The user remains the highest authority. Capability can grow over time; authority
              does not grow with it automatically.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
