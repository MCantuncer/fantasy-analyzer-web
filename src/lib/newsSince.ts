import type { AnalysisReport, PickupIdea, PlayerRef, ReportChange, TradeIdea } from '../api/client'
import { bestMoveOf, pickupKey, type BestMoveChoice } from './bestMove'
import { tradeKey } from './format'
import { lastName } from './moveTiming'

/**
 * "What changed in your moves" for the news card: given the report that was on screen before
 * the news (``before``), the finished new one (``after``, null while it runs) and the league
 * changes in between, work out which of your moves changed, a reason only where player and
 * team ids prove it, your own roster news, and the rest of the league grouped.
 */

export interface NewsTeam {
  id: number
  name: string
}

/** A player as the card draws him: enough for a face, a name and the player card. */
export interface NewsPlayer {
  id: number
  name: string
  pro_team?: string | null
}

/** One change about one player: the face, his short tag (DTD, OUT, Back) or the roster sign. */
export interface NewsItem {
  player: NewsPlayer
  change: ReportChange
  /** DTD, OUT, IR, SUSP, or Back for a return. */
  tag?: string
  /** + for an add, − for a drop. */
  sign?: '+' | '−'
}

/** "{lead} [crest] {team} {tail} [tag]": a short fact, only drawn when ids prove it. */
export interface NewsReason {
  lead?: string
  team?: NewsTeam
  tail?: string
  tag?: string
}

export type NewsRowKind = 'best' | 'trades' | 'fa' | 'odds'

export interface NewsRow {
  kind: NewsRowKind
  label: string
  /** "Add Ayo Dosunmu", "Get Ja Morant", "Hold for now", "Lopez is off the board". */
  title: string
  player?: NewsPlayer
  /** The move's own playoff odds, shown neutral (an option's value, not a change). */
  before?: number
  after?: number
  /** Season odds only: the change in whole points, the one coloured number. */
  delta?: number
  /** "was Lopez", "1 new · 1 gone". */
  side?: string
  /** Best move only: the move it replaced, shown as a small face beside "was Lopez". */
  was?: NewsPlayer
  /** Best move only: the replaced move's playoff-odds gain in whole points when it led, and now
   *  (left out when it is no longer on the list), so the row shows why the lead changed. */
  wasGain?: { then: number; now?: number }
  reason?: NewsReason
  /** Still being worked out: the number slot waits. */
  pending?: boolean
}

export interface NewsLeague {
  hurt: NewsItem[]
  back: NewsItem[]
  /** Roster moves by team, the busiest team first, adds before drops. */
  moves: { team: NewsTeam; items: NewsItem[] }[]
  games: number
}

export interface News {
  roster: NewsItem[]
  rows: NewsRow[]
  league: NewsLeague
}

/** Season odds must move this many whole points to get a row (new box scores alone rarely do). */
export const ODDS_ROW_POINTS = 2

const HURT_WORDS: [string, string][] = [
  [' is out', 'OUT'],
  [' is day-to-day', 'DTD'],
  [' is on injured reserve', 'IR'],
  [' is suspended', 'SUSP'],
  [' moved to IR', 'IR'],
]
const BACK_WORDS = [' is healthy again', ' moved off IR']
const HURT_ORDER = ['OUT', 'IR', 'SUSP', 'DTD']

/** The short tag of a status change, read from the server's fixed wording. */
export function statusTag(c: ReportChange): string | undefined {
  if (c.kind !== 'status') return undefined
  for (const [words, tag] of HURT_WORDS) if (c.text.endsWith(words)) return tag
  if (BACK_WORDS.some((w) => c.text.endsWith(w))) return 'Back'
  return undefined
}

/** The player's name as the change spells it, for a player no report lists. */
function nameFromText(c: ReportChange): string {
  const t = c.text
  if (c.kind === 'added') return t.slice(t.lastIndexOf(' added ') + 7)
  if (c.kind === 'dropped') return t.slice(t.lastIndexOf(' dropped ') + 9)
  if (c.kind === 'moved') return t.slice(0, t.indexOf(' went from '))
  for (const [words] of HURT_WORDS) if (t.endsWith(words)) return t.slice(0, -words.length)
  for (const words of BACK_WORDS) if (t.endsWith(words)) return t.slice(0, -words.length)
  return t
}

function reportPlayers(r: AnalysisReport | null | undefined, into: Map<number, PlayerRef>) {
  if (!r) return
  const put = (p: PlayerRef | null | undefined) => {
    if (p && !into.has(p.id)) into.set(p.id, p)
  }
  r.roster.forEach(put)
  r.league_rosters.forEach((t) => t.players.forEach((x) => put(x.player)))
  r.pickups.forEach((p) => (put(p.add), put(p.drop)))
  ;[...r.trades, ...r.edge_trades].forEach((t) => (t.give.forEach(put), t.get.forEach(put)))
}

function teamNames(...reports: (AnalysisReport | null | undefined)[]): Map<number, string> {
  const out = new Map<number, string>()
  for (const r of reports) {
    r?.season.forEach((s) => out.set(s.team_id, s.team_name))
    r?.league_rosters.forEach((t) => out.set(t.team_id, t.team_name))
  }
  return out
}

/** The team name a roster change spells, for a team no report lists. */
function teamFromText(c: ReportChange): string {
  const t = c.text
  if (c.kind === 'added') return t.slice(0, t.lastIndexOf(' added '))
  if (c.kind === 'dropped') return t.slice(0, t.lastIndexOf(' dropped '))
  if (c.kind === 'moved') return t.slice(t.lastIndexOf(' to ') + 4)
  return ''
}

const straightAdds = (r: AnalysisReport) => r.pickups.filter((p) => !p.open_spot_by_trade)
const allTrades = (r: AnalysisReport) => {
  const seen = new Set<string>()
  return [...r.trades, ...r.edge_trades].filter((t) => {
    const k = tradeKey(t)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function tally(fresh: number, gone: number): string | undefined {
  const parts = [fresh ? `${fresh} new` : '', gone ? `${gone} gone` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

const pct = (x: number) => Math.round(x * 100)

export function buildNews(before: AnalysisReport | null, after: AnalysisReport | null, changes: ReportChange[]): News {
  const me = (after ?? before)?.team_id ?? null
  const players = new Map<number, PlayerRef>()
  reportPlayers(after, players)
  reportPlayers(before, players)
  const names = teamNames(after, before)

  const playerOf = (c: ReportChange): NewsPlayer => {
    const p = c.player_id != null ? players.get(c.player_id) : undefined
    return p ? { id: p.id, name: p.name, pro_team: p.pro_team } : { id: c.player_id ?? -1, name: nameFromText(c) }
  }
  const teamOf = (c: ReportChange): NewsTeam | undefined =>
    c.team_id == null ? undefined : { id: c.team_id, name: names.get(c.team_id) ?? teamFromText(c) }
  const item = (c: ReportChange): NewsItem => ({
    player: playerOf(c),
    change: c,
    tag: statusTag(c),
    sign:
      c.kind === 'dropped' || (c.kind === 'moved' && c.mine && c.team_id !== me)
        ? '−'
        : c.kind === 'added' || c.kind === 'moved'
          ? '+'
          : undefined,
  })

  // Who left the board (taken by another team) and who has news, by player id.
  const taken = new Map<number, ReportChange>()
  const droppedBy = new Map<number, ReportChange>()
  const status = new Map<number, ReportChange>()
  let games = 0
  for (const c of changes) {
    if (c.kind === 'games') {
      games += Number(c.text.match(/\d+/)?.[0] ?? 0)
      continue
    }
    if (c.player_id == null) continue
    if ((c.kind === 'added' || c.kind === 'moved') && c.team_id !== me) taken.set(c.player_id, c)
    if (c.kind === 'dropped') droppedBy.set(c.player_id, c)
    if (c.kind === 'status' && statusTag(c)) status.set(c.player_id, c)
  }

  // Your own roster: status news on your players, and your own adds and drops.
  const myIds = new Set([...(before?.roster ?? []), ...(after?.roster ?? [])].map((p) => p.id))
  const onRoster = (c: ReportChange) =>
    c.kind !== 'games' && (c.mine || (c.kind === 'status' && c.player_id != null && myIds.has(c.player_id)))
  const roster = changes.filter(onRoster).map(item)

  const rows = after && before ? doneRows(before, after) : before ? runningRows(before) : []

  // The rest of the league, grouped.
  const rest = changes.filter((c) => c.kind !== 'games' && !onRoster(c)).map(item)
  const hurt = rest
    .filter((i) => i.tag && i.tag !== 'Back')
    .sort((a, b) => HURT_ORDER.indexOf(a.tag!) - HURT_ORDER.indexOf(b.tag!))
  const back = rest.filter((i) => i.tag === 'Back')
  const byTeam = new Map<number, { team: NewsTeam; items: NewsItem[] }>()
  for (const i of rest.filter((x) => x.change.kind !== 'status')) {
    const team = teamOf(i.change)
    if (!team) continue
    const group = byTeam.get(team.id) ?? { team, items: [] }
    group.items.push(i)
    byTeam.set(team.id, group)
  }
  const moves = [...byTeam.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (a.sign === '+' ? 0 : 1) - (b.sign === '+' ? 0 : 1)),
    }))
    .sort((a, b) => b.items.length - a.items.length)

  return { roster, rows, league: { hurt, back, moves, games } }

  // ---- rows ----

  function wentTo(p: { id: number; name: string }, named = true): NewsReason | undefined {
    const c = taken.get(p.id)
    const team = c && teamOf(c)
    return team ? { lead: named ? `${lastName(p.name)} went to` : 'Went to', team } : undefined
  }
  function droppedFrom(p: { id: number }): NewsReason | undefined {
    const c = droppedBy.get(p.id)
    const team = c && teamOf(c)
    return team ? { lead: 'Dropped by', team } : undefined
  }
  function isNow(p: { id: number; name: string }): NewsReason | undefined {
    const c = status.get(p.id)
    return c ? { lead: `${lastName(p.name)} is now`, tag: statusTag(c) } : undefined
  }
  function face(p: PlayerRef): NewsPlayer {
    return { id: p.id, name: p.name, pro_team: p.pro_team }
  }
  function mainOf(b: BestMoveChoice): PlayerRef | undefined {
    return b.kind === 'pickup' ? b.pickup.add : b.kind === 'trade' ? b.trade.get[0] : undefined
  }
  function moveTitle(b: BestMoveChoice): string {
    if (b.kind === 'pickup') return `Add ${b.pickup.add.name}`
    if (b.kind === 'trade') return `Get ${b.trade.get.map((p) => p.name).join(' + ')}`
    return 'Hold for now'
  }
  function gainPts(m: PickupIdea | TradeIdea) {
    return pct(m.playoff_pct_after) - pct(m.playoff_pct_before)
  }
  /** The old best move's gain when it led, and the same move's gain in the new report. */
  function gainOf(b0: BestMoveChoice, a: AnalysisReport): NewsRow['wasGain'] {
    if (b0.kind === 'hold') return undefined
    const then = gainPts(b0.kind === 'pickup' ? b0.pickup : b0.trade)
    const same =
      b0.kind === 'pickup'
        ? straightAdds(a).find((p) => pickupKey(p) === b0.key)
        : allTrades(a).find((t) => tradeKey(t) === b0.key)
    return same ? { then, now: gainPts(same) } : { then }
  }
  function odds(m: PickupIdea | TradeIdea) {
    return { before: m.playoff_pct_before, after: m.playoff_pct_after }
  }

  function doneRows(b: AnalysisReport, a: AnalysisReport): NewsRow[] {
    const out: NewsRow[] = []
    const used = new Set<number>()
    const b0 = bestMoveOf(b)
    const b1 = bestMoveOf(a)

    if (b0.key !== b1.key) {
      const was = mainOf(b0)
      const now = mainOf(b1)
      const move = b1.kind === 'pickup' ? b1.pickup : b1.kind === 'trade' ? b1.trade : null
      const reason =
        (was && wentTo(was)) ||
        (now && b1.kind === 'pickup' && droppedFrom(now)) ||
        (now && isNow(now)) ||
        (was && isNow(was)) ||
        undefined
      out.push({
        kind: 'best',
        label: 'Best move',
        title: moveTitle(b1),
        player: now && face(now),
        ...(move ? odds(move) : {}),
        side: was ? `was ${lastName(was.name)}` : 'was hold',
        was: was && face(was),
        wasGain: gainOf(b0, a),
        reason,
      })
      if (now) used.add(now.id)
    }

    // Trades: the top idea changed, or an idea is gone with a provable reason.
    const tb = allTrades(b)
    const ta = allTrades(a)
    const kb = new Set(tb.map(tradeKey))
    const ka = new Set(ta.map(tradeKey))
    const fresh = ta.filter((t) => !kb.has(tradeKey(t)))
    const gone = tb.filter((t) => !ka.has(tradeKey(t)))
    const goneWith = (t: TradeIdea) => [...t.give, ...t.get].find((p) => status.has(p.id) || taken.has(p.id))
    const goneReasoned = gone.filter((t) => goneWith(t))
    const topChanged = (b.trades[0] && tradeKey(b.trades[0])) !== (a.trades[0] && tradeKey(a.trades[0]))
    const partnerAdded = (t: TradeIdea) => t.get.find((p) => taken.get(p.id)?.team_id === t.partner_team_id)
    const featured = fresh.find((t) => partnerAdded(t)) ?? (topChanged ? a.trades[0] : undefined)
    const show = featured && !(b1.kind === 'trade' && tradeKey(featured) === b1.key) ? featured : undefined
    if (show || goneReasoned.length || (topChanged && !a.trades.length)) {
      let reason: NewsReason | undefined
      if (show && partnerAdded(show)) {
        reason = {
          team: { id: show.partner_team_id, name: show.partner_team_name },
          tail: 'just added him',
        }
      } else if (goneReasoned.length) {
        const p = goneWith(goneReasoned[0])!
        const n = goneReasoned.filter((t) => goneWith(t)?.id === p.id).length
        const c = status.get(p.id)
        reason = c
          ? {
              lead: `${n} gone ${n === 1 ? 'idea had' : 'ideas had'} ${lastName(p.name)}`,
              tag: statusTag(c),
            }
          : wentTo(p)
      }
      out.push({
        kind: 'trades',
        label: 'Trades to offer',
        title: show
          ? `Get ${show.get.map((p) => p.name).join(' + ')}`
          : ta.length
            ? `${gone.length} ${gone.length === 1 ? 'idea' : 'ideas'} gone`
            : 'No trades to offer now',
        player: show && face(show.get[0]),
        ...(show ? odds(show) : {}),
        side: tally(fresh.length, gone.length),
        reason,
      })
      if (show) used.add(show.get[0].id)
    }

    // FA targets: the top straight add changed, or one of your top 3 targets was taken.
    const fb = straightAdds(b)
    const fa = straightAdds(a)
    const ib = new Set(fb.map((p) => p.add.id))
    const ia = new Set(fa.map((p) => p.add.id))
    // The old best add is told in the Best move row already: a player shows in one row only.
    const oldBest = mainOf(b0)?.id
    const takenTop = fb.slice(0, 3).find((p) => taken.has(p.add.id) && p.add.id !== oldBest)
    const topAdd = fa[0]
    const topChangedFa = fb[0]?.add.id !== topAdd?.add.id
    if ((topChangedFa || takenTop) && !(topAdd && used.has(topAdd.add.id) && !takenTop)) {
      const show = topChangedFa && topAdd && !used.has(topAdd.add.id) ? topAdd : undefined
      out.push({
        kind: 'fa',
        label: 'FA targets',
        title: show
          ? `Add ${show.add.name}`
          : takenTop
            ? `${lastName(takenTop.add.name)} is off the board`
            : 'No free agent helps now',
        player: show ? face(show.add) : takenTop && face(takenTop.add),
        ...(show ? odds(show) : {}),
        side: tally(fa.filter((p) => !ib.has(p.add.id)).length, fb.filter((p) => !ia.has(p.add.id)).length),
        reason: (takenTop && wentTo(takenTop.add)) || (show && droppedFrom(show.add)) || undefined,
      })
    }

    // Season odds: only a real move, and never with a cause (a whole league of news moved it).
    const sb = b.season.find((r) => r.team_id === b.team_id)?.playoff_pct
    const sa = a.season.find((r) => r.team_id === a.team_id)?.playoff_pct
    if (sb != null && sa != null && Math.abs(pct(sa) - pct(sb)) >= ODDS_ROW_POINTS) {
      out.push({
        kind: 'odds',
        label: 'Season odds',
        title: 'Playoff odds',
        before: sb,
        after: sa,
        delta: pct(sa) - pct(sb),
      })
    }
    return out
  }

  /** While the new run works: only what the old report and the changes already prove. */
  function runningRows(b: AnalysisReport): NewsRow[] {
    const out: NewsRow[] = []
    const b0 = bestMoveOf(b)
    const was = mainOf(b0)
    if (was && (taken.has(was.id) || status.has(was.id))) {
      out.push({
        kind: 'best',
        label: 'Best move',
        title: taken.has(was.id) ? `${lastName(was.name)} is off the board` : moveTitle(b0),
        player: face(was),
        reason:
          wentTo(was, false) ??
          (status.has(was.id) ? { lead: 'He is now', tag: statusTag(status.get(was.id)!) } : undefined),
        pending: true,
      })
    }
    const touched = allTrades(b).filter((t) => [...t.give, ...t.get].some((p) => status.has(p.id) || taken.has(p.id)))
    if (touched.length) {
      const p = [...touched[0].give, ...touched[0].get].find((x) => status.has(x.id) || taken.has(x.id))!
      const n = touched.filter((t) => [...t.give, ...t.get].some((x) => x.id === p.id)).length
      const c = status.get(p.id)
      out.push({
        kind: 'trades',
        label: 'Trades to offer',
        title: `${n} ${n === 1 ? 'idea has' : 'ideas have'} ${lastName(p.name)}`,
        player: face(p),
        reason: c ? { lead: 'He is now', tag: statusTag(c) } : wentTo(p, false),
        pending: true,
      })
    }
    const takenTop = straightAdds(b)
      .slice(0, 3)
      .find((p) => taken.has(p.add.id) && p.add.id !== was?.id)
    if (takenTop) {
      out.push({
        kind: 'fa',
        label: 'FA targets',
        title: `${lastName(takenTop.add.name)} is off the board`,
        player: face(takenTop.add),
        reason: wentTo(takenTop.add, false),
        pending: true,
      })
    }
    return out
  }
}

// Once the finished card has been read, it opens folded to one line on the next visit (this tab only).
const SEEN_KEY = 'news-seen'

/** Whether the news card for this finished report has already been read in this tab. */
export function isNewsSeen(reportKey: string): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === reportKey
  } catch {
    return false
  }
}

export function markNewsSeen(reportKey: string) {
  try {
    sessionStorage.setItem(SEEN_KEY, reportKey)
  } catch {
    // Storage blocked (private mode): the card simply opens unfolded next time.
  }
}
