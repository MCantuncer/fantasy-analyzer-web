import type { components } from './schema'
import type { Credentials } from '../lib/credentials'
import { loadToken } from '../lib/session'

export type LeagueSummary = components['schemas']['LeagueSummary']
export type AnalysisReport = components['schemas']['AnalysisReport']
export type AnalysisJob = components['schemas']['AnalysisJob']
export type ReportChange = components['schemas']['ReportChange']
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
export type MatchupProjection = components['schemas']['MatchupProjection']
export type CrowdedDay = components['schemas']['CrowdedDay']
export type CategoryScore = components['schemas']['CategoryScore']
export type WeekGames = components['schemas']['WeekGames']
export type OverviewMatchup = components['schemas']['OverviewMatchup']
export type ShopReport = components['schemas']['ShopReport']
export type ShopDeal = components['schemas']['ShopDeal']
export type ShopTeam = components['schemas']['ShopTeam']
export type ShopTarget = components['schemas']['ShopTarget']
export type ScoreDay = components['schemas']['ScoreDay']
export type WeekRecap = components['schemas']['WeekRecap']
export type RecapPlayer = components['schemas']['RecapPlayer']
export type RecapTopPlayer = components['schemas']['RecapTopPlayer']
export type RecapFreeAgent = components['schemas']['RecapFreeAgent']
export type RecapAdd = components['schemas']['RecapAdd']
export type RecapAfter = components['schemas']['RecapAfter']
export type RecapTeam = components['schemas']['RecapTeam']
export type RecapSide = components['schemas']['RecapSide']
export type RecapMatchup = components['schemas']['RecapMatchup']
export type WeekTotals = components['schemas']['WeekTotals']
export type WeekSits = components['schemas']['WeekSits']
export type DayLineup = components['schemas']['DayLineup']
export type LineupSpot = components['schemas']['LineupSpot']
export type SeasonAverage = components['schemas']['SeasonAverage']
export type NextGame = components['schemas']['NextGame']
export type LineupDay = components['schemas']['LineupDay']
export type Game = components['schemas']['Game']
export type GameLine = components['schemas']['GameLine']
export type FixtureDay = components['schemas']['FixtureDay']
export type NewsPage = components['schemas']['NewsPage']
export type NewsCheck = components['schemas']['NewsCheck']
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
export type PlayerCardExtras = components['schemas']['PlayerCardExtras']
export type PlayerGame = components['schemas']['PlayerGame']
export type PlayerMove = components['schemas']['PlayerMove']
export type PlayerNews = components['schemas']['PlayerNews']
export type GameStats = components['schemas']['GameStats']
export type ErrorReport = components['schemas']['ErrorReport']
export type UsageReport = components['schemas']['UsageReport']
export type UsageDay = components['schemas']['UsageDay']

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

// Render's edge sometimes answers 502/503 for a few seconds, without CORS headers, so the browser
// reports it as unreachable; a phone or laptop coming back to the tab can also drop the first
// request. Reads ask again a few times before failing; writes never do, so a post isn't sent twice.
const READ_RETRY_MS = [500, 1500, 3000]

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  creds: Credentials | null,
  timeoutMs?: number,
  retries: readonly number[] = READ_RETRY_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce<T>(method, path, body, creds, timeoutMs)
    } catch (e) {
      const dropped = e instanceof ApiError && e.code !== 'timeout' && isTransient(e)
      if (!dropped || attempt >= retries.length) throw e
      await sleep(retries[attempt])
    }
  }
}

// Every call carries the signed-in account's token; ESPN cookies only when the league is private.
async function requestOnce<T>(
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

/** A read: asked again if Render or the network drops it. */
function post<T>(path: string, body: unknown, creds: Credentials | null = null, timeoutMs?: number): Promise<T> {
  return request<T>('POST', path, body, creds, timeoutMs)
}

/** A write (or a paid check): sent once, since a dropped request may still have reached the server. */
function send<T>(path: string, body: unknown, creds: Credentials | null = null, timeoutMs?: number): Promise<T> {
  return request<T>('POST', path, body, creds, timeoutMs, [])
}

export function fetchAuthConfig() {
  return request<AuthConfig>('GET', '/api/auth/config', null, null)
}

export function signUp(email: string, password: string) {
  return send<AuthResult>('/api/auth/signup', { email, password })
}

// Signing in is safe to ask again: a dropped first try at most leaves one unused session behind,
// and Render's brief 503s shouldn't greet someone with "Could not reach the analyzer server".
export function signIn(email: string, password: string) {
  return post<AuthResult>('/api/auth/login', { email, password })
}

export function signInWithGoogle(credential: string) {
  return post<AuthResult>('/api/auth/google', { credential })
}

export function signOut() {
  return send<{ ok: boolean }>('/api/auth/logout', {})
}

/** Admins only: the site's error reports, most recent first. */
export function fetchErrorReports() {
  return post<{ reports: ErrorReport[] }>('/api/admin/errors', {})
}

/** Admins only: marks a report fixed; it opens again if it happens again. */
export function resolveErrorReport(id: number) {
  return send<{ ok: boolean }>('/api/admin/errors/resolve', { id })
}

/** Admins only: daily visitors, page views and account totals. */
export function fetchUsage(days: number) {
  return post<UsageReport>('/api/admin/usage', { days })
}

/** Counts a page view for the usage numbers: the page name only, no ids. Never fails loudly. */
export function countPageView(page: string) {
  return send<{ ok: boolean }>('/api/usage', { page }).catch(() => undefined)
}

export function fetchMe() {
  return post<Me>('/api/me', {})
}

export function clearNotices() {
  return send<Me>('/api/me/notices/clear', {})
}

export function addLeague(leagueId: number, season: number | null, creds: Credentials | null) {
  return send<Me>('/api/my-leagues/add', { league_id: leagueId, season }, creds)
}

export function removeLeague(ref: LeagueRef) {
  return send<Me>('/api/my-leagues/remove', { league_id: ref.leagueId, season: ref.season })
}

export function fetchOverview(ref: LeagueRef, creds: Credentials | null) {
  return post<LeagueOverview>('/api/league-overview', { league_id: ref.leagueId, season: ref.season }, creds)
}

/** A finished week in review (Film Room); ``period`` null = the last finished week. 404 before any week is over. */
export function fetchRecap(ref: LeagueRef, period: number | null, creds: Credentials | null) {
  return post<WeekRecap>('/api/recap', { league_id: ref.leagueId, season: ref.season, period }, creds, RECAP_TIMEOUT_MS)
}

/** ``teamId``: the team to project, for one picked before verifying (the server defaults to the verified team). */
export function fetchMatchupProjection(ref: LeagueRef, creds: Credentials | null, teamId: number | null = null) {
  return post<MatchupProjection | null>(
    '/api/matchup-projection',
    { league_id: ref.leagueId, season: ref.season, team_id: teamId },
    creds,
  )
}

export function fetchLeague(leagueId: number, season: number | null, creds: Credentials | null) {
  return post<LeagueSummary>('/api/league', { league_id: leagueId, season }, creds)
}

export interface AnalysisProgress {
  progress: number
  stage: string
  /** The report so far while trades are still screened: free agents first, trade lists in ``pending``. */
  preview?: AnalysisReport | null
  /** The last saved report, shown while a new one is worked out because the league moved (or it got old). */
  saved?: AnalysisReport | null
  /** What moved since ``saved`` was built, your team's news first. */
  changes?: ReportChange[]
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

// Loading the account and the league rides out the same dropped requests: a phone that
// switches apps while the free server wakes up cuts the request, and Render can answer
// 502/503 while it starts. React Query holds a retry while the page is hidden and sends
// it as soon as the page is back, so only misses with the page open count.
const LOAD_RETRIES = 4

/** React Query ``retry`` for the account and league loads: ask again after a dropped request. */
export function retryDropped(failureCount: number, error: unknown) {
  return failureCount < LOAD_RETRIES && isTransient(error)
}

/** React Query ``retryDelay`` that backs off like the analysis poll. */
export function retryDroppedDelay(attempt: number) {
  return RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]
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
    onProgress?.({
      progress: job.progress,
      stage: job.stage,
      ...(job.preview ? { preview: job.preview } : {}),
      ...(job.saved ? { saved: job.saved } : {}),
      ...(job.changes?.length ? { changes: job.changes } : {}),
    })
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
  return send<TradeOfTheDay>(
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
  return send<LinkedTeam>('/api/team-link/verify', { challenge }, creds)
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
  return send<FeedItem>('/api/posts', {
    league_id: ref.leagueId,
    season: ref.season,
    body,
    target,
  })
}

export function deletePost(ref: LeagueRef, postId: number) {
  return send<{ ok: boolean }>('/api/posts/delete', {
    league_id: ref.leagueId,
    season: ref.season,
    post_id: postId,
  })
}

export function react(ref: LeagueRef, target: string, reaction: string, on: boolean, creds: Credentials | null) {
  return send<ReactionsOut>(
    '/api/reactions',
    { league_id: ref.leagueId, season: ref.season, target, reaction, on },
    creds,
  )
}

export type OfferCheck = components['schemas']['OfferCheck']
export type OfferCutOption = components['schemas']['OfferCutOption']
export type CategoryDetail = components['schemas']['CategoryDetail']
export type PlayoffWeek = components['schemas']['PlayoffWeek']

/** Check any trade with one team: the engine's verdict for both sides (about a second). */
export function fetchOfferCheck(
  ref: { leagueId: number; season: number | null; teamId: number },
  deal: { partner: number; give: number[]; get: number[]; mode: 'received' | 'sending'; cut: number | null },
  keepPlayerIds: number[],
  creds: Credentials | null,
) {
  return post<OfferCheck>(
    '/api/offer-check',
    {
      league_id: ref.leagueId,
      season: ref.season,
      team_id: ref.teamId,
      partner_team_id: deal.partner,
      give_player_ids: deal.give,
      get_player_ids: deal.get,
      my_drop_player_ids: deal.cut != null ? [deal.cut] : [],
      direction: deal.mode,
      keep_player_ids: keepPlayerIds,
    },
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
// A week's first Film Room is built from a week of rosters on the server (a few seconds, more on a cold start).
export const RECAP_TIMEOUT_MS = 60_000

export function fetchScores(
  leagueId: number,
  season: number | null,
  day: number | null,
  teamId: number | null,
  creds: Credentials | null,
) {
  return post<ScoreDay>(
    '/api/scores',
    { league_id: leagueId, season, day, team_id: teamId, with_sits: false },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

/** The day's games at once from the NBA calendar; scores and box scores only if the server already has them. */
export function fetchScoreGames(
  leagueId: number,
  season: number | null,
  day: number | null,
  teamId: number | null,
  creds: Credentials | null,
) {
  return post<ScoreDay>('/api/scores/games', { league_id: leagueId, season, day, team_id: teamId }, creds, SCORES_TIMEOUT_MS)
}

/** Who sits on each crowded day left this week: the slow part of the Scores page, fetched on its own. */
export function fetchScoreSits(leagueId: number, season: number | null, teamId: number, creds: Credentials | null) {
  return post<WeekSits>('/api/scores/sits', { league_id: leagueId, season, team_id: teamId }, creds, SCORES_TIMEOUT_MS)
}

/** Your lineup on a day, read fresh from ESPN (the server keeps it 30 s): who starts, who sits, each player's game. */
export function fetchLineup(
  leagueId: number,
  season: number | null,
  teamId: number,
  day: number | null,
  creds: Credentials | null,
) {
  return post<DayLineup>(
    '/api/scores/lineup',
    { league_id: leagueId, season, team_id: teamId, day },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

export function fetchNews(leagueId: number, season: number | null, includeHeld: boolean, creds: Credentials | null) {
  return post<NewsPage>(
    '/api/news',
    { league_id: leagueId, season, include_held: includeHeld },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

/** A reader's refresh: the server checks every news source now (at most once every 2 minutes for everyone). */
export function checkNews() {
  return send<NewsCheck>('/api/news/check', {})
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

/** What a player card shows first: header, form, games and moves. News comes from ``fetchPlayerCardExtras``. */
export function fetchPlayerCard(ref: LeagueRef, playerId: number, creds: Credentials | null) {
  return post<PlayerCard>(
    '/api/player-card',
    { league_id: ref.leagueId, season: ref.season, player_id: playerId, core: true },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

/** The rest of a player card, loaded alongside the core: his news and the names of who moved with him. */
export function fetchPlayerCardExtras(ref: LeagueRef, playerId: number, creds: Credentials | null) {
  return post<PlayerCardExtras>(
    '/api/player-card/extras',
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
  return send<TradeFeedback>('/api/trade-feedback', {
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
  return send<TradeRule>('/api/trade-rules', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    ...rule,
  })
}

export function deleteTradeRule(seat: FeedbackSeat, ruleId: number) {
  return send<{ rules: TradeRule[] }>('/api/trade-rules/delete', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    rule_id: ruleId,
  })
}

export function checkTrade(seat: FeedbackSeat, idea: TradeIdea, reasons: FeedbackReason[], creds: Credentials | null) {
  return send<TradeCheck>(
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
