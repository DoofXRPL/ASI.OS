import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coerceFormValues,
  earlyAccessRequestSchema,
  LIMITS,
  readEarlyAccessForm,
  TEAM_SIZE_OPTIONS,
  TEAM_SIZES,
  USE_CASE_OPTIONS,
  USE_CASES,
} from "@/lib/schemas/early-access";

/**
 * The early-access request is validated twice — in the browser and again on
 * the server — and constrained a third time by the database. These tests hold
 * all three to the same definition.
 *
 * The last describe is the important one: it reads the migration and fails if
 * a value exists in one place and not the other. Two lists of the same closed
 * set is exactly the drift that ends with a form offering a choice the
 * database refuses.
 */

const minimal = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "",
  useCase: "research",
  otherUseCase: "",
  teamSize: "",
  challenge: "",
};

function parse(overrides: Partial<typeof minimal> = {}) {
  return earlyAccessRequestSchema.safeParse({ ...minimal, ...overrides });
}

function messageFor(
  result: ReturnType<typeof parse>,
  field: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("what a request must contain", () => {
  it("accepts a name, an address and a use case, and asks for nothing else", () => {
    const result = parse();

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: undefined,
      useCase: "research",
      otherUseCase: undefined,
      teamSize: undefined,
      challenge: undefined,
    });
  });

  it("asks for a name rather than accepting whitespace", () => {
    expect(messageFor(parse({ name: "   " }), "name")).toBe("Tell us your name.");
  });

  it("refuses a name longer than the column can hold", () => {
    expect(parse({ name: "n".repeat(LIMITS.name) }).success).toBe(true);
    expect(parse({ name: "n".repeat(LIMITS.name + 1) }).success).toBe(false);
  });

  it("says what is wrong with an address instead of failing silently", () => {
    expect(messageFor(parse({ email: "" }), "email")).toBe(
      "We need an email address to reply to.",
    );
    expect(messageFor(parse({ email: "not-an-address" }), "email")).toBe(
      "That does not look like an email address.",
    );
  });

  it("stores an address the way the database indexes it", () => {
    const result = parse({ email: "  Ada.Lovelace@Example.COM  " });
    expect(result.success && result.data.email).toBe("ada.lovelace@example.com");
  });

  it("names the unchosen use case as a choice to make, not a malformed value", () => {
    expect(messageFor(parse({ useCase: "" }), "useCase")).toBe(
      "Choose how you plan to use ASI.OS.",
    );
  });

  it("rejects a use case nothing knows about", () => {
    expect(parse({ useCase: "world_domination" }).success).toBe(false);
  });
});

describe("'something else' has to say what", () => {
  it("is rejected with nothing written", () => {
    expect(messageFor(parse({ useCase: "other" }), "otherUseCase")).toBe(
      "Tell us what you would use ASI.OS for.",
    );
  });

  it("is accepted once it does", () => {
    const result = parse({ useCase: "other", otherUseCase: "  Running a reading group.  " });
    expect(result.success && result.data.otherUseCase).toBe("Running a reading group.");
  });

  it("drops an explanation left behind by a change of category", () => {
    // A stale sentence that describes a category the request no longer claims
    // would be read later as though it described the one it does.
    const result = parse({ useCase: "finance", otherUseCase: "Something else entirely." });
    expect(result.success && result.data.otherUseCase).toBeUndefined();
  });
});

describe("the optional answers stay optional", () => {
  it("treats an empty company, team size and challenge as absent", () => {
    const result = parse({ company: "  ", teamSize: "", challenge: "   " });

    expect(result.success).toBe(true);
    expect(result.success && result.data.company).toBeUndefined();
    expect(result.success && result.data.teamSize).toBeUndefined();
    expect(result.success && result.data.challenge).toBeUndefined();
  });

  it("keeps them when they are answered", () => {
    const result = parse({
      company: "Analytical Engines",
      teamSize: "2_10",
      challenge: "Context is lost between sessions.",
    });

    expect(result.success && result.data.company).toBe("Analytical Engines");
    expect(result.success && result.data.teamSize).toBe("2_10");
    expect(result.success && result.data.challenge).toBe("Context is lost between sessions.");
  });

  it("still refuses a team size that is not one of the four", () => {
    expect(parse({ teamSize: "a_few_hundred" }).success).toBe(false);
  });

  it("caps the long answers where the column does", () => {
    expect(parse({ challenge: "c".repeat(LIMITS.challenge) }).success).toBe(true);
    expect(parse({ challenge: "c".repeat(LIMITS.challenge + 1) }).success).toBe(false);
  });
});

describe("reading a submission off the wire", () => {
  it("takes every field it knows and nothing it does not", () => {
    const formData = new FormData();
    formData.set("name", "Ada");
    formData.set("email", "ada@example.com");
    formData.set("useCase", "research");
    formData.set("unexpected", "ignored");

    expect(readEarlyAccessForm(formData)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      company: "",
      useCase: "research",
      otherUseCase: "",
      teamSize: "",
      challenge: "",
    });
  });

  it("reads a missing or non-text field as empty rather than throwing", () => {
    const formData = new FormData();
    formData.set("name", new File([], "resume.pdf"));

    expect(readEarlyAccessForm(formData).name).toBe("");
  });
});

describe("refilling a rejected form", () => {
  it("gives back what was typed", () => {
    const values = coerceFormValues({
      name: "Ada",
      email: "not-an-address",
      company: "Analytical Engines",
      useCase: "research",
      otherUseCase: "",
      teamSize: "2_10",
      challenge: "Context is lost.",
    });

    expect(values.email).toBe("not-an-address");
    expect(values.useCase).toBe("research");
    expect(values.teamSize).toBe("2_10");
  });

  it("returns an unrecognised choice to the unselected state", () => {
    const values = coerceFormValues({
      name: "Ada",
      email: "ada@example.com",
      company: "",
      useCase: "world_domination",
      otherUseCase: "",
      teamSize: "a_few_hundred",
      challenge: "",
    });

    expect(values.useCase).toBe("");
    expect(values.teamSize).toBe("");
  });
});

describe("the page offers exactly what the database accepts", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0003_early_access.sql"),
    "utf8",
  );

  it("gives every use case a card, in one order", () => {
    expect(USE_CASE_OPTIONS.map((option) => option.value)).toEqual([...USE_CASES]);
    for (const option of USE_CASE_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
      expect(option.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives every team size a radio", () => {
    expect(TEAM_SIZE_OPTIONS.map((option) => option.value)).toEqual([...TEAM_SIZES]);
  });

  it("constrains the same use cases in the migration", () => {
    for (const value of USE_CASES) {
      expect(migration, `use case "${value}" is missing from the migration`).toContain(
        `'${value}'`,
      );
    }
  });

  it("constrains the same team sizes in the migration", () => {
    for (const value of TEAM_SIZES) {
      expect(migration, `team size "${value}" is missing from the migration`).toContain(
        `'${value}'`,
      );
    }
  });

  it("bounds every text column at the same length in both places", () => {
    for (const limit of Object.values(LIMITS)) {
      expect(migration, `no column in the migration is bounded at ${limit}`).toContain(
        String(limit),
      );
    }
  });

  it("keeps the queue out of the schema the API can address", () => {
    // The whole security argument rests on this: the table is created in
    // `access`, and reached only through a function in `public`.
    expect(migration).toContain("create schema if not exists access");
    expect(migration).toContain("access.early_access_requests");
    expect(migration).not.toMatch(/create table[^;]+public\.early_access_requests/);
  });
});
