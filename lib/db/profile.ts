import type { ProfileRow } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileUpdate } from "@/lib/schemas/profile";
import type { WriteResult } from "./result";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data ?? null;
}

/**
 * Updates the caller's identity.
 *
 * Only `display_name` and `timezone` are writable — `is_owner` is not granted to
 * authenticated users at the column level, so ownership cannot be escalated even
 * if this function were called with a forged payload.
 */
export async function updateProfile(
  userId: string,
  update: ProfileUpdate,
): Promise<WriteResult<ProfileRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: update.displayName, timezone: update.timezone })
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Your profile could not be found." };
  }

  return { ok: true, data };
}
