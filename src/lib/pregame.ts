// The pre-game box on Scores ("Overture", Can 2026-11-20): why Our call is what it is, in words built
// from the call's own pieces (api app/analysis/preview.py), and each player's line for the game.
// Pure functions only. Rules this follows:
// - No betting words: no spread, over/under, odds, lock, props, line moves. "Our call", "estimate".
// - One number per stat for a player (Can, 2026-11-15). The spread of how a GAME can end is shown,
//   because "by 5" alone reads as if every game ends close (Can, 2026-11-20).
// - Whole numbers in the table; one decimal only inside a player's opened why, so its steps add up.
import type { PregameBox, PregameLine, PregamePlayer, PregameSide, PregameStats } from '../api/client'
import { nickname } from './scores'

export type Side = 'away' | 'home'

const other = (s: Side): Side => (s === 'away' ? 'home' : 'away')

/** "Orlando" from "Orlando Magic", "Oklahoma City" from "Oklahoma City Thunder". */
export function place(side: Pick<PregameSide, 'name' | 'abbrev'>): string {
  const nick = nickname(side.name)
  const rest = side.name.slice(0, side.name.length - nick.length).trim()
  return rest || side.abbrev
}

const two = (n: number) => n.toFixed(2)
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/** "4% more than the league's 1.12", or "about the league's 1.12" within 3%; without the league's
    number once it has been said. */
function vsLeague(x: number, league: number, first = true): string {
  const p = Math.round((x / league - 1) * 100)
  if (Math.abs(p) < 3) return first ? `about the league's ${two(league)}` : 'about average'
  return `${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} than the league${first ? `'s ${two(league)}` : ''}`
}

export interface WhyLine {
  kind: 'matchup' | 'home_court' | 'three_point_luck' | 'back_to_back' | 'total'
  label: string
  points: number
  text: string
  /** Shown quieter: a piece worth nothing tonight. */
  quiet?: boolean
}

/** One sentence (16 words or fewer) on what decides the call: the biggest edge, then home or road. */
export function headline(b: PregameBox): string {
  const w = b[b.pick]
  const l = b[other(b.pick)]
  const W = place(w)
  const L = place(l)
  const term = (k: string) => b.terms.find((t) => t.kind === k)?.points ?? 0
  const lg = w.parts.league
  // What helps the pick most, as a share of the league's rate: their defense, our offense, ours, theirs.
  const edges = [
    { v: w.parts.defense_allowed / lg - 1, text: `${L}'s defense is soft`, ours: false },
    { v: w.parts.offense / lg - 1, text: `${W}'s offense is sharp`, ours: true },
    { v: 1 - l.parts.defense_allowed / lg, text: `${W}'s defense is tight`, ours: true },
    { v: 1 - l.parts.offense / lg, text: `${L}'s offense has been cold`, ours: false },
  ].sort((a, c) => c.v - a.v)
  const home = term('home_court')
  const b2b = term('back_to_back')
  if (term('matchup') <= 0 || edges[0].v <= 0) {
    if (home > 0) return `Home court tips a close matchup to ${W}.`
    return `Three-point shooting should even out, and that favors ${W}.`
  }
  const { text: lead, ours } = edges[0]
  if (home < 0)
    return ours
      ? `${lead}, enough to outweigh playing on the road.`
      : `${lead}, and that outweighs ${W} playing on the road.`
  if (b2b > 0) return `${lead}, and ${L} played last night.`
  if (home > 0) return ours ? `${lead}, and they're at home.` : `${lead}, and ${W} is at home.`
  return `${lead}.`
}

/** Calls at this sureness picked the winner this many times in 100 (28 seasons, api #163). */
export function winnerRate(chance: number): { band: string; times: number } {
  const pct = Math.round(chance * 100)
  if (pct >= 80) return { band: '80% and up', times: 87 }
  if (pct >= 65) return { band: '65–79%', times: 74 }
  if (pct >= 55) return { band: '55–64%', times: 61 }
  return { band: '50–54%', times: 52 }
}

/** The margin piece by piece, each with a plain sentence from the numbers behind it, then the total. */
export function whyLines(b: PregameBox): WhyLine[] {
  const ws = b.pick
  const w = b[ws]
  const l = b[other(ws)]
  const W = place(w)
  const L = place(l)
  const lg = w.parts.league
  const lines: WhyLine[] = []
  for (const t of b.terms) {
    if (t.kind === 'matchup') {
      const trips = Math.round(w.parts.possessions)
      lines.push({
        kind: t.kind,
        label: 'Matchup',
        points: t.points,
        text:
          `${L} gives up ${two(w.parts.defense_allowed)} points a trip, ${vsLeague(w.parts.defense_allowed, lg)}. ` +
          `${W} scores ${two(w.parts.offense)} a trip, ${vsLeague(w.parts.offense, lg, false)}. ` +
          `At the other end, ${L} scores ${two(l.parts.offense)} against ${W}'s ${two(l.parts.defense_allowed)} allowed. ` +
          `Over about ${trips} trips each: ${Math.round(w.parts.ratings)} for ${W}, ${Math.round(l.parts.ratings)} for ${L} before anything else.`,
      })
    } else if (t.kind === 'home_court') {
      const home = place(b.home)
      const away = place(b.away)
      lines.push({
        kind: t.kind,
        label: 'Home court',
        points: t.points,
        text: `${home} gets about 1 point more at home, ${away} about 1 fewer on the road.`,
      })
    } else if (t.kind === 'three_point_luck') {
      lines.push({ kind: t.kind, label: 'Three-point luck', points: t.points, text: luckText(b, t.points) })
    } else {
      const tired = (['away', 'home'] as const).filter((s) => b[s].parts.back_to_back < 0).map((s) => place(b[s]))
      lines.push({
        kind: t.kind,
        label: 'Back-to-back',
        points: t.points,
        quiet: t.points === 0 && tired.length === 0,
        text:
          tired.length === 0
            ? 'Neither team played last night.'
            : tired.length === 2
              ? 'Both teams played last night, so it cancels out.'
              : `${tired[0]} played last night: about 1 point fewer.`,
      })
    }
  }
  const r = winnerRate(b.chance)
  lines.push({
    kind: 'total',
    label: 'Total',
    points: b.margin,
    text: `${W} by ${b.margin}, ${w.call} to ${l.call}. Calls at ${r.band} have picked the winner ${r.times} times in 100.`,
  })
  return lines
}

/** Three-point shooting that shouldn't last, on both ends. ``opp_three_luck`` is in a side's points: the
    defense it faces (negative: teams have shot hot from three against that defense); ``own_three_luck`` is
    its own shooting (negative: it has been hot). */
function luckText(b: PregameBox, points: number): string {
  const W = place(b[b.pick])
  const name = { away: place(b.away), home: place(b.home) }
  const bits: string[] = []
  // Against each defense: the other side's opp_three_luck.
  const vs = { away: b.home.parts.opp_three_luck, home: b.away.parts.opp_three_luck }
  const loud = (['away', 'home'] as const).filter((s) => Math.abs(vs[s]) >= 0.5)
  const word = (v: number) => (v < 0 ? 'well' : 'poorly')
  if (loud.length === 2 && Math.sign(vs.away) === Math.sign(vs.home)) {
    const more = Math.abs(vs.away) > Math.abs(vs.home) ? 'away' : 'home'
    bits.push(`Teams have shot unusually ${word(vs.away)} from three against both, more so against ${name[more]}`)
  } else if (loud.length === 2) {
    bits.push(
      `Teams have shot well from three against ${name[vs.away < 0 ? 'away' : 'home']} and poorly against ${name[vs.away < 0 ? 'home' : 'away']}`,
    )
  } else if (loud.length === 1) {
    bits.push(`Teams have shot unusually ${word(vs[loud[0]])} from three against ${name[loud[0]]}`)
  }
  const own = { away: b.away.parts.own_three_luck, home: b.home.parts.own_three_luck }
  const hot = (['away', 'home'] as const).filter((s) => Math.abs(own[s]) >= 0.5)
  const temp = (v: number) => (v < 0 ? 'hot' : 'cold')
  if (hot.length === 2 && Math.sign(own.away) === Math.sign(own.home))
    bits.push(`both have been ${temp(own.away)} from three themselves`)
  else if (hot.length === 2)
    bits.push(`${name.away} has been ${temp(own.away)} from three, ${name.home} ${temp(own.home)}`)
  else if (hot.length === 1) bits.push(`${name[hot[0]]} has been ${temp(own[hot[0]])} from three itself`)
  if (bits.length === 0) return 'Three-point shooting on both ends has been about as expected.'
  const said = bits.map((x, i) => (i === 0 ? x[0].toUpperCase() + x.slice(1) : x)).join(', and ')
  const n = Math.abs(points)
  const close =
    points === 0
      ? 'That tends to even out, and here it roughly cancels.'
      : `That tends to even out, which ${points > 0 ? 'helps' : 'costs'} ${W} about ${n} point${n === 1 ? '' : 's'}.`
  return `${said}. ${close}`
}

/** How games called about this close have actually ended: a few bands of the final margin, from the
    picked side, each with how often (in 100). From every game of five seasons (2021-22 to 2025-26)
    replayed with the shipped call, grouped by the called margin (api scripts/game_score_backtest.py).
    A called margin is the middle of a wide spread: a game called by 3 is decided by 20+ about 1 in 7. */
export interface OutcomeBand {
  label: string
  times: number
  tone: 'win-big' | 'win' | 'close' | 'lose' | 'lose-big'
}

// Called margin (whole points, from the pick) -> how the final margin landed, per 100 games:
// [won by 15+, won by 6-14, within 5 either way, lost by 6-14, lost by 15+], and decided by 20+ either way.
// 5,225 games of 2021-22 to 2025-26 replayed with the shipped call; every season lands within a few of these.
// Keys are the lower edge of each called-margin group (1-3, 4-6, 7-9, 10-13, 14+).
export const OUTCOMES: { from: number; bands: [number, number, number, number, number]; blowout: number }[] = [
  { from: 1, bands: [15, 24, 29, 21, 11], blowout: 14 },
  { from: 4, bands: [23, 29, 26, 15, 7], blowout: 18 },
  { from: 7, bands: [29, 32, 24, 10, 5], blowout: 19 },
  { from: 10, bands: [37, 33, 20, 9, 1], blowout: 26 },
  { from: 14, bands: [50, 30, 13, 6, 1], blowout: 38 },
]

export function outcomes(b: PregameBox): { bands: OutcomeBand[]; blowout: number } {
  const row = [...OUTCOMES].reverse().find((r) => b.margin >= r.from) ?? OUTCOMES[0]
  const W = place(b[b.pick])
  const L = place(b[other(b.pick)])
  const [bigW, w, close, l, bigL] = row.bands
  return {
    bands: [
      { label: `${W} by 15+`, times: bigW, tone: 'win-big' },
      { label: `${W} by 6–14`, times: w, tone: 'win' },
      { label: 'Within 5', times: close, tone: 'close' },
      { label: `${L} by 6–14`, times: l, tone: 'lose' },
      { label: `${L} by 15+`, times: bigL, tone: 'lose-big' },
    ],
    blowout: row.blowout,
  }
}

/** "2h 13m", "45m", "under a minute"; null once it has tipped off. */
export function countdown(start: string, now: number): string | null {
  const mins = Math.floor((Date.parse(start) - now) / 60_000)
  if (mins < 0) return null
  if (mins < 1) return 'under a minute'
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** Lineup news: from 90 minutes before tip-off the NBA's injury report firms up (play chances, api #167);
    from 30 minutes before, lineups are set. */
export function lineupNews(start: string, now: number): { state: 'later' | 'now' | 'set'; from: Date } {
  const tip = Date.parse(start)
  const from = new Date(tip - 90 * 60_000)
  if (now < from.getTime()) return { state: 'later', from }
  if (now < tip - 30 * 60_000) return { state: 'now', from }
  return { state: 'set', from }
}

/** The warm light behind the call: quiet hours out, full at tip-off. Changes by the minute, never animates. */
export function houseLight(start: string, now: number): number {
  const hours = (Date.parse(start) - now) / 3_600_000
  return Math.max(0.35, Math.min(1, 1 - (hours / 6) * 0.65))
}

export const isMine = (p: { owner_team_id: number | null }, teamId: number | null) =>
  teamId != null && p.owner_team_id === teamId

/** Your players and your rival's in this game, on both sides; out ones flagged. */
export function people(b: PregameBox, teamId: number | null, rivalId: number | null) {
  const all = (['away', 'home'] as const).flatMap((s) => [
    ...b[s].players.map((p) => ({ p, side: s, out: false, abbrev: b[s].abbrev })),
    ...b[s].out.map((p) => ({ p, side: s, out: true, abbrev: b[s].abbrev })),
  ])
  return {
    mine: all.filter((x) => isMine(x.p, teamId)),
    rival: all.filter((x) => rivalId != null && x.p.owner_team_id === rivalId),
  }
}

/** Who is out and where their share went: each teammate's points from "Teammates out", biggest first. */
export function outShare(side: PregameSide): { share: number | null; gains: { name: string; pts: number }[] } {
  let share: number | null = null
  const gains: { name: string; pts: number }[] = []
  for (const p of side.players) {
    const r = (p.line.reasons ?? []).find((x) => x.kind === 'teammates_out')
    if (!r) continue
    const m = /(\d+) points a game/.exec(r.text)
    if (m && share == null) share = Number(m[1])
    if (r.pts >= 0.5) gains.push({ name: lastName(p.name), pts: Math.round(r.pts) })
  }
  gains.sort((a, c) => c.pts - a.pts)
  return { share, gains: gains.slice(0, 4) }
}

export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const tail = parts[parts.length - 1]
  return /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(tail) && parts.length > 2 ? `${parts[parts.length - 2]} ${tail}` : tail
}

export function initial(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}

/** The team line under the table and the words behind "Why the gap?". */
export function teamLine(side: PregameSide) {
  const t = side.team_line
  const minutes = side.players.reduce((s, p) => s + p.line.minutes, 0)
  const moved = side.players.reduce(
    (s, p) => s + Math.max(0, (p.line.reasons ?? []).find((r) => r.kind === 'teammates_out')?.pts ?? 0),
    0,
  )
  const gap = Math.round(t.gap * 10) / 10
  const T = place(side)
  const why: string[] = []
  if (Math.abs(gap) < 3) {
    why.push(`Close: these lines and the rest of the team come within ${Math.abs(gap).toFixed(1)} of Our call.`)
  } else if (gap > 0) {
    if (minutes > 245)
      why.push(
        `Each line expects that player's usual minutes, and together they come to ${Math.round(minutes)}, more than the 240 a game has. We're testing a fix that fits them to 240.`,
      )
    if (moved >= 5 && side.out.length) {
      const { share } = outShare(side)
      const many = side.out.length > 1
      why.push(
        `${side.out.map((o) => lastName(o.name)).join(', ')} ${many ? 'are' : 'is'} out${share != null ? `, ${many ? 'they score' : 'he scores'} ${share} a game` : ''}, and these lines picked up ${Math.round(moved)} points between them. Our call for the team doesn't move for absences: that didn't make team scores more accurate when we tested it.`,
      )
    }
    if (why.length === 0) why.push(`These lines add up to ${gap.toFixed(1)} more than Our call for ${T}.`)
  } else {
    why.push(
      `Our call has ${T} at ${side.call}, above what these lines add up to. Each line starts from the player's usual night and leans only part of the way toward Our call.`,
    )
  }
  why.push(`For the team, go by ${side.call}. For a player, go by his line.`)
  return { ...t, gap, minutes: Math.round(minutes), listed: side.players.length, why }
}

/** The columns of a player's why, in the box's order. */
export const WHY_COLS = ['minutes', 'fg_pct', 'ft_pct', 'three_pm', 'reb', 'ast', 'stl', 'blk', 'to', 'pts'] as const
export type WhyCol = (typeof WHY_COLS)[number]

export interface WhyStep {
  label: string
  kind: 'usual' | 'reason' | 'lean' | 'tonight'
  values: Record<WhyCol, number>
}

const pctOf = (made: number, att: number, fallback: number | null | undefined) =>
  att > 0 ? made / att : (fallback ?? 0)

/** His usual line, each reason, what the lean toward Our call (and rounding) leaves, then tonight: one
    decimal (FG%/FT% three), and every column adds up exactly as shown. */
export function whySteps(line: PregameLine): WhyStep[] {
  const usual: PregameStats = line.usual ?? line
  const round = (k: WhyCol, v: number) =>
    k === 'fg_pct' || k === 'ft_pct' ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10
  const valuesOf = (s: PregameStats): Record<WhyCol, number> => ({
    minutes: round('minutes', s.minutes),
    fg_pct: round('fg_pct', pctOf(s.fgm, s.fga, s.fg_pct)),
    ft_pct: round('ft_pct', pctOf(s.ftm, s.fta, s.ft_pct)),
    three_pm: round('three_pm', s.three_pm),
    reb: round('reb', s.reb),
    ast: round('ast', s.ast),
    stl: round('stl', s.stl),
    blk: round('blk', s.blk),
    to: round('to', s.to),
    pts: round('pts', s.pts),
  })
  const start = valuesOf(usual)
  const end = valuesOf(line)
  const reasons = (line.reasons ?? []).map((r) => ({
    label: r.text,
    kind: 'reason' as const,
    values: {
      minutes: round('minutes', r.minutes),
      fg_pct: round('fg_pct', r.fg_pct),
      ft_pct: 0,
      three_pm: round('three_pm', r.three_pm),
      reb: round('reb', r.reb),
      ast: round('ast', r.ast),
      stl: round('stl', r.stl),
      blk: round('blk', r.blk),
      to: round('to', r.to),
      pts: round('pts', r.pts),
    },
  }))
  const lean = {} as Record<WhyCol, number>
  for (const k of WHY_COLS) {
    const moved = reasons.reduce((s, r) => s + r.values[k], 0)
    lean[k] = round(k, end[k] - start[k] - moved)
  }
  return [
    { label: 'His usual line', kind: 'usual', values: start },
    ...reasons,
    { label: 'Leans toward Our call (and rounding)', kind: 'lean', values: lean },
    { label: 'Tonight, our estimate', kind: 'tonight', values: end },
  ]
}

/** A step's value as shown: usual and tonight plain, changes signed; zero changes as a dot. */
export function stepText(k: WhyCol, v: number, change: boolean): string {
  const pct = k === 'fg_pct' || k === 'ft_pct'
  if (change && v === 0) return '·'
  const body = pct ? Math.abs(v).toFixed(3).replace(/^0/, '') : Math.abs(v).toFixed(1)
  if (!change) return pct ? (v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, '')) : v.toFixed(1)
  return `${v > 0 ? '+' : '−'}${body}`
}

/** The biggest reason that isn't shared by every teammate, for the row's second line. */
export function rowNote(p: PregamePlayer, side: PregameSide): string {
  const everyone = new Set(
    (side.players[0]?.line.reasons ?? [])
      .map((r) => r.kind)
      .filter((k) => side.players.every((q) => (q.line.reasons ?? []).some((r) => r.kind === k))),
  )
  const r = (p.line.reasons ?? []).find((x) => !everyone.has(x.kind) && Math.round(Math.abs(x.pts)) >= 1)
  if (!r) return 'Near his usual night'
  return `${r.text} · ${signed(Math.round(r.pts))} pts`
}

/** The starting five by minutes until lineups are out, then the bench. */
export function splitRotation(players: PregamePlayer[]): { starters: PregamePlayer[]; bench: PregamePlayer[] } {
  const sorted = [...players].sort((a, c) => c.line.minutes - a.line.minutes)
  return { starters: sorted.slice(0, 5), bench: sorted.slice(5) }
}

export { signed }
