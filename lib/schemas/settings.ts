import { z } from "zod";

/**
 * The shape of `user_settings.settings`.
 *
 * Two rules govern this file, and they are the reason it is deliberately tiny:
 *
 *   1. A preference exists here only if something in the product actually reads
 *      it. Settings that look real but change nothing are a trust bug, so
 *      unwired controls are not rendered and unwired keys are not defined.
 *   2. Parsing never throws. A settings row that has drifted or been corrupted
 *      must degrade to defaults rather than take the application down; losing a
 *      preference is recoverable, losing access to your own records is not.
 */
export const TIME_FORMATS = ["12h", "24h"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

/**
 * Field validators, declared once and reused by both schemas below.
 *
 * Reading and writing genuinely differ: a read fills in defaults so the
 * application always has a complete object, while a write must NOT, because an
 * absent key means "leave this alone". Applying a default on write would silently
 * reset a preference the user never touched.
 */
const fields = {
  timeFormat: z.enum(TIME_FORMATS),
} as const;

export const settingsSchema = z.object({
  /** Bumped when a migration of the stored shape becomes necessary. */
  version: z.literal(1).default(1),
  /** Read by every timestamp rendered in the interface. */
  timeFormat: fields.timeFormat.default("24h"),
});

export type UserSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = settingsSchema.parse({});

/**
 * Normalises stored settings. Unknown keys are dropped and invalid values fall
 * back to their default, so the returned object is always safe to use.
 */
export function parseSettings(value: unknown): UserSettings {
  const result = settingsSchema.safeParse(value);
  if (result.success) return result.data;

  // Recover field by field so one bad value does not discard the good ones.
  const partial = typeof value === "object" && value !== null ? value : {};
  const recovered: Record<string, unknown> = {};
  for (const key of Object.keys(settingsSchema.shape) as (keyof UserSettings)[]) {
    const candidate = (partial as Record<string, unknown>)[key];
    const field = settingsSchema.shape[key].safeParse(candidate);
    if (field.success) recovered[key] = field.data;
  }
  return settingsSchema.parse(recovered);
}

/**
 * Validates a settings update from a form or API boundary.
 *
 * Strict, and with no defaults: an unknown key is rejected rather than quietly
 * discarded, and an omitted key leaves the stored value untouched. `version` is
 * absent on purpose — it describes the stored shape and is owned by this module,
 * never by whoever is submitting a form.
 */
export const settingsUpdateSchema = z
  .object({
    timeFormat: fields.timeFormat.optional(),
  })
  .strict();

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
