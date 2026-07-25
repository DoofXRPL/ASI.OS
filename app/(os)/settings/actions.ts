"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordActivity } from "@/lib/audit/log";
import { requireAuthedSession } from "@/lib/auth/session";
import { updateProfile } from "@/lib/db/profile";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { profileUpdateSchema } from "@/lib/schemas/profile";
import { TIME_FORMATS } from "@/lib/schemas/settings";
import type { SettingsFormState } from "./form-state";

const formSchema = profileUpdateSchema.extend({
  timeFormat: z.enum(TIME_FORMATS),
});

/**
 * Saves identity and display preferences.
 *
 * Two details matter here:
 *
 *   1. The audit trail records what actually changed. Writing "identity updated"
 *      when nothing changed would make the history less trustworthy, and a
 *      history you cannot trust is worse than no history.
 *   2. Every value is validated server-side regardless of what the form enforced,
 *      because the form is a convenience and the server is the boundary.
 */
export async function saveSettingsAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireAuthedSession();

  const parsed = formSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    timezone: formData.get("timezone") ?? "",
    timeFormat: formData.get("timeFormat") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      saved: false,
      fieldErrors: {
        displayName: fieldErrors.displayName?.[0],
        timezone: fieldErrors.timezone?.[0],
        timeFormat: fieldErrors.timeFormat?.[0],
      },
    };
  }

  const { displayName, timezone, timeFormat } = parsed.data;
  const currentSettings = await getSettings(session.user.id);

  const identityChanged =
    displayName !== session.profile.display_name ||
    timezone !== session.profile.timezone;
  const timeFormatChanged = timeFormat !== currentSettings.timeFormat;

  if (!identityChanged && !timeFormatChanged) {
    return { error: null, saved: true };
  }

  if (identityChanged) {
    const result = await updateProfile(session.user.id, { displayName, timezone });
    if (!result.ok) return { error: result.error, saved: false };

    await recordActivity(session.user.id, {
      eventType: "profile.updated",
      summary: describeIdentityChange({
        nameChanged: displayName !== session.profile.display_name,
        timezoneChanged: timezone !== session.profile.timezone,
      }),
      subjectType: "profile",
      subjectId: session.profile.id,
      detail: {
        displayNameSet: displayName !== null,
        timezone,
      },
    });
  }

  if (timeFormatChanged) {
    const result = await updateSettings(session.user.id, { timeFormat });
    if (!result.ok) return { error: result.error, saved: false };

    await recordActivity(session.user.id, {
      eventType: "settings.updated",
      summary: `Time format changed to ${timeFormat}`,
      detail: { timeFormat },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/activity");

  return { error: null, saved: true };
}

function describeIdentityChange(changed: {
  nameChanged: boolean;
  timezoneChanged: boolean;
}): string {
  if (changed.nameChanged && changed.timezoneChanged) {
    return "Display name and time zone updated";
  }
  return changed.nameChanged ? "Display name updated" : "Time zone updated";
}
