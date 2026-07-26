/**
 * Shared form state for the project actions.
 *
 * Kept separate from `actions.ts` because a `"use server"` module may only
 * export async functions.
 */

export interface NewProjectFormState {
  error: string | null;
  fieldErrors?: {
    name?: string;
    outcome?: string;
  };
}

export const EMPTY_NEW_PROJECT_STATE: NewProjectFormState = { error: null };

export interface ProjectFormState {
  error: string | null;
  /** When the last save succeeded, so a second save is distinguishable. */
  savedAt: number | null;
  fieldErrors?: {
    nextAction?: string;
    outcome?: string;
    status?: string;
    blockedReason?: string;
  };
}

export const EMPTY_PROJECT_STATE: ProjectFormState = {
  error: null,
  savedAt: null,
};
