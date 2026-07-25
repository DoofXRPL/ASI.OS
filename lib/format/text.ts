/**
 * Turns a raw message into something that reads as a sentence.
 *
 * Database errors arrive as fragments — "permission denied for table projects"
 * — and are shown to the reader next to prose explaining what it means. Without
 * this, the two run together into "permission denied for table projects Nothing
 * has been changed", which reads as carelessness at exactly the moment the
 * interface is asking to be trusted.
 *
 * The wording itself is never changed. Only the first letter and the final stop
 * are, so what the database said is still what the reader sees.
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";

  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}
