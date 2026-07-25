import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/os/page-header";
import { CalmState, NothingYet } from "@/components/os/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { findNavItem } from "@/components/os/nav";
import { listActivity } from "@/lib/audit/log";
import { getSettings } from "@/lib/db/settings";
import { greetingFor, requireAuthedSession } from "@/lib/auth/session";
import { deriveTodayState, tracksCommitments } from "@/lib/derive/today";
import { describeEventType } from "@/lib/schemas/activity";
import { formatRelative } from "@/lib/format/datetime";

export const metadata: Metadata = { title: "Today" };

const NAV = findNavItem("/today");

export default async function TodayPage() {
  const session = await requireAuthedSession();
  const [settings, activity] = await Promise.all([
    getSettings(session.user.id),
    listActivity(session.user.id, { limit: 5 }),
  ]);

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };
  const state = deriveTodayState({
    recentEvents: activity.events,
    tracksCommitments: tracksCommitments(),
  });

  return (
    <>
      <PageHeader
        title="Today"
        stage={NAV?.stage ?? "Observe"}
        purpose={NAV?.purpose ?? ""}
      />

      <section className="space-y-1.5">
        <h2 className="text-sm text-ink-muted">
          {greetingFor(session.profile)}
        </h2>
        {/* A sentence rather than a number: a number needs interpreting, a
            sentence is the interpretation. */}
        <p className="text-base text-ink">{state.headline}</p>
      </section>

      <CalmState headline="Nothing needs you." detail={state.detail} />

      <Card>
        <CardHeader
          title="Recent activity"
          description="Read directly from the append-only audit trail."
          actions={
            <Link
              href="/activity"
              className="text-xs text-accent hover:underline"
            >
              View all
            </Link>
          }
        />
        <CardBody>
          {state.lastEvent === null ? (
            <NothingYet
              headline="No activity recorded yet."
              detail="Signing in, signing out, and changing your identity are all recorded here."
            />
          ) : (
            <ul className="space-y-3">
              {activity.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                >
                  <span className="text-sm text-ink">
                    {describeEventType(event.event_type)}
                  </span>
                  <span className="font-mono text-xs text-ink-faint">
                    {formatRelative(event.occurred_at, prefs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
