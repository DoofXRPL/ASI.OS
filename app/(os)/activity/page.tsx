import type { Metadata } from "next";
import { PageHeader } from "@/components/os/page-header";
import { Failed, NothingYet } from "@/components/os/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { findNavItem } from "@/components/os/nav";
import { requireAuthedSession } from "@/lib/auth/session";
import { ACTIVITY_PAGE_SIZE, listActivity } from "@/lib/audit/log";
import { getSettings } from "@/lib/db/settings";
import { describeEventType, isKnownEventType } from "@/lib/schemas/activity";
import { formatTimestamp } from "@/lib/format/datetime";

export const metadata: Metadata = { title: "Activity" };

const NAV = findNavItem("/activity");

export default async function ActivityPage() {
  const session = await requireAuthedSession();
  const [settings, result] = await Promise.all([
    getSettings(session.user.id),
    listActivity(session.user.id, { limit: ACTIVITY_PAGE_SIZE }),
  ]);

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };

  if (!result.ok) {
    return (
      <>
        <PageHeader
          title="Activity"
          stage={NAV?.stage ?? "Remember"}
          purpose={NAV?.purpose ?? ""}
        />
        {/* An unreadable history and an empty one are different facts, and
            showing the second when the first is true would be the interface
            making a confident claim it cannot support. */}
        <Failed
          headline="Your history could not be read."
          detail={`${result.error} Nothing has been lost: this trail is append-only and no read can alter it.`}
        />
      </>
    );
  }

  const activity = result.data;

  return (
    <>
      <PageHeader
        title="Activity"
        stage={NAV?.stage ?? "Remember"}
        purpose={NAV?.purpose ?? ""}
      />

      <Card>
        <CardHeader
          title="History"
          description="Append-only. Nothing here can be edited or deleted, including by you."
          actions={
            activity.events.length > 0 ? (
              <Badge tone="neutral">
                {activity.events.length}
                {activity.hasMore ? "+" : ""}
              </Badge>
            ) : undefined
          }
        />
        <CardBody className={activity.events.length > 0 ? "px-0 py-0" : undefined}>
          {activity.events.length === 0 ? (
            <NothingYet
              headline="No activity recorded yet."
              detail="This fills as you use ASI. Every sign-in, identity change and — in later phases — every recommendation, approval and action is written here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {activity.events.map((event) => (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm text-ink">{event.summary}</span>
                      {/* An unrecognised event type is shown as-is rather than
                          hidden: the audit trail is more important than the
                          interface's vocabulary. */}
                      {!isKnownEventType(event.event_type) ? (
                        <Badge tone="attention">unrecognised</Badge>
                      ) : null}
                    </div>
                    <time
                      dateTime={event.occurred_at}
                      className="font-mono text-xs text-ink-faint"
                    >
                      {formatTimestamp(event.occurred_at, prefs)}
                    </time>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-faint">
                    {describeEventType(event.event_type)} · {event.actor}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {activity.hasMore ? (
        <p className="text-xs text-ink-faint">
          Showing the {ACTIVITY_PAGE_SIZE} most recent events. Older history is
          retained and will become reachable when filtering and paging are built.
        </p>
      ) : null}
    </>
  );
}
