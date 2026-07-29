import { ACCESS, REPO_URL } from "@/lib/site/landing";
import { CtaLink } from "./cta-link";
import { Reveal } from "./motion/reveal";

/**
 * The close. Two real doors — the invitation-only sign-in and the public
 * repository — and no form, because a form that submits nowhere would be the
 * exact kind of control this product refuses to ship.
 */
export function AccessSection() {
  return (
    <section className="border-b border-edge">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
            Early access
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-balance text-carbon md:text-4xl">
            {ACCESS.headline}
          </h2>
          <p className="mt-5 text-[15px]/7 text-pretty text-graphite">{ACCESS.body}</p>
          <p className="mt-4 text-sm/6 text-mist">{ACCESS.note}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CtaLink href="/login">Request access</CtaLink>
            <CtaLink variant="secondary" href={REPO_URL} target="_blank" rel="noreferrer">
              Follow development on GitHub
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
