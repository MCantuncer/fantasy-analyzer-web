import type { TradeOfTheDay, TradeSide } from '../api/client'
import { names, pct, signedInt } from './format'

const VOTER_KEY = 'totd-voter'

/** A random id that lets this browser change its vote instead of adding another. Not tied to anyone. */
export function voterId(): string {
  try {
    const saved = localStorage.getItem(VOTER_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    localStorage.setItem(VOTER_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/** Votes belong to one deal: when the day's pick is replaced, the poll starts over. */
function voteKey(leagueId: number, pick: string, teamId: number) {
  return `totd-vote:${leagueId}:${pick}:${teamId}`
}

export function pickKey(pick: { date: string; pick_id?: string | null }): string {
  return pick.pick_id ? `${pick.date}:${pick.pick_id}` : pick.date
}

export function loadVote(leagueId: number, pick: string, teamId: number): boolean | null {
  try {
    const v = localStorage.getItem(voteKey(leagueId, pick, teamId))
    return v === 'yes' ? true : v === 'no' ? false : null
  } catch {
    return null
  }
}

export function storeVote(leagueId: number, pick: string, teamId: number, take: boolean) {
  try {
    localStorage.setItem(voteKey(leagueId, pick, teamId), take ? 'yes' : 'no')
  } catch {
    // storage unavailable; the vote still counts, the page just won't remember it
  }
}

/** The categories a side gains most in, as weekly win-chance points, biggest first. */
export function topGains(changes: Record<string, number>, max = 3): { category: string; pts: number }[] {
  return Object.entries(changes)
    .map(([category, v]) => ({ category, pts: Math.round(v * 100) }))
    .filter((c) => c.pts >= 2)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, max)
}

function oddsLine(s: TradeSide): string {
  const diff = Math.round(s.playoff_pct_after * 100) - Math.round(s.playoff_pct_before * 100)
  return `${s.team_name}: playoff odds ${pct(s.playoff_pct_before)} → ${pct(s.playoff_pct_after)} (${signedInt(diff)})`
}

/** A short post for the league's group chat. */
export function shareText(pick: TradeOfTheDay, leagueName: string, url: string): string {
  const [a, b] = pick.sides ?? []
  if (!a || !b) return ''
  return [
    `🔁 Trade of the day in ${leagueName}`,
    `${a.team_name} send ${names(a.sends)} to ${b.team_name} for ${names(b.sends)}.`,
    oddsLine(a),
    oddsLine(b),
    `Would you take it? ${url}`,
  ].join('\n')
}
