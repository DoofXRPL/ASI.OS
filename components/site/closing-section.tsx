import { NorthstarMark } from "@/components/brand/northstar";
import { CtaLink } from "./cta-link";
import { Depth } from "./interaction/depth";
import { Reveal } from "./motion/reveal";

/**
 * The last screen. One action, stated as what it is: a door into one person's
 * records. No newsletter, no demo request, no second CTA competing with the
 * only one that exists. The room light behind it belongs to the ambient layer;
 * only the section's own accent glow lives here.
 */
export function ClosingSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      {/* Softness painted, not filtered — see the note in the ambient layer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-40%] left-1/2 -z-10 h-[30rem] w-[44rem] -translate-x-1/2 animate-drift bg-[radial-gradient(ellipse_50%_50%_at_center,var(--color-accent)_0%,transparent_72%)] opacity-[0.09]"
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8 md:py-28">
        <div className="flex flex-col items-center text-center">
          <Reveal index={0}>
            <Depth pointer={8}>
              <NorthstarMark animated className="size-12" />
            </Depth>
          </Reveal>

          <Reveal index={1} className="mt-8">
            <h2 className="max-w-2xl text-2xl font-medium tracking-[-0.02em] text-balance text-ink md:text-4xl">
              A system you can check, not one you have to believe.
            </h2>
          </Reveal>

          <Reveal index={2} className="mt-5">
            <p className="max-w-measure text-sm/6 text-pretty text-ink-muted">
              Isolation is enforced by PostgreSQL and proven against two real
              accounts on every commit. The application holds no privileged
              credential, so there is no code path that could read someone
              else&rsquo;s records.
            </p>
          </Reveal>

          <Reveal index={3} className="mt-9">
            <CtaLink href={signedIn ? "/today" : "/login"} className="px-5">
              {signedIn ? "Open ASI OS" : "Sign in"}
            </CtaLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
