// Pure helpers for the League page: team identity, box-score order and formatting, and the
// "what can still change this week" hint.

import type { CategoryScore, LeagueOverview, MatchupSide } from '../api/client'

/** Team colours are CSS variables (--team-0 … --team-11), defined for both themes in index.css. */
export const TEAM_COLOURS = 12

/**
 * A stable colour for every team in a league: your team always uses the accent, the others take
 * palette slots in team-id order, so a team keeps its colour on every page and every visit.
 */
export function teamColours(teamIds: number[], myTeamId: number | null | undefined): Map<number, string> {
  const out = new Map<number, string>()
  const others = [...teamIds].filter((id) => id !== myTeamId).sort((a, b) => a - b)
  others.forEach((id, i) => out.set(id, `var(--team-${i % TEAM_COLOURS})`))
  if (myTeamId != null) out.set(myTeamId, 'var(--accent)')
  return out
}

/** Two letters for a team crest: the first letters of its first two words, or its first two letters. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toLocaleUpperCase('en-US')
}

// The order ESPN shows categories in a box score.
const ORDER = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'FG%', 'FT%', 'TO']

export function boxOrder(cats: CategoryScore[]): CategoryScore[] {
  const rank = (s: string) => {
    const i = ORDER.indexOf(s)
    return i === -1 ? ORDER.length : i
  }
  return [...cats].sort((a, b) => rank(a.stat) - rank(b.stat))
}

export const isRatio = (stat: string) => stat.endsWith('%')

/** ".498" for shooting percentages, whole numbers for counting stats. */
export function formatStat(stat: string, value: number): string {
  if (isRatio(stat)) return value.toFixed(3).replace(/^0(?=\.)/, '')
  return String(Math.round(value))
}

/**
 * A category is close when it could still flip this week: counting stats within 11% of each other,
 * shooting percentages within .022.
 */
export function isClose(stat: string, a: number, b: number): boolean {
  if (isRatio(stat)) return Math.abs(a - b) <= 0.022
  const top = Math.max(Math.abs(a), Math.abs(b))
  return top === 0 || Math.abs(a - b) / top <= 0.11
}

export function record(side: Pick<MatchupSide, 'wins' | 'losses' | 'ties'>): string {
  return `${side.wins}-${side.losses}-${side.ties}`
}

function list(stats: string[]): string {
  if (stats.length <= 1) return stats.join('')
  return `${stats.slice(0, -1).join(', ')} or ${stats[stats.length - 1]}`
}

/**
 * One line on what you can still change in your matchup, or null when nothing is in reach.
 * It only names categories whose single flip would change the result (a close loss, or a tie),
 * and says when the other side has no games left. A tie at 0 on both sides is no stats yet, not a swing
 * category, so at the start of a week (everything 0-0) it says nothing.
 */
export function flipHint(me: MatchupSide, them: MatchupSide): string | null {
  const theirs = new Map((them.categories ?? []).map((c) => [c.stat, c.value]))
  const close = (c: CategoryScore) => theirs.has(c.stat) && isClose(c.stat, c.value, theirs.get(c.stat)!)
  const unplayed = (c: CategoryScore) => c.value === 0 && (theirs.get(c.stat) ?? 0) === 0
  const outcome = (w: number, l: number) => Math.sign(w - l) // 1 win, 0 level, -1 loss
  const now = outcome(me.wins, me.losses)
  const myLeft = me.games?.left ?? null
  const done = myLeft != null && myLeft > 0 && them.games?.left === 0
  const lead = done ? `They're done for the week. Your ${myLeft} ${myLeft === 1 ? 'game' : 'games'} left can ` : ''
  const say = (s: string) => lead + (lead ? s : s[0].toUpperCase() + s.slice(1))

  if (now < 1) {
    let best = now
    let after = record(me)
    const flips: string[] = []
    for (const c of boxOrder(me.categories ?? [])) {
      const flip =
        c.result === 'L' && close(c)
          ? { wins: me.wins + 1, losses: me.losses - 1, ties: me.ties }
          : c.result === 'T' && !unplayed(c)
            ? { wins: me.wins + 1, losses: me.losses, ties: me.ties - 1 }
            : null
      if (!flip) continue
      const o = outcome(flip.wins, flip.losses)
      if (o > best) {
        best = o
        after = record(flip)
        flips.length = 0
      }
      if (o === best && o > now) flips.push(c.stat)
    }
    if (!flips.length) return null
    return say(best === 1 ? `flip ${list(flips)} to win ${after}` : `flip ${list(flips)} to level it at ${after}`)
  }
  // Ahead by a little: the close categories you lead are the ones to hold.
  const hold = boxOrder((me.categories ?? []).filter((c) => c.result === 'W' && close(c))).map((c) => c.stat)
  if (hold.length && me.wins - me.losses <= 2) return `Hold ${list(hold).replace(' or ', ' and ')} to keep the win`
  return null
}

/** ESPN's public headshot for a player; fantasy player ids are the same ids ESPN uses. */
export function headshotUrl(playerId: number) {
  return `https://a.espncdn.com/i/headshots/nba/players/full/${playerId}.png`
}

/** ESPN's NBA team logo by the pro team abbreviation ESPN uses (LAC, GS, NO, UTAH, WSH). */
export function teamLogoUrl(abbrev: string) {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${abbrev.toLowerCase()}.png`
}

/** This week's opponent of your team and the League page's hint, for the Scores page. */
export function tonightMatchup(
  o: Pick<LeagueOverview, 'matchups' | 'teams'>,
  myTeamId: number | null | undefined,
): { opponentId: number; opponentName: string; hint: string | null } | null {
  if (myTeamId == null) return null
  const m = o.matchups.find((x) => x.home.team_id === myTeamId || x.away.team_id === myTeamId)
  if (!m) return null
  const [me, them] = m.home.team_id === myTeamId ? [m.home, m.away] : [m.away, m.home]
  const name = o.teams.find((t) => t.id === them.team_id)?.name ?? 'your opponent'
  return { opponentId: them.team_id, opponentName: name, hint: flipHint(me, them) }
}
