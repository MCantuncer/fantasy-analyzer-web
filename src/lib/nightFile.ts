// Night File (Can 2026-11-24, "Player/Team Search on Our Estimates"): type a player or a team and see
// everything this page knows about them tonight in one place. Every number here comes from the rows the
// page itself renders (linesOf, couponsOf, whyNot, ranked), so the file never says something the page
// doesn't: a tile's bet is the row's own barem, a count is the length of the list it counts.
import type { IndexedPlayer } from '../api/client'
import { couponsOf, whyNot } from './coupons'
import type { CouponKind, CouponSlot, Leg } from './coupons'
import { PICK_KINDS } from './gameStage'
import { PLAYER_STATS, ranked } from './iddaaCompare'
import type { BookCompare, CompareEstimate, CompareGame, Line } from './iddaaCompare'
import { buildIndex, search, type Mark } from './playerSearch'
import { searchTeams, teamByAbbrev, type NbaTeam } from './teamSearch'

/** A player on tonight's games: his priced lines (may be none) and our estimate (may be missing). */
export interface NightPlayer {
  id: number // ESPN id, 0 when the server has none
  name: string
  team: string
  game: CompareGame
  lines: Line[] // his player lines, in the site's stat order
  est: CompareEstimate | null
}

/** A team on tonight's games. */
export interface NightTeam {
  team: NbaTeam
  abbrev: string
  game: CompareGame
}

/** Something the search can open. */
export type Result =
  | { kind: 'player'; player: NightPlayer; marks: Mark[] }
  | { kind: 'team'; team: NightTeam; marks: Mark[] }
  | { kind: 'off-player'; player: IndexedPlayer; marks: Mark[] }
  | { kind: 'off-team'; team: NbaTeam; marks: Mark[] }

const statRank = (l: Line) => PLAYER_STATS.indexOf(l.stat)
const keyOf = (id: number | null | undefined, name: string, game: number) =>
  id && id > 0 ? `id:${id}` : `n:${name}:${game}`

/** Tonight's players (anyone with a line or an estimate) and teams, in tip order. */
export function nightPool(data: BookCompare, lines: Line[]): { players: NightPlayer[]; teams: NightTeam[] } {
  const players = new Map<string, NightPlayer>()
  const games = [...data.games].sort((a, b) => a.tip.localeCompare(b.tip))
  for (const g of games) {
    for (const l of lines) {
      if (l.kind !== 'player' || l.game.game_id !== g.game_id) continue
      const k = keyOf(l.playerId, l.name, g.game_id)
      const had = players.get(k)
      if (had) had.lines.push(l)
      else players.set(k, { id: l.playerId ?? 0, name: l.name, team: l.team, game: g, lines: [l], est: null })
    }
    for (const e of g.estimates ?? []) {
      const k = keyOf(e.player_id, e.name, g.game_id)
      const had = players.get(k)
      if (had) had.est = e
      else players.set(k, { id: e.player_id, name: e.name, team: e.team, game: g, lines: [], est: e })
    }
  }
  for (const p of players.values()) p.lines.sort((a, b) => statRank(a) - statRank(b))
  const teams: NightTeam[] = []
  for (const g of games)
    for (const abbrev of [g.away, g.home]) {
      const team = teamByAbbrev(abbrev)
      if (team && !teams.some((t) => t.abbrev === abbrev)) teams.push({ team, abbrev, game: g })
    }
  return { players: [...players.values()], teams }
}

/** The results for what was typed: tonight's teams and players first, then "Not on tonight" (teams
 *  without a game, and players from the full index when there is one). */
export function searchNight(
  pool: { players: NightPlayer[]; teams: NightTeam[] },
  query: string,
  index: IndexedPlayer[] | null = null,
): { tonight: Result[]; off: Result[] } {
  const q = query.trim()
  if (!q) return { tonight: [], off: [] }
  // tonight's players through the header search's own matcher: priced players rank first on ties
  const asIndexed = pool.players.map((p, i) => ({
    player_id: p.id > 0 ? p.id : -(i + 1),
    name: p.name,
    pro_team: p.team,
    position: '',
    percent_owned: p.lines.filter((l) => l.barem).length * 10 + p.lines.length,
    owner_team_id: null,
    on_roster: true,
  }))
  const byId = new Map(asIndexed.map((x, i) => [x.player_id, pool.players[i]]))
  const players: Result[] = search(buildIndex(asIndexed), q, 6).map((h) => ({
    kind: 'player',
    player: byId.get(h.player.player_id)!,
    marks: h.marks,
  }))
  const teamHits = searchTeams(q, 4)
  const teams: Result[] = []
  const offTeams: Result[] = []
  for (const h of teamHits) {
    const t = pool.teams.find((x) => x.abbrev === h.team.abbrev)
    if (t) teams.push({ kind: 'team', team: t, marks: h.marks })
    else offTeams.push({ kind: 'off-team', team: h.team, marks: h.marks })
  }
  const tonightIds = new Set(pool.players.map((p) => p.id).filter((id) => id > 0))
  const offPlayers: Result[] = index
    ? search(
        buildIndex(index.filter((p) => !tonightIds.has(p.player_id) && (p.on_roster ?? true))),
        q,
        players.length ? 2 : 4,
      ).map((h) => ({ kind: 'off-player', player: h.player, marks: h.marks }))
    : []
  return { tonight: [...teams, ...players], off: [...offTeams, ...offPlayers] }
}

/** Where a line sits in "Where we and the book disagree" with every game and stat shown: its rank
 *  among ours above the book, or "level" when it is behind the fold (ours level with or below). */
export type Place = { rank: number } | 'level' | null

export function placesOf(lines: Line[]): Map<string, Place> {
  const pool = lines.filter((l) => l.kind === 'player' && l.gap != null)
  const { above, rest } = ranked(pool, true)
  const out = new Map<string, Place>()
  above.forEach((l, i) => out.set(l.id, { rank: i + 1 }))
  rest.forEach((l) => out.set(l.id, 'level'))
  return out
}

/** A place on the page the file can jump to, in page order. */
export type Spot =
  | { where: 'kupon'; kind: CouponKind; title: string; lineId: string }
  | { where: 'whynot'; lineId: string }
  | { where: 'game'; gameId: number }
  | { where: 'disagree'; line: Line; place: Place }

export const SPOT_SECTION: Record<Spot['where'], string> = {
  kupon: 'Kupons',
  whynot: 'Why not',
  game: 'Game picks',
  disagree: 'Disagree',
}

/** A Kupon or Why not leg that carries him (or a team's game), with the slip it is on. */
export interface FileLeg {
  leg: Leg
  /** The Kupon's title, or null for a Why not single. */
  title: string | null
  kind: CouponKind | null
  /** The slip's own result: a Kupon can lose on another pick while this one won. */
  slip: 'won' | 'lost' | null
}

/** The night's slips the way Kupons draws them: Matches Only riding on Highest Confidence and a slip
 *  that only says "Same picks as" carry no legs of their own. */
function drawnSlots(slots: CouponSlot[]): CouponSlot[] {
  return slots.filter((s) => s.coupon && !s.same)
}

/** Every leg on tonight's Kupons and Why not whose line is one of `ids`. */
function legsOf(slots: CouponSlot[], shots: Leg[], ids: Set<string>): { kupons: FileLeg[]; whyNot: FileLeg[] } {
  const kupons: FileLeg[] = []
  for (const s of drawnSlots(slots))
    for (const leg of s.coupon!.legs)
      if (ids.has(leg.line.id)) kupons.push({ leg, title: s.spec.title, kind: s.spec.kind, slip: s.coupon!.result })
  const wn = shots.filter((l) => ids.has(l.line.id)).map((leg) => ({ leg, title: null, kind: null, slip: null }))
  return { kupons, whyNot: wn }
}

/** Does Game picks show this game (it has a match result, handicap or total line)? */
export function inGamePicks(g: CompareGame, lines: Line[]): boolean {
  return lines.some((l) => l.kind === 'game' && l.game.game_id === g.game_id && PICK_KINDS.some(([s]) => s === l.stat))
}

function spotsOf(
  kupons: FileLeg[],
  wn: FileLeg[],
  game: CompareGame | null,
  inPicks: boolean,
  rows: Line[],
  places: Map<string, Place>,
): Spot[] {
  const out: Spot[] = []
  for (const k of kupons) out.push({ where: 'kupon', kind: k.kind!, title: k.title!, lineId: k.leg.line.id })
  for (const w of wn) out.push({ where: 'whynot', lineId: w.leg.line.id })
  if (game && inPicks) out.push({ where: 'game', gameId: game.game_id })
  const disagree = rows
    .map((l) => ({ l, p: places.get(l.id) ?? null }))
    .filter((x): x is { l: Line; p: Exclude<Place, null> } => x.p != null)
    .sort((a, b) => (a.p === 'level' ? 1e6 : a.p.rank) - (b.p === 'level' ? 1e6 : b.p.rank))
  for (const { l, p } of disagree) out.push({ where: 'disagree', line: l, place: p })
  return out
}

export interface PlayerFile {
  player: NightPlayer
  tiles: { line: Line; place: Place; kupons: FileLeg[] }[]
  kupons: FileLeg[]
  whyNot: FileLeg[]
  /** His game's winner pick, for the match block. */
  win: Line | null
  spots: Spot[]
  counts: { lines: number; bets: number; kupons: number; whyNot: number }
}

/** Everything the page knows about one player tonight. */
export function playerFile(p: NightPlayer, lines: Line[], slots = couponsOf(lines), shots = whyNot(lines)): PlayerFile {
  const ids = new Set(p.lines.map((l) => l.id))
  const { kupons, whyNot: wn } = legsOf(slots, shots, ids)
  const places = placesOf(lines)
  const tiles = p.lines.map((line) => ({
    line,
    place: places.get(line.id) ?? null,
    kupons: kupons.filter((k) => k.leg.line.id === line.id),
  }))
  const win = lines.find((l) => l.kind === 'game' && l.game.game_id === p.game.game_id && l.stat === 'WIN') ?? null
  return {
    player: p,
    tiles,
    kupons,
    whyNot: wn,
    win,
    spots: spotsOf(kupons, wn, p.game, inGamePicks(p.game, lines), p.lines, places),
    counts: {
      lines: p.lines.length,
      bets: p.lines.filter((l) => l.barem).length,
      kupons: new Set(kupons.map((k) => k.title)).size,
      whyNot: wn.length,
    },
  }
}

export interface TeamFile {
  team: NightTeam
  /** The match's bets Game picks takes (handicap, total, match result), then this team's points. */
  game: Line[]
  players: NightPlayer[]
  kupons: FileLeg[]
  whyNot: FileLeg[]
  spots: Spot[]
  counts: { gameBets: number; playerBets: number; kupons: number; whyNot: number }
}

/** Everything the page knows about one team's game tonight. */
export function teamFile(
  t: NightTeam,
  pool: NightPlayer[],
  lines: Line[],
  slots = couponsOf(lines),
  shots = whyNot(lines),
): TeamFile {
  const gid = t.game.game_id
  const order = [...PICK_KINDS.map(([s]) => s), 'TEAM']
  const game = lines
    .filter(
      (l) =>
        l.kind === 'game' &&
        l.game.game_id === gid &&
        order.includes(l.stat) &&
        (l.stat !== 'TEAM' || l.team === t.abbrev),
    )
    .sort((a, b) => order.indexOf(a.stat) - order.indexOf(b.stat))
  const players = pool
    .filter((p) => p.game.game_id === gid && p.team === t.abbrev)
    .sort(
      (a, b) =>
        b.lines.filter((l) => l.barem).length - a.lines.filter((l) => l.barem).length ||
        b.lines.length - a.lines.length ||
        (b.est?.minutes ?? 0) - (a.est?.minutes ?? 0),
    )
  const theirs = players.flatMap((p) => p.lines)
  const ids = new Set([...theirs, ...game].map((l) => l.id))
  const { kupons, whyNot: wn } = legsOf(slots, shots, ids)
  const places = placesOf(lines)
  return {
    team: t,
    game,
    players,
    kupons,
    whyNot: wn,
    spots: spotsOf(kupons, wn, t.game, inGamePicks(t.game, lines), theirs, places),
    counts: {
      gameBets: game.filter((l) => l.barem && l.stat !== 'TEAM').length,
      playerBets: theirs.filter((l) => l.barem).length,
      kupons: new Set(kupons.map((k) => k.title)).size,
      whyNot: wn.length,
    },
  }
}

/** "3 lines · 2 bets", "No line tonight": a result row's plain summary. */
export function rowSummary(p: NightPlayer): string {
  if (!p.lines.length) return 'No line tonight'
  const bets = p.lines.filter((l) => l.barem).length
  return `${p.lines.length} ${p.lines.length === 1 ? 'line' : 'lines'} · ${bets} ${bets === 1 ? 'bet' : 'bets'}`
}

/** Club light for faces and the file's corner glow. Gold belongs to you, live and focus on this site,
 *  so the clubs whose light is gold (Denver, Indiana, New Orleans) take a deep tone of their own. */
const GOLD_CLUBS: Record<string, string> = { DEN: '#4F7CC0', IND: '#3F6FB8', NO: '#4C6A9E' }
export function clubLight(team: string, light: string | undefined): string | undefined {
  return GOLD_CLUBS[team.toUpperCase()] ?? light
}
