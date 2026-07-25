import type { Metadata } from "next";
import { PageHeader } from "@/components/os/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { findNavItem } from "@/components/os/nav";
import { isOwner, requireAuthedSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/db/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

const NAV = findNavItem("/settings");

/**
 * A short list of time zones is offered when the runtime cannot enumerate them,
 * rather than an empty select. The reader's own zone is always included so the
 * current value is never silently lost.
 */
function listTimeZones(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles"];

  return supported.includes(current) ? supported : [current, ...supported];
}

export default async function SettingsPage() {
  const session = await requireAuthedSession();
  const settings = await getSettings(session.user.id);

  return (
    <>
      <PageHeader
        title="Settings"
        stage={NAV?.stage ?? "System"}
        purpose={NAV?.purpose ?? ""}
      />

      <Card>
        <CardHeader
          title="Identity"
          description="Every control here is wired to a real record. Nothing on this page is a placeholder."
        />
        <CardBody>
          <SettingsForm
            displayName={session.profile.display_name}
            timezone={session.profile.timezone}
            timeFormat={settings.timeFormat}
            timezones={listTimeZones(session.profile.timezone)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Account"
          description="Read from the database, not inferred."
        />
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink">
                {session.user.email ?? "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Role</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink">
                {isOwner(session) ? "owner" : "member"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Account created</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink">
                {session.profile.created_at.slice(0, 10)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Account identifier</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-ink-faint">
                {session.user.id}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Privacy"
          description="How isolation is enforced, stated plainly."
        />
        <CardBody className="space-y-2.5 text-sm text-ink-muted">
          <p>
            Every record is owned by exactly one account and protected by
            PostgreSQL Row Level Security. The application has no privileged
            database credential, so there is no code path that can read another
            account&apos;s data — not a bug to be avoided, but a capability that
            does not exist.
          </p>
          <p>
            Your history is append-only. Neither you nor ASI can edit or delete an
            activity record once written.
          </p>
          <p>
            Deleting your account removes every record it owns by database cascade.
            Self-service export and deletion are not built yet, so they are not
            offered here.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
