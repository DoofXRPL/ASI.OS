/**
 * The capture shortcut, and the clicks that must not become it.
 *
 * Pure and tested, in the same spirit as `nav.ts`: the rules about which key
 * combination opens capture, and which pointer gestures the browser keeps for
 * itself, are decided here rather than inside an event handler where they can
 * only be verified by hand.
 */

/**
 * Modifier + Shift + C. Shift is part of it so the combination cannot collide
 * with ⌘C, and the letter is the first letter of the thing it does.
 */
export const CAPTURE_SHORTCUT_KEY = "c";

/** The id of the capture field already on `/inbox`. */
export const INLINE_CAPTURE_FIELD_ID = "capture";

/**
 * The id of the capture field inside the sheet.
 *
 * Deliberately different from the inline one. On `/inbox` both forms are in the
 * document at once, and two elements sharing an id makes `getElementById`,
 * `<label for>` and `aria-describedby` all resolve to whichever came first.
 */
export const SHEET_CAPTURE_FIELD_ID = "quick-capture-field";

/** Just enough of a keyboard event to decide, so this stays testable. */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat?: boolean;
}

/**
 * Whether a keydown is the capture shortcut.
 *
 * Either Command or Control counts, so the same handler serves both platforms;
 * Alt does not, because ⌥ combinations produce characters on macOS and
 * swallowing one would break typing. A held key repeats, and re-opening an open
 * sheet on every repeat is noise.
 */
export function isCaptureShortcut(event: ShortcutKeyEvent): boolean {
  if (event.repeat === true) return false;
  if (!event.shiftKey || event.altKey) return false;
  if (!event.metaKey && !event.ctrlKey) return false;
  return event.key.toLowerCase() === CAPTURE_SHORTCUT_KEY;
}

/** Just enough of a mouse event to decide. */
export interface TriggerClickEvent {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Whether a click on the Capture trigger should open the sheet in place.
 *
 * The trigger is a link to `/inbox#capture`, and a modified click on a link
 * belongs to the browser: ⌘-click and middle-click open a new tab, Shift a new
 * window, Alt downloads. Intercepting those would take away behaviour the
 * reader already has, to offer something they did not ask for.
 */
export function opensSheetInPlace(event: TriggerClickEvent): boolean {
  if (event.button !== 0) return false;
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Whether to write the modifier as ⌘. Apple keyboards are the only ones where
 * the Command key exists, and showing "Ctrl" to someone holding ⌘ is a small
 * lie about their own machine.
 */
export function isApplePlatform(platform: string): boolean {
  return /^(mac|iphone|ipad|ipod)/i.test(platform.trim());
}

/**
 * The shortcut as keys to render, in press order. Returned as parts rather than
 * a string so each can be marked up as a key rather than as prose.
 */
export function captureShortcutKeys(isApple: boolean): string[] {
  return isApple ? ["⌘", "⇧", "C"] : ["Ctrl", "Shift", "C"];
}

/** The same shortcut as text, for labels that cannot contain elements. */
export function captureShortcutLabel(isApple: boolean): string {
  const keys = captureShortcutKeys(isApple);
  return isApple ? keys.join("") : keys.join("+");
}
