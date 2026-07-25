/**
 * Shared form state for the inbox actions.
 *
 * Kept separate from `actions.ts` because a `"use server"` module may only
 * export async functions — a constant exported alongside a Server Action fails
 * the build.
 */

export interface CaptureFormState {
  error: string | null;
  /**
   * When the last capture succeeded. A timestamp rather than a boolean so two
   * captures in a row are distinguishable, and the field can be cleared and
   * refocused for the second one.
   */
  capturedAt: number | null;
}

export const EMPTY_CAPTURE_STATE: CaptureFormState = {
  error: null,
  capturedAt: null,
};

export interface ProcessFormState {
  error: string | null;
  fieldErrors?: {
    projectId?: string;
    projectName?: string;
    nextAction?: string;
    kind?: string;
  };
}

export const EMPTY_PROCESS_STATE: ProcessFormState = { error: null };
