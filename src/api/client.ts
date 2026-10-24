import type { components } from './schema'
import type { Credentials } from '../lib/credentials'
import { loadToken } from '../lib/session'

export type LeagueSummary = components['schemas']['LeagueSummary']
export type AnalysisReport = components['schemas']['AnalysisReport']
export type TradeIdea = components['schemas']['TradeIdea']
export type PickupIdea = components['schemas']['PickupIdea']
export type PlayerRef = components['schemas']['PlayerRef']
export type PlayerBadge = components['schemas']['PlayerBadge']
export type CategoryOutlook = components['schemas']['CategoryOutlook']
export type TeamBuild = components['schemas']['TeamBuild']
export type SeasonRow = components['schemas']['SeasonRow']
export type TradeOfTheDay = components['schemas']['TradeOfTheDay']
export type TradeSide = components['schemas']['TradeSide']
export type TeamLinkChallenge = components['schemas']['TeamLinkChallenge']
export type LinkedTeam = components['schemas']['LinkedTeam']
export type FeedPage = components['schemas']['FeedPage']
export type FeedItem = components['schemas']['FeedItem']
export type FeedTeam = components['schemas']['FeedTeam']
export type Reactions = components['schemas']['Reactions']
export type RepliesPage = components['schemas']['RepliesPage']
export type ReactionsOut = components['schemas']['ReactionsOut']
export type Me = components['schemas']['Me']
export type MyLeague = components['schemas']['MyLeague']
export type Notice = components['schemas']['Notice']
export type AuthResult = components['schemas']['AuthResult']
export type AuthConfig = components['schemas']['AuthConfig']
export type LeagueOverview = components['schemas']['LeagueOverview']
export type OverviewTeam = components['schemas']['OverviewTeam']
export type OverviewMatchup = components['schemas']['OverviewMatchup']

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

// Every call carries the signed-in account's token; ESPN cookies only when the league is private.
async function request<T>(method: 'GET' | 'POST', path: string, body: unknown, creds: Credentials | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Cookies travel in headers only, never in the URL.
  if (creds) {
    headers['X-ESPN-S2'] = creds.espnS2
    headers['X-ESPN-SWID'] = creds.swid
  }
  const token = loadToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined })
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

function post<T>(path: string, body: unknown, creds: Credentials | null = null): Promise<T> {
  return request<T>('POST', path, body, creds)
}

export function fetchAuthConfig() {
  return request<AuthConfig>('GET', '/api/auth/config', null, null)
}

export function signUp(email: string, password: string) {
  return post<AuthResult>('/api/auth/signup', { email, password })
}

export function signIn(email: string, password: string) {
  return post<AuthResult>('/api/auth/login', { email, password })
}

export function signInWithGoogle(credential: string) {
  return post<AuthResult>('/api/auth/google', { credential })
}

export function signOut() {
  return post<{ ok: boolean }>('/api/auth/logout', {})
}

export function fetchMe() {
  return post<Me>('/api/me', {})
}

export function clearNotices() {
  return post<Me>('/api/me/notices/clear', {})
}

export function addLeague(leagueId: number, season: number | null, creds: Credentials | null) {
  return post<Me>('/api/my-leagues/add', { league_id: leagueId, season }, creds)
}

export function removeLeague(ref: LeagueRef) {
  return post<Me>('/api/my-leagues/remove', { league_id: ref.leagueId, season: ref.season })
}

export function fetchOverview(ref: LeagueRef, creds: Credentials | null) {
  return post<LeagueOverview>('/api/league-overview', { league_id: ref.leagueId, season: ref.season }, creds)
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

export interface LeagueRef {
  leagueId: number
  season: number
}

export function startTeamLink(ref: LeagueRef, teamId: number, creds: Credentials | null) {
  return post<TeamLinkChallenge>(
    '/api/team-link/start',
    { league_id: ref.leagueId, season: ref.season, team_id: teamId },
    creds,
  )
}

export function verifyTeamLink(challenge: string, creds: Credentials | null) {
  return post<LinkedTeam>('/api/team-link/verify', { challenge }, creds)
}

export function fetchFeed(ref: LeagueRef, page: number, creds: Credentials | null) {
  return post<FeedPage>('/api/feed', { league_id: ref.leagueId, season: ref.season, page }, creds)
}

export function fetchReplies(ref: LeagueRef, target: string) {
  return post<RepliesPage>('/api/feed/replies', { league_id: ref.leagueId, season: ref.season, target })
}

export function createPost(ref: LeagueRef, body: string, target: string | null) {
  return post<FeedItem>('/api/posts', { league_id: ref.leagueId, season: ref.season, body, target })
}

export function deletePost(ref: LeagueRef, postId: number) {
  return post<{ ok: boolean }>('/api/posts/delete', { league_id: ref.leagueId, season: ref.season, post_id: postId })
}

export function react(ref: LeagueRef, target: string, reaction: string, on: boolean, creds: Credentials | null) {
  return post<ReactionsOut>(
    '/api/reactions',
    { league_id: ref.leagueId, season: ref.season, target, reaction, on },
    creds,
  )
}

export type TargetReport = components['schemas']['TargetReport']
export type TargetOffer = components['schemas']['TargetOffer']
export type TeamRoster = components['schemas']['TeamRoster']
export type TradeTarget = components['schemas']['TradeTarget']

export function fetchTarget(
  leagueId: number,
  teamId: number,
  season: number | null,
  playerId: number,
  keepPlayerIds: number[],
  creds: Credentials | null,
) {
  return post<TargetReport>(
    '/api/target',
    { league_id: leagueId, team_id: teamId, season, player_id: playerId, keep_player_ids: keepPlayerIds },
    creds,
  )
}
