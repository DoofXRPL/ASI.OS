import Link from "next/link";
import { NorthstarMark } from "@/components/brand/northstar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { loopStatusSentence } from "@/lib/site/landing";

/**
 * The first screen.
 *
 * One orchestrated entrance rather than a scattering of micro-interactions: the
 * mark, then the claim, then the qualification, each a beat behind the last. The
 * qualification is part of the pitch, not a footnote to it — a page that oversells
 * a product about trust has already lost the argument it is making.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <HeroBackdrop />

      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24 md:px-8 md:pt-28 md:pb-32">
        <div className="flex flex-col items-center text-center">
          <div className="animate-rise">
            <NorthstarMark animated className="size-20 md:size-24" />
          </div>

          <p className="mt-9 animate-rise font-mono text-[11px] tracking-[0.28em] text-ink-faint uppercase [animation-delay:90ms]">
            Adaptive Systems Interface
          </p>

          <h1 className="mt-5 max-w-3xl animate-rise text-4xl font-medium tracking-[-0.03em] text-balance text-ink [animation-delay:170ms] md:text-6xl">
            The loop is the product.
          </h1>

          <p className="mt-6 max-w-measure animate-rise text-statement text-pretty text-ink-muted [animation-delay:260ms]">
            A private intelligence layer for one person. Observe, understand,
            recommend, approve, act, remember.
          </p>

          <p className="mt-4 max-w-measure animate-rise text-sm text-pretty text-ink-faint [animation-delay:340ms]">
            {loopStatusSentence()}
          </p>

          <div className="mt-9 flex animate-rise flex-wrap items-center justify-center gap-3 [animation-delay:420ms]">
            <Link
              href={signedIn ? "/today" : "/login"}
              className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-void transition-colors duration-150 hover:bg-accent/90"
            >
              {signedIn ? "Open ASI OS" : "Sign in"}
            </Link>
            <a
              href="#reality"
              className="inline-flex h-10 items-center rounded-md border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink-faint"
            >
              What runs today
            </a>
          </div>

          <div className="mt-10 flex animate-rise flex-wrap items-center justify-center gap-2 [animation-delay:500ms]">
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

          <p className="mt-8 animate-rise text-xs text-ink-faint [animation-delay:560ms]">
            Access is by invitation. There is no public sign-up, and there are no
            teams, roles, or billing.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Four layers, none of them illustration: a survey grid for structure, two slow
 * lights, a sparse star field for the mark that names the product, and a vignette
 * so the section ends in the same black it started from.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 texture-grid opacity-70" />

      <div className="absolute top-[-18%] left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 animate-drift rounded-full bg-[radial-gradient(ellipse_at_center,var(--color-accent)_0%,transparent_65%)] opacity-[0.13] blur-3xl" />
      <div className="absolute top-[22%] right-[6%] h-[22rem] w-[26rem] animate-drift rounded-full bg-[radial-gradient(ellipse_at_center,var(--color-confirmed)_0%,transparent_66%)] opacity-[0.07] blur-3xl [animation-delay:-9s]" />

      <div className="absolute inset-0 animate-twinkle texture-stars opacity-60" />

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-void" />
    </div>
  );
}
