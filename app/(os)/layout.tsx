import type { ReactNode } from "react";
import { AccountPanel } from "@/components/os/account-panel";
import { SideNav } from "@/components/os/side-nav";
import { SkipLink } from "@/components/os/skip-link";
import { isOwner, requireAuthedSession } from "@/lib/auth/session";

/**
 * Never prerendered, never cached.
 *
 * Every surface below this layout renders one person's private records. Without
 * this, Next.js prerenders the unauthenticated redirect at build time and can
 * serve that same response to a signed-in visitor. Stated explicitly rather than
 * relied upon as a side effect of reading cookies.
 */
export const dynamic = "force-dynamic";

/**
 * The shell for every private surface.
 *
 * Identity is resolved here rather than trusted from the proxy. The proxy is a
 * convenience that keeps unauthenticated visitors out; this layout is the
 * guarantee, and Row Level Security is the enforcement.
 */
export default async function OsLayout({ children }: { children: ReactNode }) {
  const session = await requireAuthedSession();

  return (
    <div className="relative flex min-h-dvh flex-col md:flex-row">
      <SkipLink />

      <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:w-56 md:border-r md:border-b-0">
        <div className="px-4 py-4">
          <p className="text-sm font-medium text-ink">ASI OS</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            Adaptive Systems Interface
          </p>
        </div>

        <div className="px-2 pb-3 md:flex-1 md:px-0">
          <SideNav />
        </div>

        <AccountPanel session={session} isOwner={isOwner(session)} />
      </aside>

      <main id="content" aria-label="Main content" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
