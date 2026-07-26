import type { Metadata } from "next";
import { asSentence } from "@/lib/format/text";
import { PageHeader } from "@/components/os/page-header";
import { Section } from "@/components/os/section";
import { CalmState, Failed, NothingYet } from "@/components/os/states";
import { findNavItem } from "@/components/os/nav";
import { requireAuthedSession } from "@/lib/auth/session";
import { listInboxItems } from "@/lib/db/inbox";
import { listProjects } from "@/lib/db/projects";
import { getSettings } from "@/lib/db/settings";
import { isOpen } from "@/lib/derive/projects";
import { CaptureForm } from "./capture-form";
import { ProcessedList, UnprocessedList } from "./inbox-list";

export const metadata: Metadata = { title: "Inbox" };

const NAV = findNavItem("/inbox");

/**
 * The queue is bounded so one very long history cannot make the page slow.
 * Counts come from the database rather than from the returned rows, so a
 * truncated list never turns into an undercount.
 */
const QUEUE_LIMIT = 100;
const PROCESSED_LIMIT = 25;

export default async function InboxPage() {
  const session = await requireAuthedSession();

  const [settings, unprocessed, processed, archived, projects] = await Promise.all([
    getSettings(session.user.id),
    listInboxItems(session.user.id, { status: "unprocessed", limit: QUEUE_LIMIT }),
    listInboxItems(session.user.id, { status: "processed", limit: PROCESSED_LIMIT }),
    listInboxItems(session.user.id, { status: "archived", limit: PROCESSED_LIMIT }),
    listProjects(session.user.id),
  ]);

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };

  // Only the captures themselves can take this page down. Projects are needed
  // to route a capture, not to make one, and capture is the thing that must
  // always work: refusing to accept a thought because a secondary read failed
  // would break the one promise the inbox makes.
  const captureFailure = [unprocessed, processed, archived].find((r) => !r.ok);
  if (captureFailure && !captureFailure.ok) {
    return (
      <>
        <PageHeader
          title="Inbox"
          stage={NAV?.stage ?? "Observe"}
          purpose={NAV?.purpose ?? ""}
        />
        <Failed
          headline="Your captures could not be read."
          detail={`${asSentence(captureFailure.error)} Nothing has been lost — this is a read failure, not a write one. Reload to try again.`}
        />
      </>
    );
  }

  if (!unprocessed.ok || !processed.ok || !archived.ok) return null;

  const waiting = unprocessed.data;
  const settled = [...processed.data.items, ...archived.data.items].sort((a, b) =>
    (b.processed_at ?? b.created_at).localeCompare(a.processed_at ?? a.created_at),
  );
  const settledTotal = processed.data.total + archived.data.total;
  const everCaptured = waiting.total + settledTotal > 0;

  // Only open projects are offered as destinations. Routing a live thought into
  // something you finished or abandoned is almost never what was meant.
  const projectOptions = projects.ok
    ? projects.data.filter(isOpen).map((project) => ({ id: project.id, name: project.name }))
    : [];

  const projectNames = new Map(
    projects.ok ? projects.data.map((p) => [p.id, p.name] as const) : [],
  );

  return (
    <>
      <PageHeader
        title="Inbox"
        stage={NAV?.stage ?? "Observe"}
        purpose={NAV?.purpose ?? ""}
      />

      <Section
        title="Capture"
        description="One field, no decisions. What you write is stored exactly as written and is never edited afterwards, including by you."
      >
        <div className="max-w-measure">
          <CaptureForm autoFocus={waiting.total === 0} />
        </div>
      </Section>

      {waiting.total > 0 ? (
        <Section
          title="Waiting"
          count={waiting.total}
          description="Each of these is still undecided. Processing one says what it is for; it never rewrites what you wrote."
        >
          <UnprocessedList
            items={waiting.items}
            projects={projectOptions}
            projectsUnavailable={!projects.ok}
            prefs={prefs}
          />
        </Section>
      ) : everCaptured ? (
        <CalmState
          headline="Your inbox is clear."
          detail={`Everything you have captured has been decided on. ${settledTotal} in total.`}
        />
      ) : (
        <NothingYet
          headline="Nothing captured yet."
          detail="Write one line above. You do not have to know what it is for — that is what processing is for, later."
        />
      )}

      {settled.length > 0 ? (
        <Section
          title="Processed"
          count={settledTotal}
          description="What each capture became. Kept because the decision is part of the record."
        >
          <ProcessedList items={settled} projectNames={projectNames} prefs={prefs} />
        </Section>
      ) : null}
    </>
  );
}
