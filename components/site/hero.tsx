import { NorthstarMark } from "@/components/brand/northstar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { loopStatusSentence } from "@/lib/site/landing";
import { CtaLink } from "./cta-link";
import { Depth } from "./interaction/depth";
import { Reveal } from "./motion/reveal";

/**
 * The first screen. Static content only — the entrance belongs to the motion
 * layer, the light behind it to the ambient layer.
 *
 * One orchestrated arrival rather than a scattering of micro-interactions: the
 * mark, then the claim, then the qualification, each one stagger step behind
 * the last. The qualification is part of the pitch, not a footnote to it — a
 * page that oversells a product about trust has already lost the argument it
 * is making.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24 md:px-8 md:pt-28 md:pb-32">
        <div className="flex flex-col items-center text-center">
          <Reveal index={0}>
            <Depth pointer={10}>
              <NorthstarMark animated className="size-20 md:size-24" />
            </Depth>
          </Reveal>

          <Reveal index={1} className="mt-9">
            <p className="font-mono text-[11px] tracking-[0.28em] text-ink-faint uppercase">
              Adaptive Systems Interface
            </p>
          </Reveal>

          <Reveal index={2} className="mt-5">
            <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.03em] text-balance text-ink md:text-6xl">
              The loop is the product.
            </h1>
          </Reveal>

          <Reveal index={3} className="mt-6">
            <p className="max-w-measure text-statement text-pretty text-ink-muted">
              A private intelligence layer for one person. Observe, understand,
              recommend, approve, act, remember.
            </p>
          </Reveal>

          <Reveal index={4} className="mt-4">
            <p className="max-w-measure text-sm text-pretty text-ink-faint">
              {loopStatusSentence()}
            </p>
          </Reveal>

          <Reveal index={5} className="mt-9">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaLink href={signedIn ? "/today" : "/login"}>
                {signedIn ? "Open ASI OS" : "Sign in"}
              </CtaLink>
              <a
                href="#reality"
                className="inline-flex h-10 items-center rounded-md border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-ink-faint"
              >
                What runs today
              </a>
            </div>
          </Reveal>

          <Reveal index={6} className="mt-10">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge tone="thinking">
                <StatusDot tone="thinking" />
                Phase 1 of 5
              </Badge>
              <Badge tone="neutral">No AI layer yet</Badge>
              <Badge tone="neutral">No integrations</Badge>
              <Badge tone="neutral">No external network calls</Badge>
              <Badge tone="confirmed">
                <StatusDot tone="confirmed" />
                Isolation proven by tests
              </Badge>
            </div>
          </Reveal>

          <Reveal index={7} className="mt-8">
            <p className="text-xs text-ink-faint">
              Access is by invitation. There is no public sign-up, and there are
              no teams, roles, or billing.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
