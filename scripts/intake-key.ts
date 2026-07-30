/**
 * Generates an intake key and prints the two things that have to be done with
 * it.
 *
 * `public.request_early_access()` refuses any call that cannot produce a key
 * whose SHA-256 matches a row in `access.intake_keys`. That means the key exists
 * in two places — the deployment's environment, and a digest in the database —
 * and nowhere else. This script exists so neither half is typed by hand, and so
 * the key is never written to a file that could be committed.
 *
 * It prints and exits. It does not connect to a database: applying the statement
 * is the owner's decision to make against the project they mean, and a script
 * that reaches for `DATABASE_URL` on its own is one wrong shell away from
 * inserting a development key into production.
 *
 *   npm run intake:key
 *   npm run intake:key -- --label "vercel-production"
 */
import { createHash, randomBytes } from "node:crypto";

const DEFAULT_LABEL = "local";

function labelFromArgv(argv: string[]): string {
  const flag = argv.indexOf("--label");
  const value = flag === -1 ? undefined : argv[flag + 1]?.trim();
  if (!value) return DEFAULT_LABEL;

  if (value.length > 60 || !/^[\w .-]+$/.test(value)) {
    throw new Error(
      "A label must be 60 characters or fewer of letters, digits, spaces, dots, dashes or underscores.",
    );
  }
  return value;
}

function main(): void {
  const label = labelFromArgv(process.argv.slice(2));
  const key = randomBytes(32).toString("hex");
  const digest = createHash("sha256").update(key, "utf8").digest("hex");

  console.log(`
An intake key for "${label}". It is printed once and stored nowhere.

1. Set it in the deployment's environment (Vercel, or .env.local):

   ASI_INTAKE_KEY=${key}

2. Register its digest with the database, as the owner:

   insert into access.intake_keys (label, key_sha256)
   values ('${label}', decode('${digest}', 'hex'));

Until both are done the form reports that requests are not being recorded,
which is true: an unrecognised caller is refused by the database.

To rotate, run this again with a new label, apply both steps, and then retire
the old key once the new deployment is live:

   update access.intake_keys set retired_at = now() where label = '${label}';
`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
