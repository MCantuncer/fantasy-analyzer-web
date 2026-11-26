import type { components } from './schema'
import type { Credentials } from '../lib/credentials'
import { loadToken } from '../lib/session'
import type { BookCompare, BookRecord } from '../lib/iddaaCompare'
import type { MatchForm } from '../lib/matchForm'

export type LeagueSummary = components['schemas']['LeagueSummary']
export type AnalysisReport = components['schemas']['AnalysisReport']
export type AnalysisJob = components['schemas']['AnalysisJob']
export type SampleIndex = components['schemas']['SampleIndex']
export type SampleTeam = components['schemas']['SampleTeam']
export type CrazyOne = components['schemas']['CrazyOne']
export type ManagerStyles = components['schemas']['ManagerStyles']
export type ManagerStyleRow = components['schemas']['ManagerStyleRow']
export type WinPath = components['schemas']['WinPathOut']
export type MatchupCall = components['schemas']['MatchupCall']
export type CrazyGame = components['schemas']['CrazyGame']
export type CrazyRecord = components['schemas']['CrazyRecord']
export type CrazyBoom = components['schemas']['CrazyBoom']
export type CrazyBoomRecord = components['schemas']['CrazyBoomRecord']
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
export type PlanFeature = NonNullable<Me['features']>[number]
export type BillingConfig = components['schemas']['BillingConfig']
export type BillingInterval = components['schemas']['CheckoutRequest']['interval']
export type Keepers = components['schemas']['Keepers']
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
/**
 * His chance to play his next game (``spot.play``): null for a healthy player or once his game has
 * started. ``chance`` is the share of past players in his spot who played (NBA injury reports,
 * 2021-22 to 2025-26). The API types ``tag`` as text; these are the words it sends.
 */
export type PlayChance = Omit<components['schemas']['PlayChance'], 'tag'> & {
  tag: 'Probable' | 'Questionable' | 'Doubtful' | 'Available' | 'Out' | 'Day-to-day'
}
export type LineupSpot = Omit<components['schemas']['LineupSpot'], 'play'> & { play?: PlayChance | null }
export type DayLineup = Omit<components['schemas']['DayLineup'], 'spots'> & { spots: LineupSpot[] }
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
export type HotRun = components['schemas']['HotRun']
export type PlayerCardExtras = components['schemas']['PlayerCardExtras']
export type IndexedPlayer = components['schemas']['IndexedPlayer']
export type PlayerIndex = components['schemas']['PlayerIndex']
export type PlayerGame = components['schemas']['PlayerGame']
export type GameNote = components['schemas']['GameNote']
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
  /** The Pro feature a Free account asked for (402 ``upgrade_required``). */
  feature: PlanFeature | null

  constructor(status: number, code: string, message: string, feature: PlanFeature | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.feature = feature
  }
}

// Render's edge sometimes answers 502/503 for a few seconds, without CORS headers, so the browser
// reports it as unreachable; a phone or laptop coming back to the tab can also drop the first
// request. Reads ask again a few times before failing; writes never do, so a post isn't sent twice.
const READ_RETRY_MS = [500, 1500, 3000]

/** Waits ``ms``; a caller that gives up (``signal``) stops the wait at once. */
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError(0, 'aborted', 'Cancelled.'))
      return
    }
    const onAbort = () => {
      clearTimeout(id)
      reject(new ApiError(0, 'aborted', 'Cancelled.'))
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  creds: Credentials | null,
  timeoutMs?: number,
  retries: readonly number[] = READ_RETRY_MS,
  signal?: AbortSignal,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce<T>(method, path, body, creds, timeoutMs, signal)
    } catch (e) {
      const dropped = e instanceof ApiError && e.code !== 'timeout' && isTransient(e)
      if (!dropped || attempt >= retries.length) throw e
      await sleep(retries[attempt], signal)
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
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new ApiError(0, 'aborted', 'Cancelled.')
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
  // The caller's signal (react-query cancelling a stale search) aborts the same fetch.
  const controller = timeoutMs || signal ? new AbortController() : null
  let timedOut = false
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true
        controller?.abort()
      }, timeoutMs)
    : undefined
  const onAbort = () => controller?.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    })
  } catch {
    if (signal?.aborted) throw new ApiError(0, 'aborted', 'Cancelled.')
    if (timedOut) {
      throw new ApiError(0, 'timeout', 'The server took too long to answer. It may be waking up, so try again.')
    }
    throw new ApiError(0, 'network', 'Could not reach the analyzer server.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const detail = data?.detail
    if (detail && typeof detail === 'object' && 'code' in detail) {
      throw new ApiError(res.status, detail.code, detail.message, detail.feature ?? null)
    }
    throw new ApiError(res.status, 'http_error', `Request failed (HTTP ${res.status}).`)
  }
  return res.json() as Promise<T>
}

/** A read: asked again if Render or the network drops it. */
function post<T>(
  path: string,
  body: unknown,
  creds: Credentials | null = null,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>('POST', path, body, creds, timeoutMs, READ_RETRY_MS, signal)
}

/** A write (or a paid check): sent once, since a dropped request may still have reached the server. */
function send<T>(path: string, body: unknown, creds: Credentials | null = null, timeoutMs?: number): Promise<T> {
  return request<T>('POST', path, body, creds, timeoutMs, [])
}

/**
 * A public read for visitors who haven't signed in: no token, no cookies, no JSON header, so the
 * browser sends a plain GET (no CORS preflight) and may serve it from its cache.
 */
async function publicGet<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      let res: Response
      try {
        res = await fetch(`${BASE}${path}`)
      } catch {
        throw new ApiError(0, 'network', 'Could not reach the analyzer server.')
      }
      if (!res.ok) {
        const detail = (await res.json().catch(() => null))?.detail
        if (detail && typeof detail === 'object' && 'code' in detail) {
          throw new ApiError(res.status, detail.code, detail.message, detail.feature ?? null)
        }
        throw new ApiError(res.status, 'http_error', `Request failed (HTTP ${res.status}).`)
      }
      return (await res.json()) as T
    } catch (e) {
      if (!(e instanceof ApiError) || !isTransient(e) || attempt >= READ_RETRY_MS.length) throw e
      await sleep(READ_RETRY_MS[attempt])
    }
  }
}

/** The sample league shown before sign-in: masked teams and the one to scout first. 404 `sample_off` when there is none. */
export function fetchSample() {
  return publicGet<SampleIndex>('/api/sample')
}

/** One sample team's analysis, team names masked. `day` is the index's `analysed_on`, so every team comes from one run. */
export function fetchSampleTeam(teamId: number, day: string) {
  return publicGet<AnalysisReport>(`/api/sample/teams/${teamId}?day=${encodeURIComponent(day)}`)
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

// Both are sent once: a repeat would count against the hourly limit, and a reset link works only once.
export function forgotPassword(email: string) {
  return send<{ ok: boolean }>('/api/auth/forgot', { email })
}

export function resetPassword(token: string, password: string) {
  return send<AuthResult>('/api/auth/reset', { token, password })
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

/** Our estimates beside the sportsbook's lines for one night (the latest when no day), each judged against the result once final. */
export function fetchBookCompare(day: number | null) {
  return post<BookCompare>('/api/book-compare', day == null ? {} : { day })
}

/** Crazy One's World: its call for each game of a night (the latest when no day) beside Our call, the
 *  beliefs that moved it and its record against Our call. A persona's numbers, never Our call. */
export function fetchCrazyOne(day: number | null) {
  return post<CrazyOne>('/api/crazy-one', day == null ? {} : { day })
}

/** Both teams' games this season (newest first, no preseason) with each game's MVP and type, and their
 *  next meeting: the match card's Form view. A cold server may read a few weeks of days first. */
export function fetchMatchForm(away: string, home: string) {
  return post<MatchForm>('/api/match-form', { away, home }, null, SCORES_TIMEOUT_MS)
}

// Results move once a night: a few minutes keeps reopening the card instant without going stale.
export function matchFormQuery(away: string, home: string) {
  return {
    queryKey: ['match-form', away.toUpperCase(), home.toUpperCase()],
    queryFn: () => fetchMatchForm(away, home),
    retry: 1,
    staleTime: 5 * 60_000,
  }
}

/** The running record of the value rungs over the latest saved nights (the server's default, 30, when unset). */
export function fetchBookRecord(nights?: number) {
  return post<BookRecord>('/api/book-compare/record', nights == null ? {} : { nights })
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

/** What the site needs to open Paddle's checkout (public; ``enabled`` false until Paddle is set up). */
export function fetchBillingConfig() {
  return publicGet<BillingConfig>('/api/billing/config')
}

/** A Paddle transaction for this account and interval: open Paddle's checkout on its id. */
export function startCheckout(interval: BillingInterval) {
  return send<components['schemas']['CheckoutStart']>('/api/billing/checkout', { interval })
}

/** Right after checkout: the server reads the payment from Paddle, so Pro opens before the webhook lands. */
export function syncBilling(transactionId: string) {
  return send<Me>('/api/billing/sync', { transaction_id: transactionId })
}

/** Paddle's customer portal for this account: card, invoices, cancel. */
export function openBillingPortal() {
  return send<components['schemas']['BillingPortal']>('/api/billing/portal', {})
}

/** Admin: give an account Pro for ``days`` from now (0 ends the gift). */
export function giftPro(email: string, days: number) {
  return send<components['schemas']['GiftProResult']>('/api/admin/gift-pro', { email, days })
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

/** How each manager plays this season, your win path and this week's category calls (cold: ~10 s). */
export function fetchManagerStyles(ref: LeagueRef, creds: Credentials | null) {
  return post<ManagerStyles>('/api/manager-styles', { league_id: ref.leagueId, season: ref.season }, creds, STYLES_TIMEOUT_MS)
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
  signal?: AbortSignal,
) {
  // Sorted, so {Allen, Mitchell} and {Mitchell, Allen} hit the same report in the server's cache.
  const byId = (ids: number[]) => [...ids].sort((a, b) => a - b)
  return post<ShopReport>(
    '/api/shop',
    {
      league_id: leagueId,
      team_id: teamId,
      season,
      offer_player_ids: byId(offerPlayerIds),
      keep_player_ids: byId(keepPlayerIds),
    },
    creds,
    undefined,
    signal,
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
  signal?: AbortSignal,
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
    undefined,
    signal,
  )
}

// The free API server can take most of a minute to wake up; past that, show an error with a retry.
export const SCORES_TIMEOUT_MS = 60_000
// A week's first Film Room is built from a week of rosters on the server (a few seconds, more on a cold start).
export const RECAP_TIMEOUT_MS = 60_000
/** Manager styles read every day of the season on a cold start. */
export const STYLES_TIMEOUT_MS = 60_000

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

/** One stat line of a player's estimate for a game (the API's NextGameStats). */
export interface PregameStats {
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  three_pm: number
  to: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  fg_pct: number | null
  ft_pct: number | null
}

/** One thing that moved a player's line, in the units of each stat (fg_pct as a share). */
export interface PregameReason {
  kind: string
  text: string
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  three_pm: number
  to: number
  fg_pct: number
  value: number
}

export interface PregameLine extends PregameStats {
  opponent?: string | null
  home?: boolean | null
  tip?: string | null
  usual?: PregameStats | null
  reasons?: PregameReason[]
}

export interface PregamePlayer {
  player_id: number
  name: string
  injury_status: string
  owner_team_id: number | null
  /** False: a rotation player outside the league's own list, read for this box only. */
  in_pool: boolean
  line: PregameLine
}

export interface PregameSide {
  pro_team_id: number
  abbrev: string
  name: string
  call: number
  call_raw: number
  parts: {
    ratings: number
    level: number
    home: number
    opp_three_luck: number
    own_three_luck: number
    back_to_back: number
    possessions: number
    offense: number
    defense_allowed: number
    league: number
    points_a_game: number
  }
  players: PregamePlayer[]
  out: { player_id: number; name: string; injury_status: string; owner_team_id: number | null }[]
  team_line: { shown: number; rest: number; total: number; call: number; gap: number }
  /** Points by quarter (api app/quarters.py); missing from an API before it. */
  quarters?: PregameQuarters | null
}

/** One side's points by quarter before tip-off: Our call cut into four, and what moved each quarter. */
export interface PregameQuarters {
  /** Whole points Q1-Q4; they add up to the rounded sum of raw (about a point under the call: overtime). */
  points: number[]
  raw: number[]
  /** The call x the league's share of a game's points in each quarter. */
  league: number[]
  /** The favourite's fast start and 4th-quarter fade (the underdog the other way). */
  favourite: number[]
  /** The team's own quarter habit and what the opponent allows. */
  shape: number[]
  /** This season's games in the habit (0: last season's alone). */
  games: number
}

export type PregameTermKind = 'matchup' | 'home_court' | 'three_point_luck' | 'back_to_back'

/** A game before tip-off (POST /api/scores/pregame): Our call piece by piece and every player's line. */
export interface PregameBox {
  league_id: number
  season: number
  day: number
  game_id: number
  start: string
  status: 'scheduled' | 'live' | 'final'
  chance: number
  pick: 'away' | 'home'
  margin: number
  margin_raw: number
  terms: { kind: PregameTermKind; points: number; raw: number }[]
  away: PregameSide
  home: PregameSide
}

/** One game before tip-off: why Our call, every player expected to play and his line. 409 until the box is built. */
export function fetchPregame(
  leagueId: number,
  season: number | null,
  gameId: number,
  day: number | null,
  creds: Credentials | null,
) {
  return post<PregameBox>(
    '/api/scores/pregame',
    { league_id: leagueId, season, game_id: gameId, day },
    creds,
    SCORES_TIMEOUT_MS,
  )
}

/** One player in a game in progress (POST /api/scores/live-lines). */
export interface LivePlayerLine {
  player_id: number
  name: string
  pro_team_id: number
  pts: number
  minutes: number
  line_pts: number
  line_minutes: number
  /** Where his points land at the end of regulation, from here. */
  final: number
  rest: number
  minutes_left: number
  /** Personal fouls so far; null when ESPN's box can't be read. */
  fouls?: number | null
}

/** One side's quarters in a game in progress. */
export interface LiveQuarterSide {
  pro_team_id: number
  /** Our Q1-Q4 before tip-off. */
  pregame: number[]
  /** Real points of each regulation quarter started; the one in progress last. */
  real: number[]
  /** Q1-Q4 now: real when played, real so far plus the rest in progress, our number moved by the score after. */
  live: number[]
  /** Team fouls in the quarter in progress; null when not known. */
  fouls?: number | null
  /** The other side is in the penalty: each foul gives this side free throws. Null when not known. */
  bonus?: boolean | null
}

export interface LiveQuarters {
  period: number
  away: LiveQuarterSide
  home: LiveQuarterSide
}

/** A game in progress: each player's live line, and how far finals land from it at this point. */
export interface LiveLines {
  league_id: number
  season: number
  day: number
  game_id: number
  status: 'scheduled' | 'live' | 'final'
  clock: string | null
  elapsed: number | null
  half_within: number
  most_within: number
  lines: LivePlayerLine[]
  quarters?: LiveQuarters | null
}

/** A game in progress: where each player's night ends (Pro). Empty lines before tip-off or without a clock. */
export function fetchLiveLines(
  leagueId: number,
  season: number | null,
  gameId: number,
  day: number | null,
  creds: Credentials | null,
) {
  return post<LiveLines>(
    '/api/scores/live-lines',
    { league_id: leagueId, season, game_id: gameId, day },
    creds,
    SCORES_TIMEOUT_MS,
  )
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

/** Every NBA player with who has him in this league, for the header search (filtered on the device). */
export function fetchPlayerIndex(ref: LeagueRef, creds: Credentials | null) {
  return post<PlayerIndex>('/api/players/index', { league_id: ref.leagueId, season: ref.season }, creds)
}

export interface TeamScorer {
  player_id: number
  name: string
  pts: number
  reb: number
  ast: number
}

export interface TeamResult {
  game_id: number
  date: string | null
  start: string
  home: boolean
  opponent: string
  opponent_name: string
  points: number
  opponent_points: number
  won: boolean
  /** This team's top scorer in the game. */
  top: TeamScorer | null
}

/** An NBA team at a glance, for the team card: the roster comes from the player index. */
export interface NbaTeamInfo {
  abbrev: string
  name: string
  wins: number
  losses: number
  /** "W3" for three wins in a row; null before the first game. */
  streak: string | null
  /** The last five results, most recent first. */
  latest: TeamResult[]
  next_game: { start: string; home: boolean; opponent: string; opponent_name: string } | null
}

export function fetchNbaTeam(ref: LeagueRef, abbrev: string, creds: Credentials | null) {
  return post<NbaTeamInfo>(
    '/api/nba-team',
    { league_id: ref.leagueId, season: ref.season, team: abbrev },
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

/** The players this account keeps on its team. They follow the account to every device. */
export function fetchKeepers(seat: FeedbackSeat) {
  return post<Keepers>('/api/keepers', { league_id: seat.leagueId, season: seat.season, team_id: seat.teamId })
}

export function saveKeepers(seat: FeedbackSeat, playerIds: number[]) {
  return send<Keepers>('/api/keepers/save', {
    league_id: seat.leagueId,
    season: seat.season,
    team_id: seat.teamId,
    player_ids: playerIds,
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
