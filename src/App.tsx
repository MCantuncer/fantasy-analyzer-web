import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  fetchAnalysis,
  fetchKeepers,
  fetchLeague,
  fetchMe,
  addLeague,
  fetchOverview,
  fetchSample,
  retryDropped,
  retryDroppedDelay,
  saveKeepers,
  signOut,
} from './api/client'
import type { AnalysisProgress, AnalysisReport, AuthResult, MyLeague, ReportChange } from './api/client'
import { CourtMark, type CourtMarkHandle } from './components/CourtMark'
import { useCourtReveal } from './lib/useCourtReveal'
import { AnalysisCard, AnalysisPill, ReadyToast } from './components/AnalysisProgress'
import { LeaguesSkeleton } from './components/Skeleton'
import { percent, useSmoothProgress } from './lib/progress'
import { Auth } from './components/Auth'
import { SignInHero } from './components/SignInHero'
import { ResetPassword } from './components/ResetPassword'
import { JoinSheet, type PendingLeague } from './components/JoinSheet'
import { OpenCrest } from './components/OpenCrest'
import { SamplePage } from './components/Sample'
import { SampleSwitcher } from './components/SampleSwitcher'
import { CookieForm } from './components/CookieForm'
import { LeagueChat } from './components/LeagueChat'
import { LeagueOverview } from './components/LeagueOverview'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { MyLeagues } from './components/MyLeagues'
import { SiteHealth } from './components/SiteHealth'
import { News } from './components/News'
import { PlayerCardHost } from './components/PlayerCard'
import { Report, TABS } from './components/Report'
import type { Tab } from './components/Report'
import { Scores } from './components/Scores'
import { SectionNav } from './components/SectionNav'
import { VerifyTeam } from './components/VerifyTeam'
import { SeatNote } from './components/SeatNote'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/credentials'
import type { Credentials } from './lib/credentials'
import { clearSavedReports, loadSavedReport, saveReport } from './lib/savedReport'
import { usePickedTeam } from './lib/pickedTeam'
import { loadKeep, settleKeepers, storeKeep } from './lib/keepers'
import { clearPages, prefetchPages, restorePages, savePages } from './lib/pageCache'
import { clearToken, loadToken, saveToken } from './lib/session'
import { readResetToken } from './lib/resetLink'
import { applyTheme, loadTheme } from './lib/theme'
import type { Theme } from './lib/theme'
import { RoundValuesContext } from './lib/tradeValue'
import { teamColours, tonightMatchup } from './lib/league'
import { useTabInView } from './lib/useTabInView'
import { pageName, usePageView } from './lib/pageView'
import { CHECK_PARAM } from './lib/tradeCheck'
import { SCOUT_PARAM, scoutOf, scoutWanted } from './lib/sample'

interface Selection {
  leagueId: number
  season: number | null
}

// Before verifying, a league shows only league-wide pages.
const LEAGUE_TABS = [
  { id: 'overview', label: 'League' },
  { id: 'feed', label: 'Moves Feed' },
  { id: 'news', label: 'NBA News' },
] as const

// Tabs that show the analysis; the rest work while it runs.
const ANALYSIS_TABS = new Set(['moves', 'park', 'trade-for', 'team'])

/** The league news since the report on screen was built, and that report (what the moves are compared with). */
interface NewsSnapshot {
  before: AnalysisReport | null
  changes: ReportChange[]
}
const NO_NEWS: NewsSnapshot = { before: null, changes: [] }

const ALL_TABS: readonly { id: string; label: string }[] = [...TABS, ...LEAGUE_TABS]

// Read once, before the first render writes the URL (StrictMode runs state initialisers twice).
const linkedReset = readResetToken()

function readUrl(): {
  selection: Selection | null
  tab: string
  verifying: boolean
  film: number | null | undefined
  health: boolean
} {
  const q = new URLSearchParams(window.location.search)
  const league = Number(q.get('league'))
  const season = Number(q.get('season'))
  return {
    selection: league > 0 ? { leagueId: league, season: season > 0 ? season : null } : null,
    tab: ALL_TABS.find((t) => t.id === q.get('tab'))?.id ?? '',
    verifying: q.get('view') === 'verify',
    film: q.get('film') === 'last' ? null : Number(q.get('film')) > 0 ? Number(q.get('film')) : undefined,
    health: league <= 0 && q.get('view') === 'health',
  }
}

// Only IDs go in the URL, never cookies or tokens.
function writeUrl(
  selection: Selection | null,
  tab: string,
  verifying: boolean,
  film: number | null | undefined,
  health: boolean,
  scout: number | null = null,
) {
  const q = new URLSearchParams()
  if (!selection && health) q.set('view', 'health')
  if (!selection && scout != null) q.set(SCOUT_PARAM, String(scout))
  if (selection) q.set('league', String(selection.leagueId))
  if (selection?.season) q.set('season', String(selection.season))
  if (selection && verifying) q.set('view', 'verify')
  else if (selection && tab) q.set('tab', tab)
  if (selection && !verifying && film !== undefined) q.set('film', film === null ? 'last' : String(film))
  // Trade Park's check keeps its own deal in the URL (see TradeCheck); carry it while that tab is open.
  const check = new URLSearchParams(window.location.search).get(CHECK_PARAM)
  if (selection && !verifying && tab === 'park' && check) q.set(CHECK_PARAM, check)
  const search = q.toString()
  window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
}

export default function App() {
  const initial = readUrl()
  const qc = useQueryClient()
  const [signedIn, setSignedIn] = useState(() => loadToken() !== null)
  // An emailed reset link opened this tab: its own page until the password is set or they leave.
  const [resetToken, setResetToken] = useState<string | null>(linkedReset)
  useEffect(() => {
    // The link pasted into a tab that already has COURT open changes only the hash: no reload.
    const onHash = () => {
      const token = readResetToken()
      if (token) setResetToken(token)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [selection, setSelection] = useState<Selection | null>(initial.selection)
  const [tab, setTab] = useState<string>(initial.tab)
  const [verifying, setVerifying] = useState(initial.verifying)
  // Film Room week on the League tab (null = last finished week); undefined = the overview.
  const [film, setFilm] = useState<number | null | undefined>(initial.film)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
  const [keep, setKeep] = useState<number[]>([])
  const [appliedKeep, setAppliedKeep] = useState<number[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [job, setJob] = useState<AnalysisProgress>({ progress: 0, stage: 'Starting' })
  const [readyToast, setReadyToast] = useState(false)
  // What moved in the league since the report on screen was built (from the server's saved report).
  // ``before`` is the report the changes are measured from, so the card can say which moves changed.
  const [since, setSince] = useState<NewsSnapshot>(NO_NEWS)
  const running = useRef<AbortController | null>(null)
  // Bumped by the top bar's "Add a league" so My leagues focuses its add box.
  const [focusAdd, setFocusAdd] = useState(0)
  // The team the verify page opens on: the one already picked, when "Verify" was pressed for it.
  const [verifyTeam, setVerifyTeam] = useState<number | null>(null)
  // Site health (admins only) stands in for My leagues while it is open.
  const [health, setHealth] = useState(initial.health)
  // Signed out: the sample league, scouting one team. A door opens the join sheet over it.
  const [joining, setJoining] = useState<'signup' | 'signin' | null>(null)
  // A league pasted in the join sheet that couldn't be added straight away (a private one): My leagues starts with it.
  const [pendingInput, setPendingInput] = useState('')
  const [scoutId, setScoutId] = useState<number | null>(() => scoutWanted())
  const sample = useQuery({
    queryKey: ['sample'],
    queryFn: fetchSample,
    enabled: !signedIn,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const scouting = !signedIn && sample.data ? sample.data : null
  const scout = scouting ? scoutOf(scouting, scoutId) : null
  const closeJoin = useCallback(() => setJoining(null), [])

  useEffect(
    () => writeUrl(selection, tab, verifying, film, health, scout?.id ?? null),
    [selection, tab, verifying, film, health, scout?.id],
  )
  // Scores, NBA News and League Chat show their last answer at once and refresh underneath.
  const isPrivate = useRef(creds !== null)
  isPrivate.current = creds !== null
  useState(() => restorePages(qc)) // before the first render, so a page opened by URL starts filled
  useEffect(() => savePages(qc, () => isPrivate.current), [qc])
  useEffect(() => applyTheme(theme), [theme])

  const me = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: signedIn,
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 60_000,
  })
  // A session the server no longer knows (signed out elsewhere, expired): back to sign-in.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) endSession()
  })

  const mine = me.data?.leagues.find(
    (l) => l.league_id === selection?.leagueId && (!selection?.season || l.season === selection.season),
  )
  const season = selection?.season ?? mine?.season ?? null

  const overview = useQuery({
    queryKey: ['overview', selection?.leagueId, season, creds?.swid ?? null],
    queryFn: () => fetchOverview({ leagueId: selection!.leagueId, season: season! }, creds),
    enabled: signedIn && selection !== null,
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 2 * 60_000,
  })
  // A manager sees their moves before the ESPN code check: the team they picked stands in for the
  // verified one until then. It only counts while nobody has verified that team.
  const verifiedTeamId = overview.data?.my_team_id ?? null
  const [storedPick, setPick] = usePickedTeam(overview.data?.league_id, overview.data?.season)
  const pickedTeamId =
    verifiedTeamId === null && overview.data?.teams.some((t) => t.id === storedPick && !t.has_manager)
      ? storedPick
      : null
  const myTeamId = verifiedTeamId ?? pickedTeamId
  // What the pages see: the picked team marked as yours, so highlights and "your matchup" work.
  const seatOverview = useMemo(() => {
    const o = overview.data
    if (!o || pickedTeamId === null) return o
    return { ...o, my_team_id: pickedTeamId, teams: o.teams.map((t) => ({ ...t, mine: t.id === pickedTeamId })) }
  }, [overview.data, pickedTeamId])
  const ref = overview.data ? { leagueId: overview.data.league_id, season: overview.data.season } : null

  // Once the league is in, fetch the first screen of the "While you wait" pages in the
  // background, so opening one of them during the analysis finds it ready.
  const refLeague = ref?.leagueId
  const refSeason = ref?.season
  useEffect(() => {
    if (refLeague === undefined || refSeason === undefined) return
    prefetchPages(qc, { leagueId: refLeague, season: refSeason }, myTeamId, creds)
  }, [qc, refLeague, refSeason, myTeamId, creds])

  // The analysis is for the team this account verified, or picked before verifying.
  const league = useQuery({
    queryKey: ['league', selection?.leagueId, season, creds?.swid ?? null],
    queryFn: () => fetchLeague(selection!.leagueId, season, creds),
    enabled: myTeamId !== null,
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 5 * 60_000,
  })

  const analysis = useMutation({
    // ``quiet`` runs refresh a saved report that is already on screen.
    mutationFn: (args: { teamId: number; keep: number[]; quiet?: boolean }) => {
      // A newer run (another league, new keepers) replaces the one in flight.
      running.current?.abort()
      const controller = new AbortController()
      running.current = controller
      setJob({ progress: 0, stage: 'Starting' })
      return fetchAnalysis(selection!.leagueId, args.teamId, season, args.keep, creds, setJob, controller.signal)
    },
    onSuccess: (data, args) => {
      setReport(data)
      setAppliedKeep(args.keep)
      saveReport(data.league.id, args.teamId, args.keep, data)
    },
  })
  const shownProgress = useSmoothProgress(job.progress, analysis.isPending)

  // The Moves page opens as soon as there is something to show: the server's last saved report
  // (out of date, so it is being worked out again), else the free agents while trades are screened.
  // A report already on screen (a saved one being refreshed) stays until the new one is complete.
  const early = job.saved ?? job.preview
  useEffect(() => {
    if (early && !report && analysis.isPending && early.league.id === selection?.leagueId) setReport(early)
  }, [early, report, analysis.isPending, selection?.leagueId])
  const changes = job.changes
  const savedBefore = job.saved
  useEffect(() => {
    if (changes?.length && analysis.isPending)
      setSince((prev) => (prev.changes === changes ? prev : { before: savedBefore ?? null, changes }))
  }, [changes, savedBefore, analysis.isPending])

  const { mutate } = analysis
  const leagueReady = league.isSuccess && league.data.supported
  useEffect(() => {
    if (!selection || !myTeamId || !leagueReady) return
    const stored = loadKeep(selection.leagueId, myTeamId)
    setKeep(stored)
    // A refresh shows the last finished report at once, and always asks the server too: it answers
    // at once when nothing in the league moved, and says what did (an injury, a trade) when it did.
    const saved = loadSavedReport(selection.leagueId, myTeamId, selection.season, stored)
    setReport(saved?.report ?? null)
    setSince(NO_NEWS)
    if (saved) setAppliedKeep(stored)
    mutate({ teamId: myTeamId, keep: stored, quiet: saved !== null })
  }, [selection, myTeamId, leagueReady, mutate])

  // Keepers live with the account. The run above starts on this browser's copy; when the account's
  // list differs (keepers chosen on another device), it replaces the copy and the analysis runs again.
  const leagueId = selection?.leagueId ?? null
  const keepersKey = useMemo(() => ['keepers', leagueId, season, myTeamId], [leagueId, season, myTeamId])
  const accountKeepers = useQuery({
    queryKey: keepersKey,
    queryFn: () => fetchKeepers({ leagueId: leagueId!, season: season!, teamId: myTeamId! }),
    enabled: signedIn && leagueId !== null && season !== null && myTeamId !== null && leagueReady,
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: Infinity,
  })
  const fromAccount = accountKeepers.data
  useEffect(() => {
    if (!fromAccount || leagueId === null || season === null || myTeamId === null) return
    const settled = settleKeepers(loadKeep(leagueId, myTeamId), fromAccount)
    if (settled.upload) {
      // Chosen before keepers were saved to accounts: hand them over once. A failed save tries again next visit.
      saveKeepers({ leagueId, season, teamId: myTeamId }, settled.keep)
        .then((saved) => qc.setQueryData(keepersKey, saved))
        .catch(() => {})
    }
    if (!settled.changed) return
    storeKeep(leagueId, myTeamId, settled.keep)
    setKeep(settled.keep)
    mutate({ teamId: myTeamId, keep: settled.keep })
  }, [fromAccount, leagueId, season, myTeamId, keepersKey, qc, mutate])

  const loadError = [overview.error, league.error].find((e) => e instanceof ApiError) as ApiError | undefined
  const needsCookies = loadError?.code === 'private_league'
  // ``seated``: there is a team to analyse. ``verified``: the account proved it on ESPN (chat, feedback, rules).
  const seated = myTeamId !== null
  const verified = verifiedTeamId !== null
  const tabs: readonly { id: string; label: string }[] = seated ? TABS : LEAGUE_TABS
  const activeTab = tabs.find((t) => t.id === tab)?.id ?? tabs[0].id
  const waitingForReport = seated && !report
  // Until the first report is in, the analysis tabs have nothing to show: the loading card
  // stands alone, and browsing from it offers only the pages that work meanwhile.
  const browseTabs = waitingForReport ? tabs.filter((t) => !ANALYSIS_TABS.has(t.id)) : tabs
  const showTabs =
    selection && !verifying && overview.data && !(waitingForReport && ANALYSIS_TABS.has(activeTab))
  const tabsRef = useTabInView(showTabs ? activeTab : null)
  usePageView(
    health
      ? null
      : pageName({
          signedIn,
          hasLeague: selection !== null,
          leagueReady: !!overview.data,
          verifying,
          tab: activeTab,
          filmOpen: film !== undefined,
        }),
  )
  const tradesPending = !!report?.pending?.length
  const firstRun = (waitingForReport || tradesPending) && analysis.isPending
  // Between the league answering and the analysis starting there is nothing new to show,
  // so the loading card stays up instead of blanking the page for a moment.
  const preparing =
    waitingForReport &&
    ANALYSIS_TABS.has(activeTab) &&
    !analysis.error &&
    !league.error &&
    league.data?.supported !== false &&
    (league.isLoading || analysis.isPending || analysis.isIdle)

  // Someone who wandered off to another tab hears when their moves are in.
  const activeRef = useRef(activeTab)
  activeRef.current = activeTab
  const wasFirstRun = useRef(false)
  useEffect(() => {
    if (wasFirstRun.current && !firstRun && report && !ANALYSIS_TABS.has(activeRef.current)) setReadyToast(true)
    wasFirstRun.current = firstRun
  }, [firstRun, report])

  function openVerify(teamId: number | null = null) {
    setVerifyTeam(teamId)
    setVerifying(true)
  }

  // The picked team got its verified manager meanwhile: its moves are theirs alone now, so drop the pick.
  const pickClosed =
    pickedTeamId !== null && analysis.error instanceof ApiError && analysis.error.code === 'not_your_team'
  useEffect(() => {
    if (!pickClosed) return
    setPick(null)
    setReport(null)
    qc.invalidateQueries({ queryKey: ['overview'] })
  }, [pickClosed, setPick, qc])

  function signedInWith(result: AuthResult) {
    saveToken(result.token)
    qc.setQueryData(['me'], result.me)
    setSignedIn(true)
    setJoining(null)
  }

  // Signed up (or in) from the sample's join sheet: straight into the league they pasted, at the team check.
  function joinWith(result: AuthResult, league: PendingLeague | null) {
    signedInWith(result)
    if (!league) return
    addLeague(league.leagueId, league.season, null)
      .then((next) => {
        qc.setQueryData(['me'], next)
        const added = next.leagues.find((l) => l.league_id === league.leagueId)
        if (!added) return setPendingInput(league.input)
        openLeague(added)
        openVerify()
      })
      .catch(() => setPendingInput(league.input)) // a private league: My leagues asks for the cookies
  }

  function endSession() {
    clearToken()
    clearSavedReports()
    clearPages()
    qc.clear()
    setSignedIn(false)
    goHome()
  }

  function stopAnalysis() {
    running.current?.abort()
    running.current = null
    analysis.reset()
    setReadyToast(false)
  }

  function openLeague(l: MyLeague) {
    setHealth(false)
    setSelection({ leagueId: l.league_id, season: l.season })
    setTab('')
    setVerifying(false)
    setFilm(undefined)
    setReport(null)
    setSince(NO_NEWS)
    stopAnalysis()
  }

  const brandRef = useRef<HTMLButtonElement>(null)
  const markRef = useRef<CourtMarkHandle>(null)
  const reveal = useCourtReveal(markRef, brandRef)

  function goHome() {
    setHealth(false)
    setSelection(null)
    setFocusAdd(0)
    setVerifying(false)
    setFilm(undefined)
    setReport(null)
    stopAnalysis()
  }

  function toggleKeep(id: number) {
    if (!selection || !myTeamId) return
    const next = keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id]
    setKeep(next)
    storeKeep(selection.leagueId, myTeamId, next)
    if (season === null) return
    // The account's copy follows; this browser already has the new list either way.
    qc.setQueryData(keepersKey, { player_ids: next, saved: true })
    saveKeepers({ leagueId: selection.leagueId, season, teamId: myTeamId }, next).catch(() => {})
  }

  // The sign-in page already spells COURT out in its hero, so the top-bar ball stays a ball there.
  const heroShown = !signedIn && !scouting && !(sample.isPending && joining === null)
  const brandReveal = heroShown ? undefined : reveal

  const keepChanged = [...keep].sort().join(',') !== [...appliedKeep].sort().join(',')
  const leagueName = overview.data?.name ?? mine?.name
  const teamName = overview.data?.teams.find((t) => t.id === myTeamId)?.name

  const themeButton = (
    <button
      className="icon"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path
            d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M14.5 11.5A6.5 6.5 0 0 1 6.5 3.5a6.5 6.5 0 1 0 8 8z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      )}
    </button>
  )

  if (resetToken) {
    const leaveReset = () => {
      setResetToken(null)
      if (!signedIn) setJoining('signin')
    }
    return (
      <>
        <header className="topbar">
          <div className="topbar-inner">
            <button ref={brandRef} className="brand" onClick={leaveReset} aria-label="COURT, sign in">
              <CourtMark ref={markRef} veil />
            </button>
            <div className="topbar-actions">{themeButton}</div>
          </div>
        </header>
        <main className="main">
          <div className="signin-page">
            <SignInHero />
            <ResetPassword
              token={resetToken}
              theme={theme}
              onSignedIn={(result) => {
                // Whoever was signed in on this device before is signed out by the reset.
                qc.clear()
                signedInWith(result)
                setResetToken(null)
              }}
              onLeave={leaveReset}
            />
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            ref={brandRef}
            className="brand"
            onClick={() => {
              goHome() // navigation never waits for the animation
              brandReveal?.playOnce()
            }}
            onPointerEnter={brandReveal?.onPointerEnter}
            onPointerLeave={brandReveal?.onPointerLeave}
            onFocus={brandReveal?.onFocus}
            onBlur={brandReveal?.onBlur}
            aria-label="COURT, My leagues"
            aria-describedby="court-words"
          >
            <CourtMark ref={markRef} veil />
          </button>
          <span id="court-words" hidden>
            Categories, Odds, Upgrades, Rosters, Trades
          </span>
          {scouting && scout && (
            <SampleSwitcher
              index={scouting}
              scout={scout}
              onScout={setScoutId}
              onJoin={() => setJoining('signup')}
              onSignIn={() => setJoining('signin')}
            />
          )}
          {selection && leagueName && (
            <LeagueSwitcher
              leagues={me.data?.leagues ?? []}
              current={{ leagueId: selection.leagueId, season }}
              leagueName={leagueName}
              teamName={teamName}
              onOpen={openLeague}
              onAdd={() => {
                goHome()
                setFocusAdd((n) => n + 1)
              }}
              onManage={goHome}
            />
          )}
          <div className="topbar-actions">
            {scouting && joining === null && (
              <button type="button" className="secondary smp-analyze" onClick={() => setJoining('signup')}>
                <OpenCrest size={18} />
                Analyze my league
              </button>
            )}
            {!signedIn && joining === null && (
              <button type="button" className="secondary smp-signin" onClick={() => setJoining('signin')}>
                Sign in
              </button>
            )}
            {creds && (
              <button
                className="link small hide-sm"
                onClick={() => {
                  clearCredentials()
                  setCreds(null)
                }}
              >
                Forget ESPN cookies
              </button>
            )}
            {analysis.isPending && seated && (
              <AnalysisPill progress={shownProgress} onClick={() => setTab('moves')} />
            )}
            {report && myTeamId && activeTab !== 'chat' && !analysis.isPending && (
              <button
                className="icon"
                aria-label="Refresh analysis"
                title="Refresh"
                disabled={analysis.isPending}
                onClick={() => analysis.mutate({ teamId: myTeamId, keep })}
              >
                <svg
                  className={analysis.isPending ? 'spinner' : undefined}
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <path d="M15 9a6 6 0 1 1-2-4.5M15 3v3.5h-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              </button>
            )}
            {themeButton}
            {signedIn && me.data && (
              <details className="account-menu">
                <summary className="icon" aria-label="Account" title={me.data.email ?? 'Account'}>
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <circle cx="9" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path
                      d="M3.5 15.5c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                    />
                  </svg>
                </summary>
                <div className="account-pop card stack">
                  <span className="small muted">Signed in as</span>
                  <strong className="account-email">{me.data.email ?? 'Google account'}</strong>
                  {me.data.admin && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open')
                        goHome()
                        setHealth(true)
                      }}
                    >
                      Site health
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      signOut()
                        .catch(() => undefined)
                        .finally(endSession)
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
        {showTabs && (
          <SectionNav sections={browseTabs} active={activeTab} onSelect={setTab} tabsRef={tabsRef} />
        )}
      </header>

      <main className="main">
        {scouting && scout && (
          <SamplePage index={scouting} scout={scout} onScout={setScoutId} onJoin={() => setJoining('signup')} />
        )}
        {scouting && scout && joining && (
          <JoinSheet
            mode={joining}
            scoutName={scout.name}
            scoutColour={teamColours(
              scouting.teams.map((t) => t.id),
              null,
            ).get(scout.id)}
            scoutReport={qc.getQueryData<AnalysisReport>(['sample-team', scout.id, scouting.analysed_on])}
            theme={theme}
            onSignedIn={joinWith}
            onClose={closeJoin}
          />
        )}
        {!signedIn && !scouting && sample.isPending && joining === null && <LeaguesSkeleton />}
        {heroShown && (
          <div className="signin-page">
            <SignInHero />
            <Auth key={joining ?? 'signup'} theme={theme} onSignedIn={signedInWith} initialMode={joining ?? 'signup'} />
          </div>
        )}

        {signedIn && me.isPending && !selection && <LeaguesSkeleton />}

        {signedIn && me.data && !selection && health && me.data.admin && <SiteHealth onBack={goHome} />}

        {signedIn && me.data && !selection && !(health && me.data.admin) && (
          <MyLeagues
            key={pendingInput}
            me={me.data}
            creds={creds}
            onCreds={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onOpen={openLeague}
            focusAdd={focusAdd}
            initialInput={pendingInput}
          />
        )}

        {/* One loading card from the first second to the report: the server waking, the league
            loading and the analysis all show in the same card, so nothing swaps under the user. */}
        {signedIn && selection && !verifying && (overview.isLoading || (overview.data && preparing)) && (
          <AnalysisCard
            progress={overview.data ? shownProgress : 0}
            stage={overview.data ? job.stage : 'Starting'}
            onBrowse={(t) => setTab(t)}
            waking={!overview.data}
            title={overview.isLoading && me.data && !mine?.team_id ? 'Loading your league' : undefined}
          />
        )}

        {signedIn && selection && needsCookies && (
          <CookieForm
            onSubmit={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onCancel={goHome}
            onRetry={() => {
              void overview.refetch()
              void league.refetch()
            }}
          />
        )}

        {signedIn && selection && loadError && !needsCookies && (
          <div className="card error stack">
            <h2>Couldn't load that league</h2>
            <p>{loadError.message}</p>
            <div className="row">
              {loadError.status === 0 && (
                <button
                  onClick={() => {
                    if (overview.error) void overview.refetch()
                    if (league.error) void league.refetch()
                  }}
                >
                  Try again
                </button>
              )}
              <button className="secondary" onClick={goHome}>
                Back to my leagues
              </button>
            </div>
          </div>
        )}

        {league.data && !league.data.supported && (
          <div className="card error stack">
            <h2>This league isn't supported yet</h2>
            <p>{league.data.unsupported_reason}</p>
            <div className="row">
              <button className="secondary" onClick={goHome}>
                Back to my leagues
              </button>
            </div>
          </div>
        )}

        {overview.data && ref && verifying && (
          <VerifyTeam
            leagueRef={ref}
            leagueName={overview.data.name}
            teams={overview.data.teams}
            creds={creds}
            initialTeamId={verifyTeam}
            pickedTeamId={pickedTeamId}
            onPick={(teamId) => {
              setPick(teamId)
              setVerifying(false)
              setTab('')
            }}
            onVerified={() => {
              setPick(null)
              setVerifying(false)
              setTab('')
              qc.invalidateQueries({ queryKey: ['me'] })
              qc.invalidateQueries({ queryKey: ['overview'] })
              qc.invalidateQueries({ queryKey: ['feed'] })
            }}
            onCancel={() => setVerifying(false)}
          />
        )}

        {overview.data && ref && !verifying && !seated && activeTab === 'overview' && (
          <LeagueOverview
            overview={overview.data}
            onVerify={() => openVerify()}
            leagueRef={ref}
            creds={creds}
            film={film}
            onFilm={setFilm}
          />
        )}

        {overview.data && ref && !verifying && !seated && activeTab === 'feed' && (
          <LeagueChat
            leagueId={ref.leagueId}
            season={ref.season}
            creds={creds}
            onVerify={() => openVerify()}
            onOpenFilm={(p) => {
              setFilm(p)
              setTab('overview')
            }}
          />
        )}

        {overview.data && ref && !verifying && !seated && activeTab === 'news' && (
          <News leagueId={ref.leagueId} season={ref.season} myTeamId={null} teams={overview.data.teams} creds={creds} />
        )}

        {!verifying &&
          pickedTeamId !== null &&
          teamName &&
          (ANALYSIS_TABS.has(activeTab) ? !!report : activeTab === 'league') && (
            <SeatNote
              teamName={teamName}
              onVerify={() => openVerify(pickedTeamId)}
              onChange={() => openVerify()}
            />
          )}

        {!verifying && seatOverview && ref && waitingForReport && !ANALYSIS_TABS.has(activeTab) && (
          <div
            className="stack"
            style={{ gap: 24 }}
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'league' && (
              <>
                <LeagueOverview
                  overview={seatOverview}
                  onVerify={() => undefined}
                  leagueRef={ref ?? undefined}
                  creds={creds}
                  film={film}
                  onFilm={setFilm}
                />
                {analysis.isPending && film === undefined && (
                  <div className="card pending-note">
                    <div className="progress" aria-hidden="true">
                      <span style={{ width: percent(shownProgress) }} />
                    </div>
                    <span className="muted">Playoff odds and team builds appear here once your analysis finishes.</span>
                  </div>
                )}
              </>
            )}
            {activeTab === 'scores' && (
              <Scores
                leagueId={ref.leagueId}
                season={ref.season}
                teamId={myTeamId!}
                teams={seatOverview.teams}
                creds={creds}
                matchup={tonightMatchup(seatOverview, myTeamId)}
              />
            )}
            {activeTab === 'news' && (
              <News
                leagueId={ref.leagueId}
                season={ref.season}
                myTeamId={myTeamId}
                teams={seatOverview.teams}
                creds={creds}
              />
            )}
            {activeTab === 'chat' && (
              <LeagueChat
                leagueId={ref.leagueId}
                season={ref.season}
                creds={creds}
                onVerify={verified ? undefined : () => openVerify(myTeamId)}
                onOpenFilm={(p) => {
                  setFilm(p)
                  setTab('league')
                }}
              />
            )}
          </div>
        )}

        {/* A quiet refresh that fails leaves the saved report up instead of covering it with an error. */}
        {!verifying &&
          seated &&
          analysis.error &&
          !analysis.variables?.quiet &&
          (!report ? ANALYSIS_TABS.has(activeTab) : true) && (
          <div className="card error stack">
            <h2>Something went wrong</h2>
            <p>{analysis.error.message}</p>
            <div className="row">
              <button className="secondary" onClick={() => analysis.mutate({ teamId: myTeamId, keep })}>
                Try again
              </button>
            </div>
          </div>
        )}

        {!verifying && seated && report && (
          <RoundValuesContext.Provider value={report.league.round_values}>
            <Report
              report={report}
              tab={activeTab as Tab}
              keep={keep}
              keepChanged={keepChanged}
              onToggleKeep={toggleKeep}
              onRerun={() => analysis.mutate({ teamId: myTeamId, keep })}
              rerunning={analysis.isPending}
              creds={creds}
              overview={seatOverview ?? null}
              onVerify={verified ? undefined : () => openVerify(myTeamId)}
              onTab={(t) => setTab(t)}
              film={film}
              onFilm={setFilm}
              tradesStatus={{ progress: shownProgress, running: analysis.isPending }}
              news={{
                changes: since.changes,
                before: since.before,
                after: report,
                running: analysis.isPending,
                progress: shownProgress,
              }}
              onDismissNews={() => setSince(NO_NEWS)}
            />
          </RoundValuesContext.Provider>
        )}
      </main>
      <PlayerCardHost
        leagueRef={verifying ? null : ref}
        creds={creds}
        teams={seatOverview?.teams ?? []}
        myTeamId={myTeamId}
      />
      {readyToast && (
        <ReadyToast
          onView={() => {
            setTab('moves')
            setReadyToast(false)
          }}
          onDismiss={() => setReadyToast(false)}
        />
      )}
    </>
  )
}
