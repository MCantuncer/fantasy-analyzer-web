import { useQuery } from '@tanstack/react-query'
import { fetchManagerStyles, retryDropped, retryDroppedDelay, type LeagueRef } from '../api/client'
import type { Credentials } from './credentials'

/** Every manager's play style, the win path and this week's calls; one call shared by My Team and League. */
export function useManagerStyles(leagueRef: LeagueRef | undefined, creds: Credentials | null, enabled = true) {
  return useQuery({
    queryKey: ['manager-styles', leagueRef?.leagueId, leagueRef?.season, creds?.swid ?? null],
    queryFn: () => fetchManagerStyles(leagueRef!, creds),
    enabled: enabled && !!leagueRef,
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 30 * 60_000,
  })
}
