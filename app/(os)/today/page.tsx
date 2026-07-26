import type { Metadata } from "next";
import Link from "next/link";
import { AttentionList } from "@/components/os/attention-list";
import { PageHeader } from "@/components/os/page-header";
import { Section } from "@/components/os/section";
import { CalmState, Failed, NothingYet } from "@/components/os/states";
import { findNavItem } from "@/components/os/nav";
import { requireAuthedSession } from "@/lib/auth/session";
import { greetingFor } from "@/lib/auth/session";
import { listInboxItems } from "@/lib/db/inbox";
import { listProjects } from "@/lib/db/projects";
import { getSettings } from "@/lib/db/settings";
import { deriveTodayState } from "@/lib/derive/today";
import { formatRelative } from "@/lib/format/datetime";
import { asSentence } from "@/lib/format/text";

export const metadata: Metadata = { title: "Today" };

const NAV = findNavItem("/today");

/**
 * What is true right now.
 *
 * Every sentence on this page comes from `deriveTodayState`, which is pure and
 * exhaustively tested, so what Today says can never drift away from the rows it
 * describes. The page's job is only to choose which of the honest states to
 * render — and which sections exist at all, since a section with nothing in it
 * is not a section.
 */
export default async function TodayPage() {
  const session = await requireAuthedSession();

  const [settings, projects, unprocessed, allCaptures] = await Promise.all([
    getSettings(session.user.id),
    listProjects(session.user.id),
    listInboxItems(session.user.id, { status: "unprocessed", limit: 100 }),
    listInboxItems(session.user.id, { limit: 1 }),
  ]);

  if (!projects.ok || !unprocessed.ok || !allCaptures.ok) {
    const error = !projects.ok
      ? projects.error
      : !unprocessed.ok
        ? unprocessed.error
        : "Your captures could not be read.";

    return (
      <>
        <PageHeader
          title="Today"
          stage={NAV?.stage ?? "Observe"}
          purpose={NAV?.purpose ?? ""}
        />
        <Failed
          headline="Today cannot be derived right now."
          detail={`${asSentence(error)} Rather than show you a page that might be wrong about your own records, it shows you nothing. Reload to try again.`}
        />
      </>
    );
  }

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };

  const state = deriveTodayState({
    projects: projects.data,
    unprocessed: unprocessed.data.items,
    unprocessedTotal: unprocessed.data.total,
    capturesTotal: allCaptures.data.total,
  });

  return (
    <>
      <PageHeader
        title="Today"
        stage={NAV?.stage ?? "Observe"}
        purpose={NAV?.purpose ?? ""}
      />

      <section className="space-y-1.5">
        <h2 className="text-sm text-ink-muted">{greetingFor(session.profile)}</h2>
        {/* A sentence rather than a number: a number needs interpreting, a
            sentence is the interpretation. */}
        <p className="max-w-measure text-statement text-ink">{state.headline}</p>
      </section>

      {state.nothingYet ? (
        <NothingYet
          headline="ASI is holding nothing yet."
          detail="It can only tell you what is true of records you have made. Capture one thing — a task, a question, a half-formed idea — and this page starts describing your own work."
          action={
            <Link href="/inbox" className="text-sm text-accent hover:underline">
              Capture something
            </Link>
          }
        />
      ) : null}

      {state.attention.length > 0 ? (
        <Section
          title="Needs you"
          count={state.attention.length}
          description="Derived from your records, in the order of how explicitly you said each one matters. Nothing here is a guess, a deadline, or a score."
        >
          <AttentionList items={state.attention} />
        </Section>
      ) : null}

      {state.calm ? (
        <CalmState headline="Nothing needs you." detail={state.calmDetail} />
      ) : null}

      {state.resume ? (
        <Section
          title="Easiest to resume"
          description="The active project you touched most recently, and what it is waiting on."
        >
          <div className="border-l-2 border-line-strong pl-4">
            <h3 className="text-sm text-ink">
              <Link
                href={`/projects/${state.resume.id}`}
                className="hover:underline"
              >
                {state.resume.name}
              </Link>
            </h3>
            <p className="mt-1 max-w-measure text-sm text-ink-muted">
              {state.resume.next_action}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              touched {formatRelative(state.resume.last_touched_at, prefs)}
            </p>
          </div>
        </Section>
      ) : null}
    </>
  );
}
