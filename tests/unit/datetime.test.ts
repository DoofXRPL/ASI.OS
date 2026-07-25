import { describe, expect, it } from "vitest";
import {
  formatDateHeading,
  formatRelative,
  formatTimestamp,
} from "@/lib/format/datetime";

/**
 * A timestamp shown in the wrong zone is not a cosmetic defect in a product about
 * commitments — it is wrong information.
 */
const LONDON = { timezone: "Europe/London", timeFormat: "24h" } as const;
const NEW_YORK = { timezone: "America/New_York", timeFormat: "12h" } as const;

describe("formatTimestamp", () => {
  it("renders in the requested zone with a 24-hour clock", () => {
    // 2026-07-25T09:00Z is 10:00 in London during British Summer Time.
    expect(formatTimestamp("2026-07-25T09:00:00.000Z", LONDON)).toBe(
      "25 Jul 2026, 10:00",
    );
  });

  it("renders the same instant differently in another zone and clock format", () => {
    expect(formatTimestamp("2026-07-25T09:00:00.000Z", NEW_YORK)).toBe(
      "25 Jul 2026, 05:00 am",
    );
  });

  it("reports an unparseable value instead of showing a wrong date", () => {
    expect(formatTimestamp("not a date", LONDON)).toBe("Unknown time");
  });
});

describe("formatDateHeading", () => {
  it("names the weekday in the reader's zone", () => {
    expect(formatDateHeading("2026-07-25T09:00:00.000Z", LONDON)).toBe(
      "Saturday 25 July",
    );
  });

  it("uses the zone rather than UTC when they disagree on the day", () => {
    // 02:00 UTC is still the previous evening in New York, and the heading must
    // follow the reader's day rather than the server's.
    expect(formatDateHeading("2026-07-25T02:00:00.000Z", NEW_YORK)).toBe(
      "Friday 24 July",
    );
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");

  it("calls the very recent past 'just now'", () => {
    expect(formatRelative("2026-07-25T11:59:30.000Z", LONDON, now)).toBe("just now");
  });

  it("counts minutes", () => {
    expect(formatRelative("2026-07-25T11:30:00.000Z", LONDON, now)).toBe(
      "30 minutes ago",
    );
  });

  it("uses the singular for one minute", () => {
    expect(formatRelative("2026-07-25T11:59:00.000Z", LONDON, now)).toBe(
      "1 minute ago",
    );
  });

  it("counts hours", () => {
    expect(formatRelative("2026-07-25T09:00:00.000Z", LONDON, now)).toBe(
      "3 hours ago",
    );
  });

  it("counts days up to two", () => {
    expect(formatRelative("2026-07-23T12:00:00.000Z", LONDON, now)).toBe("2 days ago");
  });

  it("falls back to an absolute timestamp once relative wording stops helping", () => {
    expect(formatRelative("2026-07-01T12:00:00.000Z", LONDON, now)).toBe(
      "1 Jul 2026, 13:00",
    );
  });

  it("shows an absolute timestamp for a future date rather than a negative age", () => {
    expect(formatRelative("2026-07-26T12:00:00.000Z", LONDON, now)).toBe(
      "26 Jul 2026, 13:00",
    );
  });

  it("reports an unparseable value honestly", () => {
    expect(formatRelative("nope", LONDON, now)).toBe("Unknown time");
  });
});
