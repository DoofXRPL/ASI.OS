import type { Metadata } from "next";
import { NAV_ITEMS } from "@/components/os/nav";
import { ClosingSection } from "@/components/site/closing-section";
import { Hero } from "@/components/site/hero";
import { LoopSection } from "@/components/site/loop-section";
import { PointerGlow } from "@/components/site/pointer-glow";
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
 * See docs/DECISIONS/0005-the-front-page-states-the-build.md.
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
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <PointerGlow />

      <div id="top" className="relative z-10 flex min-h-dvh flex-col">
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
