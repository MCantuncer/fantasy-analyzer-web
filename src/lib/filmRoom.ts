import { CATEGORY_ORDER } from './statOrder'
import type { RecapAfter, RecapFreeAgent, RecapMatchup, RecapPlayer, RecapSide, WeekRecap } from '../api/client'

/** ESPN's NBA team ids (``pro_team_id``) and the abbreviations ESPN writes, from its NBA calendar. */
const NBA: Record<number, string> = {
  1: 'ATL', 2: 'BOS', 3: 'NO', 4: 'CHI', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GS', 10: 'HOU',
  11: 'IND', 12: 'LAC', 13: 'LAL', 14: 'MIA', 15: 'MIL', 16: 'MIN', 17: 'BKN', 18: 'NY', 19: 'ORL', 20: 'PHI',
  21: 'PHX', 22: 'POR', 23: 'SAC', 24: 'SA', 25: 'OKC', 26: 'UTAH', 27: 'WSH', 28: 'TOR', 29: 'MEM', 30: 'CHA',
}

export const nbaAbbrev = (proTeamId: number): string | null => NBA[proTeamId] ?? null

/** Categories follow the site's one stat order (lib/statOrder). */
export const CATS = CATEGORY_ORDER

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const dayName = (weekday: number) => DAYS[weekday] ?? ''

export const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

export const perGame = (p: Pick<RecapPlayer, 'games' | 'totals'>, key: keyof RecapPlayer['totals']) =>
  p.totals[key] / Math.max(1, p.games)

/** "Oct 26" from "2026-10-26", read as a calendar date (no time zone shift). */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function weekDates(r: Pick<WeekRecap, 'start' | 'end'>): string {
  return [shortDay(r.start), shortDay(r.end)].filter(Boolean).join(' – ')
}

const lowerIsBetter = (cat: string) => cat === 'TO'
const isPct = (cat: string) => cat.endsWith('%')

/** ".747" for shooting, a whole number for the rest. */
export function catValue(cat: string, v: number): string {
  if (isPct(cat)) return v >= 1 ? '1.000' : v.toFixed(3).replace(/^0(?=\.)/, '')
  return String(Math.round(v))
}

export interface Closest {
  cat: string
  winner: RecapSide
  loser: RecapSide
  /** The gap as a share of the larger value: how close it came. */
  rel: number
}

export interface Matchup {
  raw: RecapMatchup
  /** Winner first; home first on a tie. */
  sides: [RecapSide, RecapSide]
  winner: RecapSide | null
  margin: number
  closest: Closest | null
  /** The closest category went to the winner of a 5-4: it decided the week. */
  decided: boolean
}

// A category counts as "by a hair" when the gap is under 2% of the larger side.
export const HAIR = 0.02

export function readMatchup(m: RecapMatchup): Matchup {
  const { home, away } = m
  const winner = m.winner_team_id === home.team_id ? home : m.winner_team_id === away.team_id ? away : null
  const sides: [RecapSide, RecapSide] = winner === away ? [away, home] : [home, away]
  let closest: Closest | null = null
  for (const cat of CATS) {
    const a = home.values[cat]
    const b = away.values[cat]
    if (a == null || b == null || a === b) continue
    const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
    if (closest && rel >= closest.rel) continue
    const homeWins = lowerIsBetter(cat) ? a < b : a > b
    closest = { cat, rel, winner: homeWins ? home : away, loser: homeWins ? away : home }
  }
  const margin = winner ? sides[0].wins - sides[1].wins : 0
  const decided = !!(winner && closest && closest.winner === winner && margin === 1)
  return { raw: m, sides, winner, margin, closest, decided }
}

/** The gap in a close category: ".001" for shooting, "2" for counting stats. */
export function gap(c: Closest): string {
  const d = Math.abs(c.winner.values[c.cat] - c.loser.values[c.cat])
  if (isPct(c.cat)) return '.' + String(Math.max(1, Math.round(d * 1000))).padStart(3, '0')
  return String(Math.round(d))
}

export function sideResult(me: RecapSide, them: RecapSide, cat: string): 'W' | 'L' | 'T' {
  const a = me.values[cat]
  const b = them.values[cat]
  if (a === b) return 'T'
  return (lowerIsBetter(cat) ? a < b : a > b) ? 'W' : 'L'
}

/** "3 games for them: 29 PTS, 29 REB". What a pickup did for the team that added him, never his week rank. */
export function afterLine(after: RecapAfter | null | undefined, mine: boolean, long = false): string {
  if (!after) return ''
  const who = mine ? 'you' : 'them'
  if (!after.games) return `No games for ${who} yet`
  const t = after.totals
  const bits: [string, number][] = (
    [
      ['PTS', t.pts],
      ['REB', t.reb],
      ['AST', t.ast],
      ['3PM', t.tpm],
      ['STL', t.stl],
      ['BLK', t.blk],
    ] as [string, number][]
  ).filter(([, v]) => v > 0)
  const top = long ? bits.slice(0, 3) : bits.filter(([k]) => k === 'PTS' || k === 'REB')
  const bench = after.started === 0 ? ', on the bench' : ''
  return `${games(after.games)} for ${who}${bench}${top.length ? ': ' + top.map(([k, v]) => `${v} ${k}`).join(', ') : ''}`
}

export interface Pickup extends RecapPlayer {
  by: number
  weekday: number
  after: RecapAfter
}

export interface FilmRoomData {
  matchups: Matchup[]
  mine: Matchup | null
  /** The biggest win of the week (Team of the Week). */
  topWin: Matchup | null
  /** Matchups won 5-4 (or by one category). */
  oneCat: number
  freeNow: RecapFreeAgent[]
  taken: RecapFreeAgent[]
  /** The add who did the most for his new team (ranked on ``after.value``, which is never shown). */
  topPickup: Pickup | null
  myAdds: Pickup[]
  /** The best free agent another team grabbed during the week. */
  miss: RecapFreeAgent | null
}

export function readRecap(r: WeekRecap, myTeamId: number | null): FilmRoomData {
  const matchups = r.matchups.map(readMatchup)
  const mine =
    myTeamId == null ? null : (matchups.find((m) => m.sides.some((s) => s.team_id === myTeamId)) ?? null)
  const topWin = [...matchups].filter((m) => m.winner).sort((a, b) => b.margin - a.margin)[0] ?? null
  const fas = [...r.free_agents].sort((a, b) => a.rank - b.rank)
  const pickups: Pickup[] = r.teams
    .filter((t) => t.best_add && t.best_add.after.games > 0)
    .map((t) => ({ ...t.best_add!, by: t.team_id }))
    .sort((a, b) => b.after.value - a.after.value || b.after.games - a.after.games)
  const myAdds: Pickup[] = []
  const myTeam = r.teams.find((t) => t.team_id === myTeamId)
  if (myTeam?.best_add) myAdds.push({ ...myTeam.best_add, by: myTeam.team_id })
  for (const p of fas) {
    if (p.picked_up && p.picked_up.team_id === myTeamId && !myAdds.some((a) => a.player_id === p.player_id))
      myAdds.push({ ...p, by: p.picked_up.team_id, weekday: p.picked_up.weekday, after: p.picked_up.after })
  }
  myAdds.sort((a, b) => b.after.games - a.after.games)
  return {
    matchups,
    mine,
    topWin,
    oneCat: matchups.filter((m) => m.winner && m.margin === 1).length,
    freeNow: fas.filter((p) => p.owner_now_team_id == null),
    taken: fas.filter((p) => p.owner_now_team_id != null),
    topPickup: pickups[0] ?? null,
    myAdds,
    miss: myTeamId == null ? null : (fas.find((p) => p.picked_up && p.picked_up.team_id !== myTeamId) ?? null),
  }
}

/** The categories a player stood out in, best first (turnovers left out), as per-game values. */
export function bestCats(p: RecapPlayer, n: number): { cat: string; value: string }[] {
  const KEY: Record<string, keyof RecapPlayer['totals']> = {
    PTS: 'pts', REB: 'reb', AST: 'ast', STL: 'stl', BLK: 'blk', '3PM': 'tpm',
  }
  return Object.entries(p.z)
    .filter(([cat]) => cat !== 'TO')
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([cat]) => {
      if (cat === 'FG%') return { cat, value: catValue(cat, p.totals.fga ? p.totals.fgm / p.totals.fga : 0) }
      if (cat === 'FT%') return { cat, value: catValue(cat, p.totals.fta ? p.totals.ftm / p.totals.fta : 0) }
      return { cat, value: perGame(p, KEY[cat]).toFixed(1) }
    })
}

/** "V. Wembanyama" for tight table cells. */
export const shortName = (name: string) => name.replace(/^(\S)\S*\s/, '$1. ')

/** The Film Room card shows on the League tab for three days after a week ends (Monday to Wednesday). */
export function isFresh(end: string | null | undefined, now: Date): boolean {
  if (!end) return false
  const ended = new Date(`${end}T12:00:00Z`).getTime()
  const days = (now.getTime() - ended) / 86_400_000
  return days >= 0 && days < 3.5
}

const TOTAL_KEYS: Record<string, keyof RecapPlayer['totals']> = {
  PTS: 'pts', REB: 'reb', AST: 'ast', STL: 'stl', BLK: 'blk', '3PM': 'tpm',
}

/** His best counting category over the week: "13 BLK, 3 G". */
export function bestTotal(p: RecapPlayer): string {
  const cat = Object.keys(TOTAL_KEYS).sort((a, b) => (p.z[b] ?? 0) - (p.z[a] ?? 0))[0]
  return `${p.totals[TOTAL_KEYS[cat]]} ${cat}, ${p.games} G`
}

// ---- Sharing game balls to League Chat ----

/** A League Chat post that shares a week's game balls starts with this line; chat shows it as a card. */
const FILM_POST = /^🎬 Week (\d{1,2}) Film Room\b/u
const POST_MAX = 500

export function filmPostPeriod(body: string): number | null {
  const m = FILM_POST.exec(body)
  return m ? Number(m[1]) : null
}

/** What follows the shared line: the poster's own words, if any. */
export function filmPostNote(body: string): string {
  const i = body.indexOf('\n')
  return i < 0 ? '' : body.slice(i + 1).trim()
}

/** The post text, readable on its own: "🎬 Week 2 Film Room. Game balls: ...", then the note. */
export function gameBallsPost(r: WeekRecap, d: FilmRoomData, name: (id: number) => string, note = ''): string {
  const balls: string[] = []
  const p = r.players[0]
  if (p) balls.push(`${p.name} (${bestTotal(p)}${p.owner_team_id != null ? `, ${name(p.owner_team_id)}` : ''})`)
  const tw = d.topWin
  if (tw) balls.push(`${name(tw.sides[0].team_id)} (${tw.sides[0].wins}–${tw.sides[1].wins} over ${name(tw.sides[1].team_id)})`)
  const tp = d.topPickup
  if (tp) balls.push(`${tp.name} (pickup, ${games(tp.after.games)} for ${name(tp.by)})`)
  const head = `🎬 Week ${r.period} Film Room.${balls.length ? ` Game balls: ${balls.join(', ')}.` : ''}`
  const clean = note.trim()
  if (!clean) return head.slice(0, POST_MAX)
  return `${head}\n${clean}`.slice(0, POST_MAX)
}

/** Room left for the poster's own line. */
export const noteRoom = (head: string) => Math.max(0, POST_MAX - head.length - 1)

// ---- The "new tape" dot: the last week this browser opened in the Film Room, per league ----

const seenKey = (leagueId: number, season: number | null) => `film-seen:${leagueId}:${season ?? ''}`

export function seenWeek(leagueId: number, season: number | null): number {
  try {
    return Number(localStorage.getItem(seenKey(leagueId, season))) || 0
  } catch {
    return 0
  }
}

export function markWeekSeen(leagueId: number, season: number | null, period: number): void {
  try {
    if (period > seenWeek(leagueId, season)) localStorage.setItem(seenKey(leagueId, season), String(period))
  } catch {
    // storage blocked: the dot just stays
  }
}
