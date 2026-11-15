import { useQuery } from '@tanstack/react-query'
import { fetchScores } from '../api/client'
import type { ScoreDay } from '../api/client'
import type { Credentials } from './credentials'
import { todayPeriod } from './todayGame'

export interface TodaySource {
  leagueId: number
  season: number
  teamId: number
  creds: Credentials | null
}

const MINUTE = 60_000

/**
 * Today's NBA game day from the Scores feed: the server's default day, or the next game day once
 * all of its games are final (the step My Players makes). Uses the Scores page's own query keys,
 * so the pages share one fetch. No feed while it loads, when it fails, or without a source.
 */
export function useTodayFeed(src: TodaySource | null): { feed: ScoreDay | null; pending: boolean } {
  const swid = src?.creds?.swid ?? null
  const key = (day: number | null) => ['scores', src?.leagueId, src?.season, day, src?.teamId, swid] as const
  const poll = (data: ScoreDay | undefined) => (data?.live ? MINUTE : 5 * MINUTE)
  const base = useQuery({
    queryKey: key(null),
    queryFn: () => fetchScores(src!.leagueId, src!.season, null, src!.teamId, src!.creds),
    enabled: !!src,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: (q) => poll(q.state.data),
  })
  const period = base.data ? todayPeriod(base.data) : null
  const stepped = period !== null && period !== base.data?.day
  const next = useQuery({
    queryKey: key(period),
    queryFn: () => fetchScores(src!.leagueId, src!.season, period, src!.teamId, src!.creds),
    enabled: !!src && stepped,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: (q) => poll(q.state.data),
  })
  const feed = !base.data ? null : stepped ? (next.data ?? null) : base.data
  // Still on its way (not failed): the rows say so instead of leaving a gap.
  const pending = !!src && !feed && !base.isError && !next.isError
  return { feed, pending }
}
