import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/os/page-header";
import { Section } from "@/components/os/section";
import { StatusChip } from "@/components/os/status-chip";
import { Failed } from "@/components/os/states";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/disclosure";
import { requireAuthedSession } from "@/lib/auth/session";
import { listInboxItemsForProject } from "@/lib/db/inbox";
import { getProject } from "@/lib/db/projects";
import { getSettings } from "@/lib/db/settings";
import { hasNextAction } from "@/lib/derive/projects";
import { describeKind, describeProcessedInto } from "@/lib/schemas/inbox";
import { formatRelative, formatTimestamp } from "@/lib/format/datetime";
import { NextActionForm } from "./next-action-form";
import { OutcomeForm } from "./outcome-form";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Project" };

/**
 * One project, and the answer to the only question it has to answer: what moves
 * this forward?
 *
 * The next action is the top of the page for that reason. Outcome and status
 * sit behind disclosures — they change rarely, and a page that opens with four
 * editable forms is a page nobody reads.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuthedSession();

  const project = await getProject(session.user.id, id);

  if (!project.ok) {
    return (
      <>
        <PageHeader
          title="Project"
          stage="Understand"
          purpose="What you are trying to make true, and what moves it forward."
        />
        <Failed
          headline="This project could not be read."
          detail={`${project.error} Nothing has been changed. Reload to try again.`}
        />
      </>
    );
  }

  // A project that is not yours and a project that does not exist are the same
  // answer from here. Distinguishing them would turn this page into a way to
  // test whether an identifier exists.
  if (!project.data) notFound();

  const [settings, captures] = await Promise.all([
    getSettings(session.user.id),
    listInboxItemsForProject(session.user.id, project.data.id),
  ]);

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };
  const row = project.data;

  return (
    <>
      <PageHeader
        title={row.name}
        stage="Understand"
        purpose={row.outcome ?? "No outcome recorded yet — say what will be true when this is done."}
        actions={<StatusChip status={row.status} />}
      />

      {row.status === "blocked" && row.blocked_reason ? (
        <div className="border-l-2 border-attention pl-4">
          <h2 className="text-xs font-medium text-attention">Blocked</h2>
          <p className="mt-1 max-w-measure text-statement text-ink">
            {row.blocked_reason}
          </p>
        </div>
      ) : null}

      <Section
        title="Next action"
        description="The single thing that moves this forward. Everything else on this page is context for it."
      >
        <p className="max-w-measure text-statement text-ink">
          {hasNextAction(row)
            ? row.next_action
            : "Not decided. Nothing in your records says what moves this forward."}
        </p>

        <Disclosure
          summary={hasNextAction(row) ? "Change it" : "Decide it"}
          defaultOpen={!hasNextAction(row)}
          className="pt-1"
        >
          <div className="max-w-measure pt-1">
            <NextActionForm projectId={row.id} nextAction={row.next_action} />
          </div>
        </Disclosure>
      </Section>

      <Section
        title="Captures"
        count={captures.ok ? captures.data.length : undefined}
        description="What you captured that led here, kept exactly as you wrote it."
      >
        {!captures.ok ? (
          <Failed
            headline="The captures linked to this project could not be read."
            detail={captures.error}
          />
        ) : captures.data.length === 0 ? (
          <p className="max-w-measure text-sm text-ink-muted">
            Nothing is linked yet. Processing something from your{" "}
            <Link href="/inbox" className="text-accent hover:underline">
              inbox
            </Link>{" "}
            into this project will list it here.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {captures.data.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 max-w-measure text-sm whitespace-pre-wrap text-ink">
                    {item.content}
                  </p>
                  {describeKind(item.kind) ? (
                    <Badge tone="neutral">{describeKind(item.kind)}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {describeProcessedInto(item.processed_into) ?? "Unprocessed"} ·
                  captured {formatRelative(item.created_at, prefs)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="This project">
        <div className="space-y-4">
          <Disclosure summary="Outcome">
            <div className="max-w-measure pt-1">
              <OutcomeForm projectId={row.id} outcome={row.outcome} />
            </div>
          </Disclosure>

          <Disclosure summary="Status">
            <div className="max-w-measure pt-1">
              <StatusForm
                projectId={row.id}
                status={row.status}
                blockedReason={row.blocked_reason}
              />
            </div>
          </Disclosure>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Started</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink">
                {formatTimestamp(row.created_at, prefs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Last touched</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink">
                {formatRelative(row.last_touched_at, prefs)}
              </dd>
            </div>
          </dl>
        </div>
      </Section>
    </>
  );
}
