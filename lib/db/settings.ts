import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  type SettingsUpdate,
  type UserSettings,
} from "@/lib/schemas/settings";
import type { WriteResult } from "./result";

/**
 * Reads the caller's settings, normalised through the schema.
 *
 * Falls back to defaults rather than failing: a missing or malformed settings row
 * should never stop someone reaching their own records.
 */
export async function getSettings(userId: string): Promise<UserSettings> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_SETTINGS;

  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  return parseSettings(data?.settings);
}

/** Applies a partial update, re-validating the merged result before writing. */
export async function updateSettings(
  userId: string,
  update: SettingsUpdate,
): Promise<WriteResult<UserSettings>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const current = await getSettings(userId);
  const merged = parseSettings({ ...current, ...update });

  const { error } = await supabase
    .from("user_settings")
    .update({ settings: merged as unknown as Json })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: merged };
}
