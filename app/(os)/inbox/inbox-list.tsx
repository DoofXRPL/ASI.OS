import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/disclosure";
import type { InboxItemRow } from "@/lib/supabase/database.types";
import { describeKind, describeProcessedInto } from "@/lib/schemas/inbox";
import { formatRelative, type TimePreferences } from "@/lib/format/datetime";
import { ProcessForm, type ProjectOption } from "./process-form";

/**
 * Captures, shown as they were written.
 *
 * Unprocessed items carry a rail and open into the processing form; processed
 * ones are quiet, and say what they became rather than merely that they are
 * done. Nothing in either list is truncated in a way that hides meaning — the
 * content is the record.
 */
export function UnprocessedList({
  items,
  projects,
  projectsUnavailable = false,
  prefs,
}: {
  items: InboxItemRow[];
  projects: ProjectOption[];
  projectsUnavailable?: boolean;
  prefs: TimePreferences;
}) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="border-l-2 border-attention pl-4">
          <p className="max-w-measure text-sm whitespace-pre-wrap text-ink">
            {item.content}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-faint">
            captured {formatRelative(item.created_at, prefs)}
          </p>

          <Disclosure summary="Process this" className="mt-2.5">
            <div className="max-w-measure rounded-card border border-line bg-surface px-4 py-4">
              <ProcessForm
                itemId={item.id}
                content={item.content}
                projects={projects}
                projectsUnavailable={projectsUnavailable}
              />
            </div>
          </Disclosure>
        </li>
      ))}
    </ul>
  );
}

export function ProcessedList({
  items,
  projectNames,
  prefs,
}: {
  items: InboxItemRow[];
  projectNames: Map<string, string>;
  prefs: TimePreferences;
}) {
  return (
    <ul className="divide-y divide-line rounded-card border border-line">
      {items.map((item) => {
        const kind = describeKind(item.kind);
        const became = describeProcessedInto(item.processed_into);
        const projectName = item.project_id
          ? projectNames.get(item.project_id)
          : undefined;

        return (
          <li key={item.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="min-w-0 max-w-measure text-sm text-ink-muted">
                {item.content}
              </p>
              {kind ? <Badge tone="neutral">{kind}</Badge> : null}
            </div>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[11px] text-ink-faint">
              <span>{became}</span>
              {projectName && item.project_id ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/projects/${item.project_id}`}
                    className="text-accent hover:underline"
                  >
                    {projectName}
                  </Link>
                </>
              ) : null}
              {item.processed_at ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelative(item.processed_at, prefs)}</span>
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
