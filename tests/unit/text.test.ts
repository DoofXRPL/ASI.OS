import { describe, expect, it } from "vitest";
import { asSentence } from "@/lib/format/text";

/**
 * Failure messages are shown beside prose explaining what they mean. Reading
 * well is not cosmetic here: the moment an interface asks to be trusted about
 * something going wrong is the worst moment to look careless.
 */
describe("asSentence", () => {
  it("turns a database fragment into a sentence", () => {
    expect(asSentence("permission denied for table projects")).toBe(
      "Permission denied for table projects.",
    );
  });

  it("leaves existing punctuation alone rather than doubling it", () => {
    expect(asSentence("Supabase is not configured.")).toBe(
      "Supabase is not configured.",
    );
    expect(asSentence("Is it configured?")).toBe("Is it configured?");
  });

  it("changes only the first letter and the final stop", () => {
    // Identifiers and quoting inside the message have to survive intact: they
    // are the part a reader would search for or paste into a bug report.
    expect(asSentence('relation "inbox_items" does not exist')).toBe(
      'Relation "inbox_items" does not exist.',
    );
  });

  it("leaves a message that already begins with punctuation alone", () => {
    expect(asSentence('"inbox_items" is not readable')).toBe(
      '"inbox_items" is not readable.',
    );
  });

  it("handles an empty or whitespace-only message without inventing one", () => {
    expect(asSentence("")).toBe("");
    expect(asSentence("   ")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(asSentence("  broken  ")).toBe("Broken.");
  });
});
