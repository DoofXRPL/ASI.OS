import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `supabase/config.toml` describes the local stack, and nothing in CI runs it:
 * the RLS suite deliberately uses plain PostgreSQL so the required gate stays
 * fast and Docker-free. That is the right trade, and it leaves this file as the
 * one piece of configuration a green build says nothing about — which is how it
 * came to hold a Postgres version the CLI rejects and an auth setting that turns
 * off sign-*in*, with every check passing.
 *
 * These assertions are the cheapest available substitute for starting the stack.
 * They cannot prove it boots; they can prove it is not configured in the specific
 * ways that stop it booting or lock the owner out, and they run in the suite that
 * always runs.
 *
 * Parsed with a small section-aware reader rather than a TOML dependency, for the
 * same reason the migration-contract tests use regular expressions: the file is
 * ours, the questions are few, and a dependency for five lookups is not worth it.
 */

const CONFIG = path.join(process.cwd(), "supabase", "config.toml");

function readConfig(): Map<string, string> {
  const values = new Map<string, string>();
  let section = "";

  for (const raw of readFileSync(CONFIG, "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line.length === 0) continue;

    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header?.[1]) {
      section = header[1];
      values.set(`${section}`, "");
      continue;
    }

    const pair = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (pair?.[1] && pair[2]) values.set(`${section}.${pair[1]}`, pair[2].trim());
  }

  return values;
}

const config = readConfig();

describe("the local Supabase stack is configured to start", () => {
  /**
   * The CLI validates this before it starts anything, and rejects a value it does
   * not know: `Failed reading config: Invalid db.major_version: 16`. Every command
   * the README's setup section names — `start`, `db reset`, `db push`, `status` —
   * fails at that point, so an unsupported number here is not a degraded local
   * stack but the absence of one.
   *
   * Measured against CLI 2.111.0 by putting each number in the file and reading
   * what `supabase status` said: 12, 13, 14, 15 and 17 load, 16 and 18 do not.
   * Widen it when the CLI does; the number must also match `show server_version;`
   * on the hosted project, which is the reason to prefer the newest accepted one
   * rather than the lowest.
   */
  const CLI_SUPPORTED_MAJOR_VERSIONS = ["12", "13", "14", "15", "17"];

  it("names a Postgres major version the CLI accepts", () => {
    expect(
      CLI_SUPPORTED_MAJOR_VERSIONS,
      "the Supabase CLI refuses to load a config naming a version it does not know",
    ).toContain(config.get("db.major_version"));
  });

  it("does not use the section name the CLI has renamed", () => {
    // `[inbucket]` still works and warns on every command. Warnings on every
    // command are how a real one goes unread.
    expect(config.has("inbucket")).toBe(false);
    expect(config.has("local_smtp")).toBe(true);
  });
});

describe("the local stack is invite-only, and the invited can still get in", () => {
  /**
   * These two settings look like a pair and are not. `[auth] enable_signup`
   * becomes `GOTRUE_DISABLE_SIGNUP` and is the gate. `[auth.email] enable_signup`
   * has mapped to `GOTRUE_EXTERNAL_EMAIL_ENABLED` — whether the provider exists at
   * all — so false there refuses an invited user's own sign-in with
   * `email_provider_disabled` (supabase/supabase#40582), and the owner of this
   * product has no second provider to fall back to.
   *
   * The CLI has since decoupled the two, so on a recent enough version false here
   * is merely misleading rather than fatal. Asserting `true` is correct either
   * way: it is what the CLI's own template ships, and global-false-plus-email-true
   * is the combination that template names for invite-only.
   */
  it("refuses to create accounts", () => {
    expect(
      config.get("auth.enable_signup"),
      "this is the setting that makes ASI OS invite-only",
    ).toBe("false");
  });

  it("leaves the email provider enabled, so the owner can sign in", () => {
    expect(
      config.get("auth.email.enable_signup"),
      "false here disables email sign-in as well as sign-up",
    ).toBe("true");
  });
});

describe("the early-access queue stays unreachable over the API", () => {
  /**
   * `access` exists precisely so PostgREST cannot address it — ADR 0008. Until
   * now that was protected by a comment in the file saying so, which is a property
   * of whoever reads it. The launch checklist in docs/SECURITY.md asks for the
   * same thing by hand.
   */
  it("exposes public and nothing else", () => {
    const schemas = config.get("api.schemas");
    expect(schemas).toBeDefined();
    expect(schemas).not.toMatch(/\baccess\b/);
    expect(schemas).toMatch(/"public"/);
  });
});
