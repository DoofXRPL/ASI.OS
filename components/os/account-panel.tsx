import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { getDevSignIn } from "@/lib/auth/dev-sign-in";
import type { AuthedSession } from "@/lib/auth/session";

/**
 * Who you are signed in as, and how to leave.
 *
 * The owner badge reflects the database's own `is_owner` flag rather than a guess
 * from the email address, so what is shown is what the database will actually
 * enforce.
 *
 * When the development sign-in shortcut is active, this says so. Being signed
 * in without having asked is exactly what a product about trust must not do
 * quietly, and the marker is also the fastest way to notice the shortcut is
 * still on when you meant to be testing the real thing.
 */
export function AccountPanel({
  session,
  isOwner,
}: {
  session: AuthedSession;
  isOwner: boolean;
}) {
  const name = session.profile.display_name?.trim();
  const autoSignedIn = getDevSignIn() !== null;

  return (
    <div className="space-y-2.5 border-t border-line px-3 py-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs text-ink">
            {name ?? session.user.email ?? "Signed in"}
          </p>
          {isOwner ? <Badge tone="confirmed">owner</Badge> : null}
        </div>
        {name && session.user.email ? (
          <p className="truncate font-mono text-[11px] text-ink-faint">
            {session.user.email}
          </p>
        ) : null}
      </div>

      {autoSignedIn ? (
        // Sign out still works — it ends this session. It just cannot stick,
        // because the next request creates another one. Saying so is the
        // difference between a control that behaves unexpectedly and a control
        // whose behaviour was explained.
        <p className="text-[11px] leading-snug text-attention">
          Signed in automatically — development shortcut. Signing out ends this
          session and the next request starts a new one. Unset{" "}
          <code className="font-mono">ASI_DEV_SIGN_IN_EMAIL</code> to require the
          form again.
        </p>
      ) : null}

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
