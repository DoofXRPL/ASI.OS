import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/os/page-header";
import { Section } from "@/components/os/section";
import { StatusChip } from "@/components/os/status-chip";
import { Failed, NothingYet } from "@/components/os/states";
import { Disclosure } from "@/components/ui/disclosure";
import { findNavItem } from "@/components/os/nav";
import { requireAuthedSession } from "@/lib/auth/session";
import { listProjects } from "@/lib/db/projects";
import { getSettings } from "@/lib/db/settings";
import { countProjects, hasNextAction, isOpen, sortProjectsForList } from "@/lib/derive/projects";
import { formatRelative } from "@/lib/format/datetime";
import { asSentence } from "@/lib/format/text";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "Projects" };

const NAV = findNavItem("/projects");

export default async function ProjectsPage() {
  const session = await requireAuthedSession();

  const [settings, projects] = await Promise.all([
    getSettings(session.user.id),
    listProjects(session.user.id),
  ]);

  if (!projects.ok) {
    return (
      <>
        <PageHeader
          title="Projects"
          stage={NAV?.stage ?? "Understand"}
          purpose={NAV?.purpose ?? ""}
        />
        <Failed
          headline="Your projects could not be read."
          detail={`${asSentence(projects.error)} Nothing has been changed. Reload to try again.`}
        />
      </>
    );
  }

  const prefs = {
    timezone: session.profile.timezone,
    timeFormat: settings.timeFormat,
  };

  const all = sortProjectsForList(projects.data);
  const open = all.filter(isOpen);
  const closed = all.filter((project) => !isOpen(project));
  const counts = countProjects(projects.data);

  return (
    <>
      <PageHeader
        title="Projects"
        stage={NAV?.stage ?? "Understand"}
        purpose={NAV?.purpose ?? ""}
      />

      {all.length === 0 ? (
        <NothingYet
          headline="No projects yet."
          detail="A project is an outcome you intend to reach, plus the one action that moves it forward. Start one below, or process something from your inbox into one."
        />
      ) : (
        <Section
          title="Open"
          count={open.length}
          description={
            counts.blocked > 0
              ? "Ordered by what you touched most recently. A project without a next action cannot move."
              : "Ordered by what you touched most recently."
          }
        >
          {open.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing open. Every project you have is done, abandoned, or listed
              below.
            </p>
          ) : (
            <ul className="space-y-4">
              {open.map((project) => (
                <li
                  key={project.id}
                  className={
                    project.status === "blocked" || !hasNextAction(project)
                      ? "border-l-2 border-attention pl-4"
                      : "border-l-2 border-line-strong pl-4"
                  }
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 text-sm text-ink">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline"
                      >
                        {project.name}
                      </Link>
                    </h3>
                    <StatusChip status={project.status} />
                  </div>

                  <p className="mt-1 max-w-measure text-sm text-ink-muted">
                    {project.status === "blocked" && project.blocked_reason
                      ? project.blocked_reason
                      : hasNextAction(project)
                        ? project.next_action
                        : "No next action. Nothing in your records says what moves this forward."}
                  </p>

                  <p className="mt-1 font-mono text-[11px] text-ink-faint">
                    touched {formatRelative(project.last_touched_at, prefs)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {closed.length > 0 ? (
        <Section title="Decided" count={closed.length}>
          <ul className="divide-y divide-line rounded-card border border-line">
            {closed.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-ink-muted hover:text-ink hover:underline"
                >
                  {project.name}
                </Link>
                <StatusChip status={project.status} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="Start a project"
        description="Name it now; you can say what it is for and what moves it forward at any point."
      >
        {all.length === 0 ? (
          <NewProjectForm />
        ) : (
          <Disclosure summary="Start another project">
            <div className="pt-2">
              <NewProjectForm />
            </div>
          </Disclosure>
        )}
      </Section>
    </>
  );
}
