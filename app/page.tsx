import type { Metadata } from "next";
import { NAV_ITEMS } from "@/components/os/nav";
import { AccessSection } from "@/components/site/access-section";
import { AgentsSection } from "@/components/site/agents-section";
import { ApprovalSection } from "@/components/site/approval-section";
import { ArchitectureSection } from "@/components/site/architecture-section";
import { Hero } from "@/components/site/hero";
import { MemorySection } from "@/components/site/memory-section";
import { PreviewSection } from "@/components/site/preview-section";
import { ProblemSection } from "@/components/site/problem-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteSkipLink } from "@/components/site/skip-link";
import { StatusRoadmapSection } from "@/components/site/status-roadmap-section";
import { TrustSection } from "@/components/site/trust-section";
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
  title: "ASI.OS — The Intelligence Operating System",
  description:
    "ASI.OS is a personal intelligence operating system being built to connect persistent memory, specialized agents, model routing, and permission-based execution in one human-controlled system.",
  robots: { index: true, follow: true },
};

/**
 * A technical product document, light-first, in the order a serious reader
 * would ask questions: what is it, what does it look like, what problem, how
 * is it built, what remembers, who acts, who approves, why trust it, what runs
 * today, and how to get in. Every capability carries a visible build status,
 * and mock interfaces appear only as labelled design targets.
 *
 * A signed-in visitor is not redirected away: the calls to action become the
 * way back into their own records, because a root that bounces you is a root
 * you can never read.
 *
 * See docs/DECISIONS/0005..0007 for how this page earned each of its rules.
 */
export default async function RootPage() {
  const user = await getAuthedUser();
  const signedIn = user !== null;
  const ledger = landingLedger(NAV_ITEMS);

  return (
    <>
      {/*
       * The scroll reveals start hidden in CSS. Without JavaScript nothing
       * would ever mark them visible, so the page states its own fallback
       * rather than rendering blank.
       */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <div id="top" className="site-light flex min-h-dvh flex-col bg-canvas text-carbon [color-scheme:light]">
        <SiteSkipLink />
        <SiteHeader signedIn={signedIn} />

        <main id="content" className="flex-1">
          <Hero signedIn={signedIn} />
          <PreviewSection />
          <ProblemSection />
          <ArchitectureSection />
          <MemorySection />
          <AgentsSection />
          <ApprovalSection />
          <TrustSection />
          <StatusRoadmapSection ledger={ledger} />
          <AccessSection />
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
