// The API lists up to this many trades per style. Fewer means only that many deals passed its
// checks today, not that something failed: early in the season few trades help both teams.
export const FULL_LIST = 10;

/** The note for a short list, or '' when the list is full or empty (the empty text covers that). */
export function shortListNote(found: number): string {
  if (found <= 0 || found >= FULL_LIST) return "";
  return `Only ${found} ${found === 1 ? "deal does" : "deals do"} that right now.`;
}
