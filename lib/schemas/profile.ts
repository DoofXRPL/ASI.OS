import { z } from "zod";

/** Verifies a string is a real IANA time zone rather than accepting any text. */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const profileUpdateSchema = z.object({
  /**
   * An empty field clears the name rather than storing "". ASI OS never invents a
   * name, so a cleared value means the greeting stays generic.
   */
  displayName: z
    .string()
    .trim()
    .max(120, "Keep your name to 120 characters or fewer.")
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  timezone: z
    .string()
    .trim()
    .min(1, "Choose a time zone.")
    .max(64)
    .refine(isValidTimeZone, "That is not a recognised time zone."),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
