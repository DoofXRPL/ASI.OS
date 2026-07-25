import type { TimeFormat } from "@/lib/schemas/settings";

export interface TimePreferences {
  timezone: string;
  timeFormat: TimeFormat;
}

/**
 * Timestamps are always rendered in the viewer's own time zone and chosen clock
 * format. A time shown in the wrong zone is not a cosmetic problem in a product
 * about commitments — it is wrong information.
 *
 * Formatting happens on the server so the value never changes between the
 * server-rendered HTML and the hydrated markup.
 */
export function formatTimestamp(
  value: string | Date,
  prefs: TimePreferences,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: prefs.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: prefs.timeFormat === "12h",
  }).format(date);
}

export function formatDateHeading(
  value: string | Date,
  prefs: TimePreferences,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: prefs.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/**
 * A relative description for recent events, falling back to an absolute
 * timestamp once "3 days ago" stops being more useful than a date.
 */
export function formatRelative(
  value: string | Date,
  prefs: TimePreferences,
  now: Date = new Date(),
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return formatTimestamp(date, prefs);
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days <= 2) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatTimestamp(date, prefs);
}
