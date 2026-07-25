/**
 * Types for the schema defined in `supabase/migrations/`.
 *
 * Hand-maintained for now. Once a hosted project exists, regenerate with:
 *
 *   supabase gen types typescript --local > lib/supabase/database.types.ts
 *
 * Until then, `tests/rls/isolation.test.ts` asserts the real shape of the
 * database, so drift between this file and the migrations surfaces as a failing
 * type or a failing test rather than a runtime surprise.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  timezone: string;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  id: string;
  user_id: string;
  settings: Json;
  created_at: string;
  updated_at: string;
};

export type ActivityEventRow = {
  id: string;
  user_id: string;
  event_type: string;
  actor: string;
  summary: string;
  subject_type: string | null;
  subject_id: string | null;
  detail: Json;
  occurred_at: string;
  created_at: string;
};

/**
 * Constrained columns are typed as `string` rather than as unions, matching
 * what `supabase gen types` emits and what PostgREST actually returns. The
 * closed sets live in `lib/schemas/`, where a value the interface does not
 * recognise can be handled rather than crashing a page that is otherwise fine.
 */
export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  outcome: string | null;
  status: string;
  next_action: string | null;
  blocked_reason: string | null;
  last_touched_at: string;
  created_at: string;
  updated_at: string;
};

export type InboxItemRow = {
  id: string;
  user_id: string;
  content: string;
  kind: string | null;
  status: string;
  project_id: string | null;
  processed_into: string | null;
  processed_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

/**
 * Declared as a type alias rather than an interface on purpose: PostgREST's
 * schema constraint relies on implicit index signatures, which TypeScript infers
 * for type aliases but not for interfaces. As an interface, every query type
 * silently degrades to `never`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, "user_id"> &
          Partial<Pick<ProfileRow, "display_name" | "timezone">>;
        // `is_owner` is absent deliberately. Authenticated users have no UPDATE
        // privilege on that column, so allowing it here would only produce a
        // request the database rejects.
        Update: Partial<Pick<ProfileRow, "display_name" | "timezone">>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: Pick<UserSettingsRow, "user_id"> &
          Partial<Pick<UserSettingsRow, "settings">>;
        Update: Partial<Pick<UserSettingsRow, "settings">>;
        Relationships: [];
      };
      activity_events: {
        Row: ActivityEventRow;
        Insert: Pick<ActivityEventRow, "user_id" | "event_type" | "summary"> &
          Partial<
            Pick<
              ActivityEventRow,
              "actor" | "subject_type" | "subject_id" | "detail" | "occurred_at"
            >
          >;
        /**
         * The audit trail is append-only. There is no UPDATE privilege and no
         * UPDATE policy, so this type admits no property: calling `.update()` on
         * this table is a compile error rather than a runtime rejection.
         */
        Update: Record<string, never>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: Pick<ProjectRow, "user_id" | "name"> &
          Partial<
            Pick<ProjectRow, "outcome" | "status" | "next_action" | "blocked_reason">
          >;
        Update: Partial<
          Pick<
            ProjectRow,
            | "name"
            | "outcome"
            | "status"
            | "next_action"
            | "blocked_reason"
            | "last_touched_at"
          >
        >;
        Relationships: [];
      };
      inbox_items: {
        Row: InboxItemRow;
        Insert: Pick<InboxItemRow, "user_id" | "content"> &
          Partial<Pick<InboxItemRow, "kind" | "project_id">>;
        /**
         * `content` and `source` are absent deliberately, mirroring the grants:
         * captured text cannot be rewritten and its origin cannot be claimed.
         * Attempting either is a compile error rather than a runtime rejection.
         */
        Update: Partial<
          Pick<
            InboxItemRow,
            "kind" | "status" | "project_id" | "processed_into" | "processed_at"
          >
        >;
        Relationships: [];
      };
    };
    // Empty-object form, matching what `supabase gen types` emits. A
    // `Record<string, never>` here would not satisfy PostgREST's schema
    // constraint and would silently degrade every query type to `never`.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
