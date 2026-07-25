"use server";

import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/audit/log";
import { credentialsSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnvStatus } from "@/lib/supabase/env";
import { getAuthedUser } from "./session";
import { safeRedirectPath } from "./redirect";
import type { AuthFormState } from "./form-state";

/**
 * Signing in happens on the server.
 *
 * Doing this here rather than in the browser means the form works without
 * JavaScript, the password never passes through client-side application code, and
 * the sign-in can be written to the audit trail — which a browser-only flow
 * cannot do honestly.
 *
 * Failures are deliberately vague to the visitor ("Those credentials were not
 * accepted") so this endpoint cannot be used to discover which email addresses
 * have accounts.
 */
export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const envStatus = getSupabaseEnvStatus();
  if (!envStatus.configured) {
    return { error: "ASI OS is not configured, so sign-in cannot succeed." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        email: flattened.email?.[0],
        password: flattened.password?.[0],
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "ASI OS is not configured, so sign-in cannot succeed." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Those credentials were not accepted." };
  }

  await recordActivity(data.user.id, {
    eventType: "auth.signed_in",
    summary: "Signed in",
    actor: "user",
  });

  redirect(safeRedirectPath(formData.get("redirect")?.toString()));
}

export async function signOutAction(): Promise<void> {
  const user = await getAuthedUser();
  const supabase = await createSupabaseServerClient();

  // Recorded before the session ends, because afterwards Row Level Security
  // would correctly refuse the write.
  if (user) {
    await recordActivity(user.id, {
      eventType: "auth.signed_out",
      summary: "Signed out",
      actor: "user",
    });
  }

  await supabase?.auth.signOut();
  redirect("/login");
}
