/**
 * Shared form state for the sign-in action.
 *
 * Kept separate from `actions.ts` because a `"use server"` module may only export
 * async functions — a constant exported alongside a Server Action fails the build.
 */
export interface AuthFormState {
  error: string | null;
  fieldErrors?: { email?: string; password?: string };
}

export const EMPTY_AUTH_STATE: AuthFormState = { error: null };
