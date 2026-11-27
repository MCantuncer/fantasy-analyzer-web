import type { Climb } from './climb'

/** The end figure (odds over the ▲ chip) stands this far above the after dot, and is this tall. */
export const END_GAP = 18
const END_H = 76
const LABEL_H = 16
/** The even-odds label sits this far under its line (light pass L0), or as far above it. */
const EVEN_GAP = 6

/**
 * Where "50% · even odds" goes: at the right end, just under its line, where every strand has
 * already climbed away. If a strand's gain or the end figure sits there, it goes just above the
 * line; if both places are taken, only the line shows.
 */
export function evenLabelTop(c: Climb): number | null {
  if (c.even == null) return null
  const endTop = c.end.y - END_GAP - END_H
  const endBottom = c.end.y - END_GAP
  const taken = (top: number) =>
    c.groups.some((g) => g.y + 8 > top && g.y - 8 < top + LABEL_H) || (top < endBottom && top + LABEL_H > endTop)
  const under = c.even + EVEN_GAP
  const over = c.even - EVEN_GAP - LABEL_H
  if (!taken(under)) return under
  if (!taken(over)) return over
  return null
}
