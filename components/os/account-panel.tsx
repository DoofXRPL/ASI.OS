import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthedSession } from "@/lib/auth/session";

/**
 * Who you are signed in as, and how to leave.
 *
 * The owner badge reflects the database's own `is_owner` flag rather than a guess
 * from the email address, so what is shown is what the database will actually
 * enforce.
 */
export function AccountPanel({
  session,
  isOwner,
}: {
  session: AuthedSession;
  isOwner: boolean;
}) {
  const name = session.profile.display_name?.trim();

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

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
