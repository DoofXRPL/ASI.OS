import { describe, expect, it } from "vitest";
import type {
  ActivityEventRow,
  Database,
  ProfileRow,
  UserSettingsRow,
} from "@/lib/supabase/database.types";

/**
 * Compile-time guards for the database types.
 *
 * PostgREST checks the schema type against a constraint that requires implicit
 * index signatures. TypeScript infers those for type aliases but NOT for
 * interfaces, so declaring any of these shapes as an `interface` makes the schema
 * fail the constraint — and instead of an error at the definition, every query
 * result and every insert payload silently becomes `never`. The application still
 * compiles; it just loses all type safety against the database.
 *
 * That failure mode is invisible, so it is asserted here. If any of these type
 * aliases becomes an interface, `npm run typecheck` fails immediately.
 */

type Extends<A, B> = A extends B ? true : false;
type AssertTrue<T extends true> = T;

type _RowsAreIndexable = [
  AssertTrue<Extends<ProfileRow, Record<string, unknown>>>,
  AssertTrue<Extends<UserSettingsRow, Record<string, unknown>>>,
  AssertTrue<Extends<ActivityEventRow, Record<string, unknown>>>,
];

type _SchemaIsIndexable = AssertTrue<
  Extends<
    Database["public"]["Tables"],
    Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: unknown[];
      }
    >
  >
>;

/** The audit trail admits no update, expressed in the type system. */
type _AuditIsAppendOnly = AssertTrue<
  Extends<Database["public"]["Tables"]["activity_events"]["Update"], Record<string, never>>
>;

/** Ownership is not writable through the API surface. */
type _OwnershipIsNotWritable = AssertTrue<
  Extends<
    "is_owner" extends keyof Database["public"]["Tables"]["profiles"]["Update"]
      ? false
      : true,
    true
  >
>;

/**
 * The early-access queue is not a table the client can name.
 *
 * It lives in the `access` schema, which PostgREST does not expose, so the
 * only way to it is `public.request_early_access()`. Typing it here would
 * invite `.from("early_access_requests")`, which compiles and then fails at
 * runtime — the worst of both. See supabase/migrations/0003_early_access.sql.
 */
type _QueueIsNotAddressable = AssertTrue<
  Extends<
    "early_access_requests" extends keyof Database["public"]["Tables"]
      ? false
      : true,
    true
  >
>;

describe("database types", () => {
  it("holds its compile-time guarantees", () => {
    // The assertions above are enforced by tsc. This keeps the suite honest
    // about the fact that there is nothing to check at runtime here.
    expect(true).toBe(true);
  });
});
