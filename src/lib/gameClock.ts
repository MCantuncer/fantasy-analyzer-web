// Where a live NBA game is, from the short clock label the API sends ("Q2 2:30", "Half", "End Q3",
// "OT 0:48", "2OT 1:10"). ESPN switches to tenths in a period's last minute ("Q4 48.2"), which reads
// as 0:48 here: the data refreshes once a minute, so tenths would only pretend to be precise.

/** Regulation is 4 x 12 minutes; each overtime adds 5. */
const QUARTER = 12
const OVERTIME = 5
const REGULATION = 4 * QUARTER

export type GameClock = {
  /** 1-4 are quarters, 5 is the first overtime, 6 the second, and so on. */
  period: number
  /** The period as it's written on the card: "Q2", "OT", "2OT". */
  label: string
  /** True at a break: halftime or the end of a period. */
  isBreak: boolean
  /** The break as a word: "Half", "End Q3". */
  word?: string
  /** Time left in the period, "2:30". Running clocks only. */
  time?: string
  /** Minutes left in the period. Running clocks only. */
  minutesLeft?: number
  /** Share of the game played, 0..1. The scale grows by 5 minutes with each overtime. */
  progress: number
  /** Regulation minutes still to play (0 from the 4th quarter's end on). */
  toPlay: number
}

const periodLen = (k: number) => (k <= 4 ? QUARTER : OVERTIME)
/** Minutes played before period k starts. */
const before = (k: number) => (k <= 4 ? QUARTER * (k - 1) : REGULATION + OVERTIME * (k - 5))
/** The game's length as far as period k goes: overtime stretches the scale. */
const total = (k: number) => (k <= 4 ? REGULATION : REGULATION + OVERTIME * (k - 4))

export const periodLabel = (k: number) => (k <= 4 ? `Q${k}` : k === 5 ? 'OT' : `${k - 4}OT`)

const ORDINAL = ['', '1st', '2nd', '3rd', '4th']
/** The period as it's spoken: "2nd quarter", "overtime", "2nd overtime". */
export const periodSpoken = (k: number) =>
  k <= 4 ? `${ORDINAL[k]} quarter` : k === 5 ? 'overtime' : `${ORDINAL[k - 4] ?? `${k - 4}th`} overtime`

function periodOf(token: string): number | null {
  const t = token.toUpperCase()
  const q = t.match(/^Q([1-4])$/)
  if (q) return Number(q[1])
  const ot = t.match(/^(\d*)OT$/)
  if (ot) return 4 + (ot[1] ? Number(ot[1]) : 1)
  return null
}

export function parseClock(raw: string | null | undefined): GameClock | null {
  const c = (raw ?? '').trim()
  if (!c) return null
  if (/^half/i.test(c)) {
    return { period: 2, label: 'Q2', isBreak: true, word: 'Half', progress: 0.5, toPlay: 2 * QUARTER }
  }
  const end = c.match(/^End\s+(\S+)$/i)
  if (end) {
    const k = periodOf(end[1])
    if (k == null) return null
    const done = before(k) + periodLen(k)
    return {
      period: k,
      label: periodLabel(k),
      isBreak: true,
      word: `End ${periodLabel(k)}`,
      progress: done / total(k),
      toPlay: Math.max(0, REGULATION - done),
    }
  }
  const run = c.match(/^(\S+)\s+(?:(\d+):(\d{1,2})(?:\.\d+)?|(\d+(?:\.\d+)?))$/)
  if (!run) return null
  const k = periodOf(run[1])
  if (k == null) return null
  // "2:30" or, in the last minute, "48.2" seconds.
  const secs = run[4] != null ? Math.floor(Number(run[4])) : Number(run[2]) * 60 + Number(run[3])
  const minutesLeft = Math.min(periodLen(k), secs / 60)
  const played = before(k) + periodLen(k) - minutesLeft
  return {
    period: k,
    label: periodLabel(k),
    isBreak: false,
    time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
    minutesLeft,
    progress: Math.min(1, Math.max(0, played / total(k))),
    toPlay: Math.max(0, REGULATION - played),
  }
}

/** NBA clutch time: the last 5:00 of the 4th quarter or any overtime, with a margin of 5 or less. */
export function isClutch(clock: GameClock | null, away: number, home: number): boolean {
  if (!clock || clock.isBreak) return false
  const late = clock.period >= 5 || (clock.period === 4 && (clock.minutesLeft ?? QUARTER) <= 5)
  return late && Math.abs(away - home) <= 5
}

/**
 * How hot the game burns, 0..1. Heat follows closeness, not the clock: a blowout stays cool even in
 * the 4th (its starters sit), a close game warms as it gets late, and clutch time burns hottest.
 * The lead that can still be closed grows with the time left: 8 points plus half a point a minute.
 */
export function heatOf(clock: GameClock | null, away: number, home: number): number {
  if (!clock || clock.isBreak) return 0
  const margin = Math.abs(away - home)
  const remaining = clock.toPlay + (clock.period >= 5 ? (clock.minutesLeft ?? 0) : 0)
  const closeness = Math.min(1, Math.max(0, 1 - margin / (8 + 0.5 * remaining)))
  let heat = 0.15 + 0.85 * clock.progress * closeness
  if (isClutch(clock, away, home)) heat = Math.max(heat, 0.85 + 0.03 * (5 - margin))
  return Math.min(1, heat)
}

/** The fantasy answer under the box score's clock: how much basketball is left for your players. */
export function timeLeftLine(clock: GameClock | null): string {
  if (!clock) return ''
  if (clock.period >= 5) return clock.period === 5 ? 'Overtime' : `Overtime ${clock.period - 4}`
  if (clock.isBreak && clock.period === 4) return 'Overtime next'
  if (clock.period === 4) return 'Last quarter'
  return `${Math.round(clock.toPlay)} min to play`
}
