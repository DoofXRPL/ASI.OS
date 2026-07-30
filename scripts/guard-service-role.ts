/**
 * Fails the build if application code can reach a credential that bypasses Row
 * Level Security.
 *
 * Row Level Security is the only isolation boundary in ASI OS. The Supabase
 * service role ignores it entirely, so a single well-intentioned import of a
 * service-role client would silently convert a private product into a shared
 * one — and no test would necessarily notice, because service-role queries
 * succeed rather than fail.
 *
 * This guard therefore treats any reference to a privileged credential inside
 * application code as a build failure. It runs in CI alongside typecheck and
 * lint, and its cost is a few milliseconds.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

/** Directories that may never touch a privileged credential. */
const GUARDED_DIRS = ["app", "lib", "components"];

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /SUPABASE_SERVICE_ROLE_KEY/,
    reason: "the service role bypasses Row Level Security",
  },
  {
    pattern: /SUPABASE_SECRET_KEY/,
    reason: "the secret key bypasses Row Level Security",
  },
  {
    pattern: /\bservice_role\b/,
    reason: "service_role bypasses Row Level Security",
  },
  {
    pattern: /createClient\s*\(/,
    reason:
      "raw supabase-js clients skip session handling; use lib/supabase/server.ts or lib/supabase/browser.ts",
  },
  {
    // Anything Next.js inlines into a client bundle is public. The intake key's
    // only job is to distinguish this deployment from everybody else holding the
    // publishable key, which it cannot do once it is in the page source.
    pattern: /NEXT_PUBLIC_ASI_INTAKE/,
    reason: "the intake key must never be exposed to the browser",
  },
];

/**
 * Secrets that may be named, but in one file only.
 *
 * A confined credential is easier to reason about than a scattered one: there is
 * a single place to read to learn how it is validated, and a single place where
 * the comment explaining what it is and is not can be trusted to be read.
 */
const CONFINED_PATTERNS: { pattern: RegExp; file: string; reason: string }[] = [
  {
    pattern: /\bASI_INTAKE_KEY\b/,
    file: "lib/early-access/intake-key.ts",
    reason: "the intake key is read in exactly one module, which documents it",
  },
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs"]);

interface Violation {
  file: string;
  line: number;
  text: string;
  reason: string;
}

async function collectFiles(dir: string): Promise<string[]> {
  const absolute = path.join(REPO_ROOT, dir);
  const found: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return; // Directory does not exist yet; nothing to guard.
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        await walk(full);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(full);
      }
    }
  }

  await walk(absolute);
  return found;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];

  for (const dir of GUARDED_DIRS) {
    for (const file of await collectFiles(dir)) {
      const contents = await readFile(file, "utf8");
      const lines = contents.split("\n");

      const relative = path.relative(REPO_ROOT, file);

      lines.forEach((text, index) => {
        // A line may opt out only with an explicit acknowledgement on that same
        // line. Same-line is deliberate: a comment above a block would quietly
        // exempt code added underneath it later.
        if (text.includes("asi-allow-privileged")) return;

        for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
          if (pattern.test(text)) {
            violations.push({ file: relative, line: index + 1, text: text.trim(), reason });
          }
        }

        for (const { pattern, file: allowed, reason } of CONFINED_PATTERNS) {
          if (pattern.test(text) && relative !== allowed) {
            violations.push({
              file: relative,
              line: index + 1,
              text: text.trim(),
              reason: `${reason} (${allowed})`,
            });
          }
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      `\nguard:service-role found ${violations.length} violation(s).\n` +
        "Application code must reach the database only as the signed-in user.\n",
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.text}`);
      console.error(`    -> ${v.reason}\n`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `guard:service-role: clean (${GUARDED_DIRS.join(", ")} reach the database only as the signed-in user).`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
