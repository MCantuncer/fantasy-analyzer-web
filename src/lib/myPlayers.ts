import type { Game, GameLine, LineupSpot, NextGame, PlayChance } from '../api/client'

/**
 * What one of your players is doing on the day on screen:
 * - live: his game is on (``line`` is null until he checks in)
 * - final: his game is over and he played
 * - dnp: his game is over and he never got on the floor
 * - later: his game hasn't started
 * - idle: his team has no game that day
 */
export type RowState = 'live' | 'final' | 'dnp' | 'later' | 'idle'

export interface PlayerRow {
  spot: LineupSpot
  game: Game | null
  line: GameLine | null
  state: RowState
}

/** One row per player, in ESPN's lineup order (the server sends starting slots, then BE, then IR). */
export function buildRows(spots: LineupSpot[], games: Game[]): PlayerRow[] {
  const byId = new Map(games.map((g) => [g.id, g]))
  return spots.map((spot) => {
    const game = spot.game_id != null ? (byId.get(spot.game_id) ?? null) : null
    const line = game?.lines.find((l) => l.player_id === spot.player_id) ?? null
    const state: RowState = !game
      ? 'idle'
      : game.status === 'scheduled'
        ? 'later'
        : game.status === 'live'
          ? 'live'
          : line
            ? 'final'
            : 'dnp'
    return { spot, game, line, state }
  })
}

export const isBench = (s: LineupSpot) => s.slot === 'BE'
export const isIR = (s: LineupSpot) => s.slot === 'IR'

export interface Counts {
  /** Starting slots whose player has a game that day. */
  playing: number
  starters: number
  live: number
  final: number
  later: number
  idle: number
  /** Bench players with a game that day (their lines count for nothing). */
  benchPlaying: number
}

export function counts(rows: PlayerRow[], openSlots: number): Counts {
  const starting = rows.filter((r) => r.spot.starting)
  const n = (s: RowState) => starting.filter((r) => r.state === s).length
  return {
    playing: starting.filter((r) => r.state !== 'idle').length,
    starters: starting.length + openSlots,
    live: n('live'),
    final: n('final') + n('dnp'),
    later: n('later'),
    idle: n('idle') + openSlots,
    benchPlaying: rows.filter((r) => isBench(r.spot) && r.state !== 'idle').length,
  }
}

export interface Totals {
  played: number
  on: number
  min: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  tpm: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pts: number
}

/** What counts so far: the lines of players in starting slots only. */
export function starterTotals(rows: PlayerRow[]): Totals {
  const t: Totals = { played: 0, on: 0, min: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, tpm: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pts: 0 }
  for (const r of rows) {
    if (!r.spot.starting || !r.line) continue
    const l = r.line
    t.played += 1
    if (r.state === 'live') t.on += 1
    t.min += l.minutes
    t.fgm += l.fgm
    t.fga += l.fga
    t.ftm += l.ftm
    t.fta += l.fta
    t.tpm += l.tpm
    t.reb += l.reb
    t.ast += l.ast
    t.stl += l.stl
    t.blk += l.blk
    t.to += l.to
    t.pts += l.pts
  }
  return t
}

export interface Swap {
  /** The bench player whose game is still to come. */
  bench: PlayerRow
  /** The starting slot he fits that has nobody playing in it. */
  slot: string
  /** Who sits in that slot with no game, if anyone (an empty slot has nobody). */
  idle: PlayerRow | null
}

const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/**
 * A lineup fix you can still make: a bench player whose game hasn't tipped, who fits a starting
 * slot that has no game (or nobody) in it. Only the first one: the note is a nudge, not a list.
 */
export function swapToMake(rows: PlayerRow[], openSlots: string[]): Swap | null {
  const holes: { slot: string; idle: PlayerRow | null }[] = [
    ...rows.filter((r) => r.spot.starting && r.state === 'idle').map((r) => ({ slot: r.spot.slot, idle: r })),
    ...openSlots.map((slot) => ({ slot, idle: null })),
  ]
  if (!holes.length) return null
  for (const bench of rows) {
    if (!isBench(bench.spot) || bench.state !== 'later' || OUT.has(bench.spot.injury_status)) continue
    const hole = holes.find((h) => (bench.spot.eligible ?? []).includes(h.slot))
    if (hole) return { bench, ...hole }
  }
  return null
}

/** "Thompson's 19 pts sat on your bench": the best bench line of a finished day, when it beat nothing. */
export function benchLeftOut(rows: PlayerRow[]): PlayerRow | null {
  const idle = rows.some((r) => r.spot.starting && (r.state === 'idle' || r.state === 'dnp'))
  if (!idle) return null
  const bench = rows.filter((r) => isBench(r.spot) && r.line && r.line.minutes > 0)
  return bench.sort((a, b) => b.line!.pts - a.line!.pts)[0] ?? null
}

export function lastName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}

/** ESPN's own team page, where the lineup is set. ESPN has no link straight to a day's lineup. */
export function espnTeamUrl(leagueId: number, teamId: number, season: number): string {
  return `https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${teamId}&seasonId=${season}`
}

/** "in 2h 10m", "in 40m", "any minute": the time left to a tip-off. ``soon`` inside the last hour. */
export function countdown(startIso: string, now: number): { text: string; soon: boolean } {
  const mins = Math.ceil((new Date(startIso).getTime() - now) / 60_000)
  if (mins <= 0) return { text: 'any minute', soon: true }
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { text: h > 0 ? `in ${h}h${m ? ` ${m}m` : ''}` : `in ${m}m`, soon: mins <= 60 }
}

/** The weekday of an ESPN day ("Wed"), on the US date as the day picker shows it. */
export function weekday(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

/** "Wed @ IND" / "Wed vs BKN": where his team plays next. */
export function nextLabel(g: NextGame): string {
  return `${weekday(g.date)} ${g.home ? 'vs' : '@'} ${g.opponent.abbrev}`
}

/** His team's games left this week after the day on screen. */
export function gamesLeft(spot: LineupSpot, day: number): number {
  return (spot.week_games ?? []).filter((d) => d > day).length
}

/* ---------- Game-time call ---------- */

/** The tag as the NBA injury report writes it, never wider than ESPN's "DTD". */
export const PLAY_TAG: Record<PlayChance['tag'], string> = {
  Probable: 'P',
  Questionable: 'Q',
  Doubtful: 'D',
  Available: 'A',
  Out: 'OUT',
  'Day-to-day': 'DTD',
}

/** How a chance reads: calm (likely plays), toss (a real doubt), low (likely sits), up (coming back). */
export type PlayTone = 'calm' | 'toss' | 'low' | 'up'

export function playTone(p: PlayChance): PlayTone {
  if (p.upgraded) return 'up'
  if (p.chance >= 0.8) return 'calm'
  if (p.chance >= 0.3) return 'toss'
  return 'low'
}

/** "55%": whole numbers, never "0.55" or "55.0%". */
export const pct = (c: number) => `${Math.round(c * 100)}%`

/** How a bench player gets into a starter's slot: straight in, or with one starter sliding over. */
export interface Fill {
  sub: PlayerRow
  /** The slot the bench player takes. */
  slot: string
  /** A starter who moves into the doubtful player's slot to make room, if the sub doesn't fit it. */
  slide: PlayerRow | null
}

/** Can ``sub`` cover ``out``? Straight into his slot, or one unlocked starter slides over. */
export function fillFor(sub: PlayerRow, out: PlayerRow, rows: PlayerRow[]): Fill | null {
  const elig = sub.spot.eligible ?? []
  if (elig.includes(out.spot.slot)) return { sub, slot: out.spot.slot, slide: null }
  const sliders = rows.filter(
    (r) =>
      r.spot.starting &&
      r !== out &&
      r.state === 'later' &&
      elig.includes(r.spot.slot) &&
      (r.spot.eligible ?? []).includes(out.spot.slot),
  )
  // A healthy slider first: moving a doubt around is a second worry.
  const slide = sliders.sort((a, b) => (b.spot.play?.chance ?? 1) - (a.spot.play?.chance ?? 1))[0]
  return slide ? { sub, slot: slide.spot.slot, slide } : null
}

const HOUR = 3_600_000
const at = (iso: string) => new Date(iso).getTime()

export interface GameCall {
  /** The starter in doubt. */
  doubt: PlayerRow
  play: PlayChance
  tip: number
  /** When the final word usually lands: 30 to 90 minutes before his tip (9 in 10 of the questionable
   * players who got a final word, NBA injury reports 2022-23 to 2025-26). */
  wordFrom: number
  wordTo: number
  /** Who steps in if he is ruled out. */
  fill: Fill | null
  /** The sub tips after the word lands, so waiting costs nothing. */
  free: boolean
  /** If he plays after all: where the sub goes instead (another doubt, by the sub's tip). */
  planB: { row: PlayerRow; fill: Fill } | null
  /** wait: leave him in, check the word. now: the sub locks first, decide now. keep: nobody to swap in. */
  verdict: 'wait' | 'now' | 'keep'
}

const BENCHED = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/**
 * The night's one game-time call: the starter whose doubt is a real decision, the bench player
 * who can step in, and whether waiting for the final word is free (the sub tips after it lands).
 * One call, not a list: the rest of the doubts are marks on their rows.
 */
export function gameTimeCall(rows: PlayerRow[]): GameCall | null {
  const doubts = rows
    .filter((r) => r.spot.starting && r.state === 'later' && r.game && r.spot.play && r.spot.play.chance < 0.8)
    .sort((a, b) => a.spot.play!.chance - b.spot.play!.chance)
  if (!doubts.length) return null
  const subs = rows.filter(
    (r) =>
      isBench(r.spot) &&
      r.state === 'later' &&
      r.game &&
      !BENCHED.has(r.spot.injury_status) &&
      (r.spot.play?.chance ?? 1) >= 0.8,
  )
  const build = (doubt: PlayerRow): GameCall => {
    const tip = at(doubt.game!.start)
    const wordFrom = tip - 1.5 * HOUR
    const wordTo = tip - HOUR / 2
    let fill: Fill | null = null
    for (const s of subs) {
      fill = fillFor(s, doubt, rows)
      if (fill) break
    }
    const free = !!fill && at(fill.sub.game!.start) > wordTo
    let planB: GameCall['planB'] = null
    if (fill && free) {
      // If he plays, the sub is still free: the likeliest hole that he can fill by his own tip.
      for (const other of doubts) {
        if (other === doubt || other.spot.play!.chance >= 0.3) continue
        const f = fillFor(fill.sub, other, rows)
        if (f && !(f.slide && f.slide === doubt)) {
          planB = { row: other, fill: f }
          break
        }
      }
    }
    return {
      doubt,
      play: doubt.spot.play!,
      tip,
      wordFrom,
      wordTo,
      fill,
      free,
      planB,
      // 10% or less (or ruled out): swap now, the word won't save him.
      verdict: !fill ? 'keep' : free && doubt.spot.play!.chance > 0.1 ? 'wait' : 'now',
    }
  }
  // A real call is a toss-up (10% to 80%) with someone to swap in and time to wait for the word.
  // When the sub locks first, the call is "decide now", and the likeliest-out starter gets him.
  // Nobody to swap in: no card, the rows say it.
  // Ruled out comes first: an empty slot is a sure loss, waiting can't save it.
  const calls = doubts.map(build).filter((c) => c.fill)
  return (
    calls.find((c) => c.play.chance === 0) ??
    calls.find((c) => c.play.chance > 0.1 && c.free) ??
    calls[0] ??
    null
  )
}

/** In the word window: the final word on him usually lands now, so the call opens itself. */
export const inWordWindow = (call: GameCall, now: number) => now >= call.wordFrom && now < call.tip

/** Past the window with the tag unchanged: the word is late, and the sub's lock is the deadline. */
export const wordLate = (call: GameCall, now: number) => now >= call.wordTo && now < call.tip

/**
 * Line 2 of a doubtful starter's row, verb first ("Leave in", "Swap now"), and the short reason
 * that goes with it. The bench player is claimed once a night: the call's doubt gets the verb,
 * the plan-B row waits on the call, every other doubt is left in and told who the sub covers.
 * Null for a probable starter (his row just says "94% to play"), the bench and IR.
 */
export interface RowCall {
  verb: string | null
  why: string | null
  /** Desktop's longer reason, when there's room for it ("Gafford's on Thompson"). */
  whyWide?: string
}

export function rowCall(row: PlayerRow, call: GameCall | null): RowCall | null {
  const p = row.spot.play
  if (!p || p.tag === 'Available' || !row.spot.starting || row.state !== 'later') return null
  const sub = call?.fill ? lastName(call.fill.sub.spot.name) : null
  if (call && call.doubt === row) {
    if (call.verdict === 'wait') return { verb: 'Leave in', why: `${sub} covers` }
    if (call.verdict === 'now')
      // The tray's strip under the row says why (the sub locks first), so the row doesn't.
      return { verb: p.chance < 0.3 ? 'Swap now' : 'Decide now', why: p.chance === 0 ? 'ruled out tonight' : null }
  }
  if (call?.planB?.row === row) return { verb: `Swap if ${lastName(call.doubt.spot.name)} plays`, why: null }
  if (p.chance === 0) return { verb: null, why: 'Ruled out tonight' }
  if (p.chance >= 0.8) return null
  // The sub is claimed by the call: no verb to offer, only why there's no swap.
  if (call && sub) return { verb: null, why: 'no sub left', whyWide: `${sub}'s on ${lastName(call.doubt.spot.name)}` }
  return { verb: 'Leave in', why: 'no sub plays' }
}

const TAG_PLAYERS: Record<PlayChance['tag'], string> = {
  Probable: 'probable players',
  Questionable: 'questionable players',
  Doubtful: 'doubtful players',
  Available: 'available players',
  Out: 'regulars out that long',
  'Day-to-day': 'day-to-day players',
}

/**
 * What the number is, in one short line: "55% of questionable players like him played". The long
 * form (the tag's timing, the seasons, the minutes cut) stays in ``basis``. Null when ruled out.
 */
export function basisShort(p: PlayChance, brief = false): string | null {
  if (p.chance === 0) return null
  const n = pct(p.chance)
  if (p.tag === 'Out') return `${n} of ${TAG_PLAYERS.Out} played the next one`
  return `${n} of ${TAG_PLAYERS[p.tag]}${brief ? '' : ' like him'} played`
}

/** "news 3h ago", "no word yet": how fresh the word on him is. */
export function newsAge(p: PlayChance, now: number): string {
  if (!p.news || !p.news_at) return 'no word yet'
  const h = Math.floor((now - new Date(p.news_at).getTime()) / HOUR)
  return h < 1 ? 'news just now' : h < 48 ? `news ${h}h ago` : `news ${Math.floor(h / 24)}d ago`
}
