import type { Metadata } from "next";
import { NAV_ITEMS } from "@/components/os/nav";
import { AmbientBackdrop } from "@/components/site/ambient/ambient-backdrop";
import { ClosingSection } from "@/components/site/closing-section";
import { Hero } from "@/components/site/hero";
import { CustomCursor } from "@/components/site/interaction/custom-cursor";
import { PointerRoot } from "@/components/site/interaction/pointer-root";
import { PointerSpotlight } from "@/components/site/interaction/pointer-spotlight";
import { ScrollProgress } from "@/components/site/interaction/scroll-progress";
import { LoopSection } from "@/components/site/loop-section";
import { PrinciplesSection } from "@/components/site/principles-section";
import { RealitySection } from "@/components/site/reality-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { StackSection } from "@/components/site/stack-section";
import { TodaySection } from "@/components/site/today-section";
import { getAuthedUser } from "@/lib/auth/session";
import { landingLedger } from "@/lib/site/landing";

/** The header changes with who is asking, so this must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * The only public surface, and the only indexable one.
 *
 * Every private route inherits `robots: { index: false }` from the root layout,
 * which is right for a page that renders one person's records and wrong for the
 * page that explains what the product is. Stated here rather than loosened there,
 * so the default stays closed.
 */
export const metadata: Metadata = {
  title: "Adaptive Systems Interface",
  description:
    "A private intelligence layer for one person. Observe, understand, recommend, approve, act, remember — with isolation enforced by the database and nothing shown that cannot be traced to a record you own.",
  robots: { index: true, follow: true },
};

/**
 * ASI OS is a private system, so the front page sells nothing and shows no data.
 * It explains the loop, states which parts of it run, and offers the single door
 * that exists. A signed-in visitor is not redirected away: the header and both
 * calls to action simply become the way back into their own records, because a
 * root that bounces you is a root you can never read.
 *
 * The page is assembled from five separated layers — static sections, tokens,
 * motion, ambient, interaction — recorded in ADR 0006. The interaction and
 * ambient pieces mount here exactly once; sections never reach around them.
 *
 * See docs/DECISIONS/0005-the-front-page-states-the-build.md and
 * docs/DECISIONS/0006-the-front-page-is-five-layers.md.
 */
export default async function RootPage() {
  const user = await getAuthedUser();
  const signedIn = user !== null;
  const ledger = landingLedger(NAV_ITEMS);

  return (
    <>
      {/*
       * The scroll reveals start hidden in CSS. Without JavaScript nothing would
       * ever mark them visible, so the page states its own fallback rather than
       * rendering blank.
       */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important;filter:none !important}`}</style>
      </noscript>

      {/* Interaction layer: pointer state, scroll state, and their consumers. */}
      <PointerRoot />
      <ScrollProgress />
      <CustomCursor />
      <PointerSpotlight />

      {/* Ambient layer: the room the interface sits in. */}
      <AmbientBackdrop />

      {/* Static layer. `data-site` scopes the cursor and the page transition. */}
      <div id="top" data-site className="relative z-10 flex min-h-dvh flex-col">
        <SiteHeader signedIn={signedIn} />

        <main id="content" className="flex-1">
          <Hero signedIn={signedIn} />
          <LoopSection />
          <TodaySection />
          <PrinciplesSection />
          <RealitySection ledger={ledger} signedIn={signedIn} />
          <StackSection />
          <ClosingSection signedIn={signedIn} />
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
