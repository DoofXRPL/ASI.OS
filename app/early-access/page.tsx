import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/site/early-access/early-access-form";
import { Reveal } from "@/components/site/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteSkipLink } from "@/components/site/skip-link";
import { getAuthedUser } from "@/lib/auth/session";
import { EARLY_ACCESS } from "@/lib/site/early-access";

/** The header changes with who is asking, so this must never be prerendered. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request early access — ASI.OS",
  description:
    "ASI.OS is in active development. Tell us how you plan to use it so we can prioritize the right builders during early access.",
  robots: { index: true, follow: true },
};

/**
 * The second public surface, and the first one that writes.
 *
 * It is the front page's shell — same header, same footer, same palette and
 * the same entrance — narrowed to a single column, because a form is read one
 * question at a time and the twelve-column grid the front page argues on has
 * nothing to hold here.
 *
 * The form exists at all because there is now somewhere for a submission to
 * go: `public.request_early_access()` writes to a table in the `access`
 * schema. Until that endpoint existed the page would have been a control that
 * changes nothing, which is why ADR 0007 refused one and ADR 0008 revisits it.
 */
export default async function EarlyAccessPage() {
  const user = await getAuthedUser();
  const signedIn = user !== null;

  return (
    <>
      {/*
       * The entrance starts hidden in CSS. Without JavaScript nothing would
       * mark it visible, so the page states its own fallback rather than
       * rendering blank — the form below works without JavaScript, and it
       * would be absurd for the heading above it not to.
       */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <div className="site-light flex min-h-dvh flex-col bg-canvas text-carbon [color-scheme:light]">
        <SiteSkipLink />
        <SiteHeader signedIn={signedIn} onHome={false} />

        <main id="content" className="flex-1">
          <div className="mx-auto w-full max-w-[42rem] px-5 pt-16 pb-24 md:px-8 md:pt-24 md:pb-32">
            <header>
              <Reveal>
                <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
                  {EARLY_ACCESS.eyebrow}
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-balance text-carbon md:text-[2.75rem] md:leading-[1.1]">
                  {EARLY_ACCESS.headline}
                </h1>
              </Reveal>

              <Reveal index={1}>
                <p className="mt-6 text-[17px]/8 text-pretty text-graphite">
                  {EARLY_ACCESS.lead} {EARLY_ACCESS.support}
                </p>
              </Reveal>

              <Reveal index={2}>
                <p className="mt-4 text-sm/6 text-mist">{EARLY_ACCESS.note}</p>
              </Reveal>
            </header>

            <Reveal index={3} className="mt-14">
              <EarlyAccessForm />
            </Reveal>
          </div>
        </main>

        <SiteFooter onHome={false} />
      </div>
    </>
  );
}
