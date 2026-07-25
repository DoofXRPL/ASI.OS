/**
 * Shared form state for the settings action.
 *
 * Kept separate from `actions.ts` because a `"use server"` module may only export
 * async functions — a constant exported alongside a Server Action fails the build.
 */
export interface SettingsFormState {
  error: string | null;
  saved: boolean;
  fieldErrors?: {
    displayName?: string;
    timezone?: string;
    timeFormat?: string;
  };
}

export const EMPTY_SETTINGS_STATE: SettingsFormState = {
  error: null,
  saved: false,
};
