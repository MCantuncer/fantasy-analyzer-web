/**
 * Geometry for the free-agent climb on Best move ("The field"): one lit line from today's odds
 * to the odds after the pickup, and faint strands for a random few of the other straight
 * add/drops the analysis scored, each ending at its own odds. Pure, so it can be tested without a browser.
 *
 * The scale is zoomed (a window of 20 points when the moves fit, wider when they don't) and
 * always shows its ticks, so a +4 never pretends to be bigger than it is.
 */

export interface ClimbInput {
  before: number // playoff odds today, 0-1
  after: number // after the chosen pickup
  others: number[] // after-odds of the other straight pickups
  seed?: string // names the pick, so the same pick always draws the same grey lines
}

export interface Strand {
  y: number // px from the top of the plot
  x: number // end, 0-1 of the width
}

export interface StrandGroup {
  pct: number // whole percent the strands end at
  y: number
  count: number
  gain: number // whole points above today's odds (below, when negative): what the label prints
}

export interface Climb {
  lo: number // window bottom, whole percent
  hi: number // window top, whole percent
  ticks: { pct: number; y: number }[]
  even: number | null // y of the 50% line when it's in the window
  start: { x: number; y: number }
  end: { x: number; y: number }
  strands: Strand[]
  groups: StrandGroup[]
  height: number
}

export const CLIMB = {
  plot: 240, // px from the window's top to its bottom: 12 px a point on a 20-point window
  above: 94, // the new odds and the added player's face stand this far above the end point
  below: 74, // today's odds, the dropped player's face and the caption reach this far below the start
  edge: 10, // least room above the window, for the top tick label
  caption: 42, // least room below it, for the two-line caption under the strands
  startX: 0.2,
  endX: 0.6,
  strandFrom: 0.68,
  strandTo: 0.86, // leaves the right edge to the gain labels
  maxStrands: 24,
}

const round = (x: number) => Math.round(x * 100)

/** A small seeded generator (a string hash into mulberry32): numbers in [0, 1), the same for the same seed. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The zoom window in whole percent: 20 points around the move, or wider in steps of 10. */
export function climbWindow(before: number, after: number): [number, number] {
  const a = round(Math.min(before, after))
  const b = round(Math.max(before, after))
  const span = b - a <= 12 ? 20 : Math.min(100, Math.ceil((b - a + 8) / 10) * 10)
  const mid = (a + b) / 2
  let lo = Math.round((mid - span / 2) / 5) * 5
  // Nearest step can leave an end of the move out: shift a step until both fit.
  while (lo > a && lo > 0) lo -= 5
  while (lo + span < b && lo + span < 100) lo += 5
  lo = Math.max(0, Math.min(100 - span, lo))
  return [lo, lo + span]
}

export function climb({ before, after, others, seed = '' }: ClimbInput): Climb {
  const [lo, hi] = climbWindow(before, after)
  const { plot } = CLIMB
  // Room above and below the window only where the labels at the two ends need it.
  const at = (p: number) => ((hi - Math.max(lo, Math.min(hi, p * 100))) / (hi - lo)) * plot
  const top = Math.max(CLIMB.edge, CLIMB.above - at(after))
  const bottom = Math.max(CLIMB.caption, CLIMB.below - (plot - at(before)))
  const height = top + plot + bottom
  const y = (p: number) => {
    const v = Math.max(lo, Math.min(hi, p * 100))
    return top + ((hi - v) / (hi - lo)) * plot
  }
  const step = hi - lo <= 20 ? 5 : 10
  const ticks: { pct: number; y: number }[] = []
  for (let p = lo; p <= hi; p += step) ticks.push({ pct: p, y: y(p / 100) })

  // Strands that end at the same whole percent fan out side by side, highest first. A pickup
  // that would not raise your odds is no rival, so it is never drawn.
  const rivals = others
    .filter((o) => round(o) > round(before))
    .sort((a, b) => b - a)
    .slice(0, CLIMB.maxStrands)
  const levels = new Map<number, number>()
  for (const o of rivals) levels.set(round(o), (levels.get(round(o)) ?? 0) + 1)

  // Of the levels below the pick, a random few are drawn (at least one, at most all of them):
  // a strand at every point under a +6 pick was a ladder of grey lines. Every line drawn is
  // still a real pickup, and a level that ties or beats the pick is always drawn.
  const rand = seeded(seed)
  const below = [...levels.keys()].filter((p) => p < round(after))
  const take = below.length ? 1 + Math.floor(rand() * below.length) : 0
  for (let i = below.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[below[i], below[j]] = [below[j], below[i]]
  }
  const hidden = new Set(below.slice(take))
  const byPct = new Map([...levels].filter(([p]) => !hidden.has(p)))
  const widest = Math.max(1, ...byPct.values())
  const gap = widest > 1 ? (CLIMB.strandTo - CLIMB.strandFrom) / (widest - 1) : 0
  const strands: Strand[] = []
  const groups: StrandGroup[] = []
  for (const [p, count] of byPct) {
    groups.push({ pct: p, y: y(p / 100), count, gain: p - round(before) })
    for (let k = 0; k < count; k++) strands.push({ y: y(p / 100), x: CLIMB.strandFrom + k * gap })
  }

  // Its gain beside each group, skipping any too close to the one above to read. The dots
  // already count the pickups; a bare count here read as a gain bigger than the pick's.
  groups.sort((a, b) => a.y - b.y)
  const labelled: StrandGroup[] = []
  for (const g of groups) if (!labelled.length || g.y - labelled[labelled.length - 1].y >= 12) labelled.push(g)

  return {
    lo,
    hi,
    ticks,
    even: lo <= 50 && hi >= 50 ? y(0.5) : null,
    start: { x: CLIMB.startX, y: y(before) },
    end: { x: CLIMB.endX, y: y(after) },
    strands,
    groups: labelled,
    height,
  }
}

/** An S-curve from one point to another: leaves flat, lifts, lands flat. x in 0-1000, y in px. */
export function sCurve(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`
}
