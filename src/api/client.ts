import type { components } from './schema'
import type { Credentials } from '../lib/credentials'

export type LeagueSummary = components['schemas']['LeagueSummary']
export type AnalysisReport = components['schemas']['AnalysisReport']
export type TradeIdea = components['schemas']['TradeIdea']
export type PickupIdea = components['schemas']['PickupIdea']
export type PlayerRef = components['schemas']['PlayerRef']
export type CategoryOutlook = components['schemas']['CategoryOutlook']
export type TeamBuild = components['schemas']['TeamBuild']
export type SeasonRow = components['schemas']['SeasonRow']
export type TradeOfTheDay = components['schemas']['TradeOfTheDay']
export type TradeSide = components['schemas']['TradeSide']

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function post<T>(path: string, body: unknown, creds: Credentials | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Cookies travel in headers only, never in the URL.
  if (creds) {
    headers['X-ESPN-S2'] = creds.espnS2
    headers['X-ESPN-SWID'] = creds.swid
  }
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the analyzer server.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const detail = data?.detail
    if (detail && typeof detail === 'object' && 'code' in detail) {
      throw new ApiError(res.status, detail.code, detail.message)
    }
    throw new ApiError(res.status, 'http_error', `Request failed (HTTP ${res.status}).`)
  }
  return res.json() as Promise<T>
}

export function fetchLeague(leagueId: number, season: number | null, creds: Credentials | null) {
  return post<LeagueSummary>('/api/league', { league_id: leagueId, season }, creds)
}

export function fetchAnalysis(
  leagueId: number,
  teamId: number,
  season: number | null,
  keepPlayerIds: number[],
  creds: Credentials | null,
) {
  return post<AnalysisReport>(
    '/api/analyze',
    { league_id: leagueId, team_id: teamId, season, keep_player_ids: keepPlayerIds },
    creds,
  )
}

export function fetchTradeOfTheDay(leagueId: number, season: number | null, creds: Credentials | null) {
  return post<TradeOfTheDay>('/api/trade-of-the-day', { league_id: leagueId, season }, creds)
}

export function voteTradeOfTheDay(
  vote: { leagueId: number; season: number; date: string; teamId: number; take: boolean; voter: string },
  creds: Credentials | null,
) {
  return post<TradeOfTheDay>(
    '/api/trade-of-the-day/vote',
    {
      league_id: vote.leagueId,
      season: vote.season,
      date: vote.date,
      team_id: vote.teamId,
      take: vote.take,
      voter: vote.voter,
    },
    creds,
  )
}
