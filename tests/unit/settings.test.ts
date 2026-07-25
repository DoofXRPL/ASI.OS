import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  settingsSchema,
  settingsUpdateSchema,
} from "@/lib/schemas/settings";

/**
 * Settings are stored as JSONB, which means the database will accept any object
 * at all. This schema is therefore the only thing standing between a drifted or
 * hand-edited row and the interface, and it must never throw: losing a preference
 * is recoverable, losing access to your own records is not.
 */
describe("settings schema", () => {
  it("defaults to a 24-hour clock", () => {
    expect(DEFAULT_SETTINGS).toEqual({ version: 1, timeFormat: "24h" });
  });

  it("accepts a fully specified object", () => {
    expect(parseSettings({ version: 1, timeFormat: "12h" })).toEqual({
      version: 1,
      timeFormat: "12h",
    });
  });

  it("drops unknown keys rather than storing them", () => {
    const result = parseSettings({
      timeFormat: "12h",
      theme: "midnight",
      trading: { enabled: true },
    });
    expect(result).toEqual({ version: 1, timeFormat: "12h" });
  });

  it("recovers valid fields when another field is invalid", () => {
    // A single bad value must not discard the good ones alongside it.
    const result = parseSettings({ version: 99, timeFormat: "12h" });
    expect(result).toEqual({ version: 1, timeFormat: "12h" });
  });

  it("falls back to the default for an unrecognised clock format", () => {
    expect(parseSettings({ timeFormat: "sundial" })).toEqual(DEFAULT_SETTINGS);
  });

  it.each([[null], [undefined], ["a string"], [42], [[]], [true]])(
    "returns defaults for the non-object value %s",
    (value) => {
      expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
    },
  );

  it("never throws, whatever it is given", () => {
    const hostile = { version: { nested: true }, timeFormat: [] };
    expect(() => parseSettings(hostile)).not.toThrow();
    expect(parseSettings(hostile)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps every stored key represented in the schema", () => {
    // Guards against a key being written but never validated.
    expect(Object.keys(settingsSchema.shape).sort()).toEqual([
      "timeFormat",
      "version",
    ]);
  });
});

describe("settings update schema", () => {
  it("accepts a partial update", () => {
    expect(settingsUpdateSchema.parse({ timeFormat: "12h" })).toEqual({
      timeFormat: "12h",
    });
  });

  it("rejects unknown keys at the boundary instead of silently ignoring them", () => {
    // Reads are lenient so the app survives drift; writes are strict so drift
    // is never introduced on purpose.
    expect(settingsUpdateSchema.safeParse({ nope: true }).success).toBe(false);
  });

  it("refuses to let a caller set the stored schema version", () => {
    // `version` describes the shape and is owned by the schema module, not by
    // whoever is submitting a form.
    expect(settingsUpdateSchema.safeParse({ version: 1 }).success).toBe(false);
  });

  it("accepts an empty update without inventing values", () => {
    expect(settingsUpdateSchema.parse({})).toEqual({});
  });

  it("rejects an invalid clock format", () => {
    expect(settingsUpdateSchema.safeParse({ timeFormat: "13h" }).success).toBe(
      false,
    );
  });
});
