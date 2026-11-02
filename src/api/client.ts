import type { components } from './schema'
import type { Credentials } from '../lib/credentials'
import { loadToken } from '../lib/session'

export type LeagueSummary = components['schemas']['LeagueSummary']
export type AnalysisReport = components['schemas']['AnalysisReport']
export type AnalysisJob = components['schemas']['AnalysisJob']
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
export type MatchupSide = components['schemas']['MatchupSide']
export type CategoryScore = components['schemas']['CategoryScore']
export type WeekGames = components['schemas']['WeekGames']
export type OverviewMatchup = components['schemas']['OverviewMatchup']
export type ShopReport = components['schemas']['ShopReport']
export type ShopDeal = components['schemas']['ShopDeal']
export type ShopTeam = components['schemas']['ShopTeam']
export type ShopTarget = components['schemas']['ShopTarget']
export type ScoreDay = components['schemas']['ScoreDay']
export type Game = components['schemas']['Game']
export type GameLine = components['schemas']['GameLine']
export type FixtureDay = components['schemas']['FixtureDay']
export type NewsPage = components['schemas']['NewsPage']
export type NewsStory = components['schemas']['NewsStory']
export type NewsPlayer = components['schemas']['NewsPlayer']
export type NewsSourceLink = components['schemas']['NewsSourceLink']
export type NewsSourceHealth = components['schemas']['NewsSourceHealth']
export type TrendingPlayer = components['schemas']['TrendingPlayer']
export type InjuryImpact = components['schemas']['InjuryImpact']
export type Beneficiary = components['schemas']['Beneficiary']
export type CategoryGains = components['schemas']['CategoryGains']
export type TradeFeedback = components['schemas']['TradeFeedback']
export type TradeFeedbackRequest = components['schemas']['TradeFeedbackRequest']
export type FeedbackSource = TradeFeedbackRequest['source']
export type FeedbackReason = NonNullable<TradeFeedbackRequest['reasons']>[number]
export type FeedbackRating = TradeFeedbackRequest['rating']
export type TradeCheck = components['schemas']['TradeCheck']
export type CheckVerdict = components['schemas']['CheckVerdict']
export type NoteRead = components['schemas']['NoteRead']
export type TradeRule = components['schemas']['TradeRule']
export type TradeRuleKind = TradeRule['kind']
export type PlayerCard = components['schemas']['PlayerCard']
export type PlayerGame = components['schemas']['PlayerGame']
export type PlayerMove = components['schemas']['PlayerMove']
export type PlayerNews = components['schemas']['PlayerNews']
export type GameStats = components['schemas']['GameStats']

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
async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  creds: Credentials | null,
  timeoutMs?: number,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Cookies travel in headers only, never in the URL.
  if (creds) {
    headers['X-ESPN-S2'] = creds.espnS2
    headers['X-ESPN-SWID'] = creds.swid
  }
  const token = loadToken()
  if (token) headers.Authorization = `Bearer ${token}`
  // A request that never answers (a stalled cold start, a dropped connection) must not spin forever.
  const controller = timeoutMs ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    })
  } catch {
    if (controller?.signal.aborted) {
      throw new ApiError(0, 'timeout', 'The server took too long to answer. It may be waking up, so try again.')
    }
    throw new ApiError(0, 'network', 'Could not reach the analyzer server.')
  } finally {
    clearTimeout(timer)
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

function post<T>(path: string, body: unknown, creds: Credentials | null = null, timeoutMs?: number): Promise<T> {
  return request<T>('POST', path, body, creds, timeoutMs)
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

export interface AnalysisProgress {
  progress: number
  stage: string
}

const POLL_MS = 1500
// A phone that leaves the page (locks, switches apps) drops whatever request is in flight,
// and Render can answer 502/503 while it restarts. The job keeps running on the server, so
// a dropped poll is retried; only this many misses in a row, with the page open, ends the wait.
const POLL_MISSES = 6
const RETRY_MS = [1000, 2000, 4000, 8000, 15000]

/** A poll that failed on the way, not because the analysis failed. Worth asking again. */
export function isTransient(e: unknown) {
  if (!(e instanceof ApiError)) return true
  return e.status === 0 ? e.code !== 'aborted' : e.status === 502 || e.status === 503 || e.status === 504
}

function pageHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * Waits ``ms``, or until the page is visible again when it is hidden: a phone that comes
 * back to the app asks for news at once instead of finishing an old timer or a stale wait.
 */
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError(0, 'aborted', 'Cancelled.'))
      return
    }
    let id: ReturnType<typeof setTimeout> | undefined
    const done = () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
      signal?.removeEventListener('abort', onAbort)
    }
    const onVisible = () => {
      if (pageHidden()) return
      done()
      resolve()
    }
    const onAbort = () => {
      done()
      reject(new ApiError(0, 'aborted', 'Cancelled.'))
    }
    signal?.addEventListener('abort', onAbort)
    document.addEventListener('visibilitychange', onVisible)
    // A hidden page doesn't poll at all; it picks up where it left off when it's back.
    if (!pageHidden()) {
      id = setTimeout(() => {
        done()
        resolve()
      }, ms)
    }
  })
}

/**
 * Runs the team's analysis as a background job on the server and polls it until the
 * report is ready, reporting progress along the way. Nothing blocks while it runs.
 *
 * The server keeps one job per team and settings, so polling with the same body after a
 * dropped connection or a page reload picks up the same run instead of starting over.
 */
export async function fetchAnalysis(
  leagueId: number,
  teamId: number,
  season: number | null,
  keepPlayerIds: number[],
  creds: Credentials | null,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal,
): Promise<AnalysisReport> {
  const body = {
    league_id: leagueId,
    team_id: teamId,
    season,
    keep_player_ids: keepPlayerIds,
  }
  let misses = 0
  for (;;) {
    if (signal?.aborted) throw new ApiError(0, 'aborted', 'Cancelled.')
    let job: AnalysisJob
    try {
      // Each poll answers at once; the timeout only guards against a stalled connection.
      job = await post<AnalysisJob>('/api/analyze/job', body, creds, 90_000)
    } catch (e) {
      if (signal?.aborted || !isTransient(e)) throw e
      // Misses while the page is hidden don't count: the phone cut them, not the server.
      if (!pageHidden()) misses += 1
      if (misses >= POLL_MISSES) throw e
      await wait(RETRY_MS[Math.min(Math.max(misses - 1, 0), RETRY_MS.length - 1)], signal)
      continue
    }
    misses = 0
    if (job.status === 'done' && job.report) return job.report
    if (job.status === 'failed') {
      throw new ApiError(500, job.error?.code ?? 'analysis_failed', job.error?.message ?? 'The analysis failed.')
    }
    onProgress?.({ progress: job.progress, stage: job.stage })
    await wait(POLL_MS, signal)
  }
}

export function fetchShop(
  leagueId: number,
  teamId: number,
  season: number | null,
  offerPlayerIds: number[],
  keepPlayerIds: number[],
  creds: Credentials | null,
) {
  return post<ShopReport>(
    '/api/shop',
    {
      league_id: leagueId,
      team_id: teamId,
      season,
      offer_player_ids: offerPlayerIds,
      keep_player_ids: keepPlayerIds,
    },
    creds,
  )
}

export function fetchTradeOfTheDay(leagueId: number, season: number | null, creds: Credentials | null) {
  return post<TradeOfTheDay>('/api/trade-of-the-day', { league_id: leagueId, season }, creds)
}

export function voteTradeOfTheDay(
  vote: {
    leagueId: number
    season: number
    date: string
    teamId: number
    take: boolean
    voter: string
    pickId: string | null
  },
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
      pick_id: vote.pickId,
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
  return post<RepliesPage>('/api/feed/replies', {
    league_id: ref.leagueId,
    season: ref.season,
    target,
  })
}

export function createPost(ref: LeagueRef, body: string, target: string | null) {
  return post<FeedItem>('/api/posts', {
    league_id: ref.leagueId,
    season: ref.season,
    body,
    target,
  })
}

export function deletePost(ref: LeagueRef, postId: number) {
  return post<{ ok: boolean }>('/api/posts/delete', {
    league_id: ref.leagueId,
    season: ref.season,
    post_id: postId,
  })
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
    {
      league_id: leagueId,
      team_id: teamId,
      season,
      player_id: playerId,
      keep_player_ids: keepPlayerIds,
    },
    creds,
  )
}

// The free API server can take most of a minute to wake up; past that, show an error with a retry.
export const SCORES_TIMEOUT_MS = 60_000

export function fetchScores(
  leagueId: number,
  season: number | null,
  day: number | null,
  teamId: number | null,
  creds: Credentials | null,
) {
  return post<ScoreDay>('/api/scores', { league_id: leagueId, season, day, team_id: teamId }, creds, SCORES_TIMEOUT_MS)
}

export function fetchNews(leagueId: number, season: number | null, includeHeld: boolean, creds: Credentials | null) {
  return post<NewsPage>(
    '/api/news',
    { league_id: leagueId, season, include_held: includeHeld },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

export function fetchInjuryImpact(
  playerId: number,
  leagueId: number,
  season: number | null,
  creds: Credentials | null,
) {
  return post<InjuryImpact>(
    '/api/injury-impact',
    { player_id: playerId, league_id: leagueId, season },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

export function fetchPlayerCard(ref: LeagueRef, playerId: number, creds: Credentials | null) {
  return post<PlayerCard>(
    '/api/player-card',
    { league_id: ref.leagueId, season: ref.season, player_id: playerId },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

/** Who is giving trade feedback: the verified manager of ``teamId`` in this league. */
export interface FeedbackSeat extends LeagueRef {
  teamId: number
}

export function saveTradeFeedback(
  seat: FeedbackSeat,
  feedback: {
    source: FeedbackSource
    rating: FeedbackRating
    reasons: FeedbackReason[]
    text: string
    idea: TradeIdea
  },
) {
  return post<TradeFeedback>('/api/trade-feedback', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    ...feedback,
  })
}

export function fetchMyTradeFeedback(seat: FeedbackSeat) {
  return post<{ feedback: TradeFeedback[] }>('/api/trade-feedback/mine', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
  })
}

export function fetchMyTradeRules(seat: FeedbackSeat) {
  return post<{ rules: TradeRule[] }>('/api/trade-rules/mine', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
  })
}

export function addTradeRule(
  seat: FeedbackSeat,
  rule: { kind: TradeRuleKind; value?: string; team_name?: string; why?: string },
) {
  return post<TradeRule>('/api/trade-rules', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    ...rule,
  })
}

export function deleteTradeRule(seat: FeedbackSeat, ruleId: number) {
  return post<{ rules: TradeRule[] }>('/api/trade-rules/delete', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    rule_id: ruleId,
  })
}

export function checkTrade(seat: FeedbackSeat, idea: TradeIdea, reasons: FeedbackReason[], creds: Credentials | null) {
  return post<TradeCheck>(
    '/api/trade-check',
    {
      league_id: seat.leagueId,
      season: seat.season,
      team_id: seat.teamId,
      idea,
      reasons,
    },
    creds,
    SCORES_TIMEOUT_MS,
  )
}
