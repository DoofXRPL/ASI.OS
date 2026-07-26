import type { ProjectRow } from "@/lib/supabase/database.types";
import { isOpenStatus } from "@/lib/schemas/projects";

/**
 * Pure functions over project rows.
 *
 * Nothing here reaches a database, so every rule the interface follows can be
 * tested exhaustively and cheaply. Anything that cannot be derived from the
 * rows passed in does not belong in this file.
 */

/** Whole days elapsed, floored. Elapsed time is zone-independent. */
export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const elapsed = now.getTime() - then;
  if (elapsed <= 0) return 0;
  return Math.floor(elapsed / 86_400_000);
}

export function hasNextAction(project: ProjectRow): boolean {
  return project.next_action !== null && project.next_action.trim().length > 0;
}

export function isActive(project: ProjectRow): boolean {
  return project.status === "active";
}

export function isOpen(project: ProjectRow): boolean {
  return isOpenStatus(project.status);
}

/**
 * Untouched for longer than the threshold, while still being work you intend to
 * do. Stated as elapsed time and never as lateness: nothing here has a deadline
 * to be late for.
 */
export function isStale(
  project: ProjectRow,
  now: Date,
  staleAfterDays: number,
): boolean {
  if (!isActive(project) || !hasNextAction(project)) return false;
  return daysSince(project.last_touched_at, now) >= staleAfterDays;
}

/**
 * Comparators are total and tie-break on `id`, so the same rows always produce
 * the same order. An interface that reshuffles itself between two identical
 * loads teaches the reader not to trust its ordering.
 */
export function byLongestNeglected(a: ProjectRow, b: ProjectRow): number {
  const diff = a.last_touched_at.localeCompare(b.last_touched_at);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function byRecentlyTouched(a: ProjectRow, b: ProjectRow): number {
  const diff = b.last_touched_at.localeCompare(a.last_touched_at);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export interface ProjectCounts {
  total: number;
  active: number;
  blocked: number;
  paused: number;
  /** Done or abandoned — decided, either way. */
  closed: number;
}

export function countProjects(projects: ProjectRow[]): ProjectCounts {
  return {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    blocked: projects.filter((p) => p.status === "blocked").length,
    paused: projects.filter((p) => p.status === "paused").length,
    closed: projects.filter((p) => p.status === "done" || p.status === "abandoned")
      .length,
  };
}

/**
 * The work most easily resumed: the active project touched most recently that
 * already knows its next action.
 *
 * `exclude` keeps the same project from being offered here while it is also
 * being raised for attention — the same row twice is noise, not emphasis.
 */
export function pickResumable(
  projects: ProjectRow[],
  exclude: ReadonlySet<string> = new Set(),
): ProjectRow | null {
  return (
    [...projects]
      .filter((p) => isActive(p) && hasNextAction(p) && !exclude.has(p.id))
      .sort(byRecentlyTouched)[0] ?? null
  );
}

/** Open work first, then everything decided; recency inside each group. */
export function sortProjectsForList(projects: ProjectRow[]): ProjectRow[] {
  return [...projects].sort((a, b) => {
    const openness = Number(isOpen(b)) - Number(isOpen(a));
    return openness !== 0 ? openness : byRecentlyTouched(a, b);
  });
}
