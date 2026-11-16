import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchLineup, fetchScores } from '../api/client'
import type { DayLineup, ScoreDay } from '../api/client'
import type { Credentials } from './credentials'

const MINUTE = 60_000

export interface TodayData {
  scores: ScoreDay
  lineups: [DayLineup, DayLineup]
  /** The last fetch failed; what's on screen is from ``scores.updated_at``. */
  stale: boolean
  refetch: () => void
}

/** When to ask again: every minute while a game is on; otherwise at the next tip (at most 5 minutes away). */
export function nextFetch(s: ScoreDay | undefined, now = Date.now()): number | false {
  if (!s) return false
  if (s.live) return MINUTE
  const tips = s.games.filter((g) => g.status === 'scheduled').map((g) => new Date(g.start).getTime() - now)
  if (!tips.length) return false
  return Math.max(30_000, Math.min(5 * MINUTE, Math.min(...tips)))
}

/**
 * Today's games and both lineups, read the way My Team → My Players reads them (the same query keys,
 * so the two share one fetch): the scores every minute while a game is on, each lineup every minute
 * until the night is over. Null until all three are in, or when today falls outside this week.
 */
export function useTodayMatchup(
  leagueId: number | undefined,
  season: number | undefined,
  creds: Credentials | null,
  myId: number | null | undefined,
  oppId: number | null | undefined,
  weekStart: string | null | undefined,
  weekEnd: string | null | undefined,
): {
  data: TodayData | null
  loading: boolean
  failed: boolean
  inWeek: boolean | null
} {
  const swid = creds?.swid ?? null
  const on = leagueId != null && season != null && myId != null && oppId != null
  const scores = useQuery({
    queryKey: ['scores', leagueId, season, null, myId, swid] as const,
    queryFn: () => fetchScores(leagueId!, season!, null, myId!, creds),
    enabled: on,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: (q) => nextFetch(q.state.data),
  })
  const s = scores.data
  const inWeek = !!s?.date && (!weekStart || s.date >= weekStart) && (!weekEnd || s.date <= weekEnd)
  const over = !!s && s.games.length > 0 && s.games.every((g) => g.status === 'final')
  const lineups = useQueries({
    queries: [myId, oppId].map((teamId) => ({
      queryKey: ['lineup', leagueId, season, teamId, s?.day ?? null, swid] as const,
      queryFn: () => fetchLineup(leagueId!, season!, teamId!, s!.day, creds),
      enabled: on && !!s && inWeek,
      retry: 1,
      staleTime: 20_000,
      // A finished night's lineup never changes; tonight's follows the ESPN app.
      refetchInterval: over ? (false as const) : MINUTE,
    })),
  })
  const [a, b] = lineups
  const ready = !!s && inWeek && !!a.data && !!b.data && a.data.day === s.day && b.data.day === s.day
  return {
    loading: on && (scores.isPending || (inWeek && (a.isPending || b.isPending))),
    failed: !ready && (scores.isError || a.isError || b.isError),
    // Unknown until the day's scores arrive.
    inWeek: s ? inWeek : null,
    data: ready
      ? {
          scores: s,
          lineups: [a.data!, b.data!],
          stale: scores.isError || a.isError || b.isError,
          refetch: () => {
            scores.refetch()
            a.refetch()
            b.refetch()
          },
        }
      : null,
  }
}

/** Today counts for the default view while a game is on or still to come and someone in either lineup plays. */
export function todayMatters(d: TodayData): boolean {
  const ahead = d.scores.games.some((g) => g.status !== 'final')
  const ids = new Set(d.scores.games.map((g) => g.id))
  const plays = d.lineups.some((l) => l.spots.some((s) => s.starting && s.game_id != null && ids.has(s.game_id)))
  return ahead && plays
}
