// "Straw fire or bigger role?": why a player is on a hot run, and how much of it tends to last.
// Explanation only: the odds and trade numbers already price the fade in, so nothing here is an
// add or don't-add signal and nothing here is coloured as an outcome. Pure copy helpers.
import type { HotRun } from '../api/client'

export type HotVerdict = HotRun['verdict']
export type PartKey = 'minutes' | 'shooting' | 'production'

/** One name per verdict, everywhere (row, open row, card, screen readers). */
export const VERDICT: Record<HotVerdict, string> = {
  straw_fire: 'Straw fire',
  bigger_role: 'Bigger role',
  mixed: 'Role and luck',
}

/**
 * Share of each part still there over the next 10 games, validated on five seasons (api
 * analysis/form.py). The API sends only the blended `likely_kept`, so these three sit here; they
 * only size the solid part of each bar and its words, never the headline.
 */
export const KEEP: Record<PartKey, number> = { minutes: 0.51, production: 0.19, shooting: 0.17 }

/** A part smaller than this share of the run is left out of the table. */
export const MIN_SHARE = 0.08

/** The bars share one fixed scale (value per game), so a small run looks small. */
export const BAR_SCALE = 6

/** Minutes that moved less than this read as "his usual minutes". */
const SAME_MINUTES = 2

const ARROW = ' → '
const whole = (n: number) => String(Math.round(n))
const pc = (f: number) => `${Math.round(f * 100)}%`
const has = (n: number | null | undefined): n is number => n != null && Number.isFinite(n)

const FRACTIONS: [number, string][] = [
  [1 / 6, 'a sixth'],
  [1 / 5, 'a fifth'],
  [1 / 4, 'a quarter'],
  [1 / 3, 'a third'],
  [2 / 5, 'two fifths'],
  [1 / 2, 'half'],
]

/** A share in plain words: "about a fifth", "about two fifths", "very little", "more than half". */
export function keptWords(share: number): string {
  if (share < 0.12) return 'very little'
  if (share >= 0.58) return 'more than half'
  let best = FRACTIONS[0]
  for (const f of FRACTIONS) if (Math.abs(f[0] - share) < Math.abs(best[0] - share)) best = f
  return `about ${best[1]}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The headline's second line: "About a fifth of it should last". */
export function keptLine(run: HotRun): string {
  return `${cap(keptWords(run.likely_kept))} of it should last`
}

/** The fixed share a part keeps, as words on its bar: "half lasts", "a fifth lasts". */
export function partKeepWords(key: PartKey): string {
  return `${keptWords(KEEP[key]).replace(/^about /, '')} lasts`
}

const partSize = (run: HotRun, key: PartKey) =>
  key === 'minutes' ? run.minutes_part : key === 'shooting' ? run.shooting_part : run.production_part

/** The run's size: the parts' magnitudes, so one that went down still counts toward the shares. */
const runSize = (run: HotRun) =>
  Math.abs(run.minutes_part) + Math.abs(run.shooting_part) + Math.abs(run.production_part) || 1

/** Points per 10 minutes, the plain stand-in for "more per minute". */
const per10 = (pts: number, min: number) => (min > 0 ? (pts / min) * 10 : null)

export interface RunPart {
  key: PartKey
  label: string
  /** Usual and recent, printed ("22", "39%", "4.2 pts"); null when the API sent no number. */
  from: string | null
  to: string | null
  /** The bar's length on the fixed scale, 0-1. */
  reach: number
  /** The solid share of the bar: what tends to last. */
  keep: number
  /** This part went down during the run (it pulls the other way). */
  down: boolean
  /** Words beside the bar. */
  note: string
}

/** The table, steadiest part first: Minutes, Shooting, Per 10 minutes. Parts under 8% of the run drop out. */
export function runParts(run: HotRun): RunPart[] {
  const size = runSize(run)
  const p10u = per10(run.pts_usual, run.minutes_usual)
  const p10r = per10(run.pts_recent, run.minutes_recent)
  const rows: { key: PartKey; label: string; from: string | null; to: string | null }[] = [
    { key: 'minutes', label: 'Minutes', from: whole(run.minutes_usual), to: whole(run.minutes_recent) },
    {
      key: 'shooting',
      label: 'Shooting',
      from: has(run.fg_usual) && has(run.fg_recent) ? pc(run.fg_usual) : null,
      to: has(run.fg_usual) && has(run.fg_recent) ? pc(run.fg_recent) : null,
    },
    {
      key: 'production',
      label: 'Per 10 minutes',
      from: p10u != null && p10r != null ? p10u.toFixed(1) : null,
      to: p10u != null && p10r != null ? `${p10r.toFixed(1)} pts` : null,
    },
  ]
  return rows
    .filter((r) => Math.abs(partSize(run, r.key)) / size >= MIN_SHARE)
    .map((r) => {
      const v = partSize(run, r.key)
      const down = v < 0
      return {
        ...r,
        reach: Math.min(1, Math.abs(v) / BAR_SCALE),
        keep: down ? 0 : KEEP[r.key],
        down,
        note: down ? 'went down' : partKeepWords(r.key),
      }
    })
}

/** The heat part that drives a straw fire: shooting unless more-per-minute is clearly bigger. */
const heatLead = (run: HotRun): 'shooting' | 'production' =>
  run.production_part > run.shooting_part ? 'production' : 'shooting'

const shootingShown = (run: HotRun) => run.shooting_part > 0 && run.shooting_part / runSize(run) >= MIN_SHARE
const productionShown = (run: HotRun) => run.production_part > 0 && run.production_part / runSize(run) >= MIN_SHARE
const fgPair = (run: HotRun) => (has(run.fg_usual) && has(run.fg_recent) ? { u: run.fg_usual, r: run.fg_recent } : null)
const minutesMoved = (run: HotRun) => run.minutes_recent - run.minutes_usual

/**
 * The row's one line: the verdict word and the single fact behind it, built from the parts.
 * "Straw fire" + "shooting 39% → 54%", "Bigger role" + "minutes 21 → 32".
 */
export function rowLine(run: HotRun): { word: string; reason: string } {
  const word = VERDICT[run.verdict]
  const mins = `minutes ${whole(run.minutes_usual)}${ARROW}${whole(run.minutes_recent)}`
  if (run.verdict !== 'straw_fire') return { word, reason: mins }
  // "Same minutes" waits for the open row: the row has room for one fact.
  if (heatLead(run) === 'production') return { word, reason: 'more per minute' }
  const fg = fgPair(run)
  // The percent sign once ("39 → 54%"), so the line fits the narrow desktop column.
  return { word, reason: fg ? `shooting ${Math.round(fg.u * 100)}${ARROW}${pc(fg.r)}` : 'hot shooting' }
}

/** "his usual minutes (24)", "a few more minutes (22 to 24)", "fewer minutes (28 to 23)". */
function minutesClause(run: HotRun): string {
  const d = minutesMoved(run)
  const pair = `(${whole(run.minutes_usual)} to ${whole(run.minutes_recent)})`
  if (Math.abs(d) < SAME_MINUTES) return `his usual minutes (${whole(run.minutes_recent)})`
  if (d > 0) return `${d < 5 ? 'a few more' : 'more'} minutes ${pair}`
  return `${d > -5 ? 'a few' : ''} fewer minutes ${pair}`.trim()
}

/** "shot 54% against his usual 39%" and "did more per minute" (only the parts the table shows). */
function heatBits(run: HotRun): string[] {
  const bits: string[] = []
  if (shootingShown(run)) {
    const fg = fgPair(run)
    bits.push(fg && fg.r > fg.u ? `shot ${pc(fg.r)} against his usual ${pc(fg.u)}` : 'shot hotter than usual')
  }
  if (productionShown(run)) bits.push('did more per minute')
  return bits
}

/**
 * Can's "he played this and that, so …", in one sentence. It never repeats the headline's share,
 * and a bigger role never reads as if it will hold.
 */
export function runSentence(run: HotRun): string {
  const mins = minutesClause(run)
  const heat = heatBits(run)
  if (run.verdict === 'straw_fire') {
    const lead = heat.length ? `He played ${mins} but ${heat.join(' and ')}` : `He played ${mins}`
    return `${lead}, so most of it is heat, which cools off fast.`
  }
  if (run.verdict === 'bigger_role') {
    return `He played ${mins}, and that's the bigger part of the jump: minutes stick better than hot shooting, though not all of them.`
  }
  const did = heat.length === 2 ? `, ${heat[0]} and ${heat[1]}` : heat.length ? ` and ${heat[0]}` : ''
  return `He played ${mins}${did}, so it's part role, which tends to stay, and part heat, which fades.`
}

/** One sentence for screen readers on the row; arrows read as "to". */
export function rowSaid(run: HotRun): string {
  const mins =
    Math.abs(minutesMoved(run)) < SAME_MINUTES
      ? 'same minutes'
      : `minutes ${whole(run.minutes_usual)} to ${whole(run.minutes_recent)}`
  const fg = fgPair(run)
  const shot = shootingShown(run)
    ? fg && fg.r > fg.u
      ? `shooting ${pc(fg.r)} against his usual ${pc(fg.u)}`
      : 'shooting hotter than usual'
    : null
  let facts: string[]
  if (run.verdict === 'straw_fire') {
    const heat = heatLead(run) === 'production' ? 'more per minute' : (shot ?? 'hot shooting')
    facts = [heat, mins]
  } else if (run.verdict === 'mixed') {
    facts = shot ? [mins, shot] : [mins]
  } else {
    facts = [mins]
  }
  return `${VERDICT[run.verdict]}. ${cap(facts.join(', '))}. ${keptLine(run).replace(' of it', '')}.`
}

/** The table's window, named: "Last 6 games, against his usual". */
export function runWindow(run: HotRun): string {
  return `Last ${run.games} ${run.games === 1 ? 'game' : 'games'}`
}
