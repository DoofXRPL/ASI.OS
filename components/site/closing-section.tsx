import Link from "next/link";
import { NorthstarMark } from "@/components/brand/northstar";
import { Reveal } from "./reveal";

/**
 * The last screen. One action, stated as what it is: a door into one person's
 * records. No newsletter, no demo request, no second CTA competing with the only
 * one that exists.
 */
export function ClosingSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 texture-grid opacity-50" />
        <div className="absolute bottom-[-40%] left-1/2 h-[30rem] w-[44rem] -translate-x-1/2 animate-drift rounded-full bg-[radial-gradient(ellipse_at_center,var(--color-accent)_0%,transparent_65%)] opacity-[0.1] blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8 md:py-28">
        <Reveal className="flex flex-col items-center text-center">
          <NorthstarMark animated className="size-12" />

          <h2 className="mt-8 max-w-2xl text-2xl font-medium tracking-[-0.02em] text-balance text-ink md:text-4xl">
            A system you can check, not one you have to believe.
          </h2>

          <p className="mt-5 max-w-measure text-sm/6 text-pretty text-ink-muted">
            Isolation is enforced by PostgreSQL and proven against two real
            accounts on every commit. The application holds no privileged
            credential, so there is no code path that could read someone
            else&rsquo;s records.
          </p>

          <Link
            href={signedIn ? "/today" : "/login"}
            className="mt-9 inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-void transition-colors duration-150 hover:bg-accent/90"
          >
            {signedIn ? "Open ASI OS" : "Sign in"}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
