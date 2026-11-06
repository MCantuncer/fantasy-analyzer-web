import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  fetchAnalysis,
  fetchLeague,
  fetchMe,
  fetchOverview,
  retryDropped,
  retryDroppedDelay,
  signOut,
} from './api/client'
import type { AnalysisProgress, AnalysisReport, AuthResult, MyLeague } from './api/client'
import { AnalysisCard, AnalysisPill, ReadyToast } from './components/AnalysisProgress'
import { LeaguesSkeleton } from './components/Skeleton'
import { percent, useSmoothProgress } from './lib/progress'
import { Auth } from './components/Auth'
import { CookieForm } from './components/CookieForm'
import { LeagueChat } from './components/LeagueChat'
import { LeagueOverview } from './components/LeagueOverview'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { MyLeagues } from './components/MyLeagues'
import { News } from './components/News'
import { PlayerCardHost } from './components/PlayerCard'
import { Report, TABS } from './components/Report'
import type { Tab } from './components/Report'
import { Scores } from './components/Scores'
import { SectionNav } from './components/SectionNav'
import { VerifyTeam } from './components/VerifyTeam'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/credentials'
import type { Credentials } from './lib/credentials'
import { clearSavedReports, loadSavedReport, saveReport } from './lib/savedReport'
import { clearPages, prefetchPages, restorePages, savePages } from './lib/pageCache'
import { clearToken, loadToken, saveToken } from './lib/session'
import { applyTheme, loadTheme } from './lib/theme'
import type { Theme } from './lib/theme'
import { RoundValuesContext } from './lib/tradeValue'
import { tonightMatchup } from './lib/league'
import { useTabInView } from './lib/useTabInView'

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

const ALL_TABS: readonly { id: string; label: string }[] = [...TABS, ...LEAGUE_TABS]

function readUrl(): { selection: Selection | null; tab: string; verifying: boolean } {
  const q = new URLSearchParams(window.location.search)
  const league = Number(q.get('league'))
  const season = Number(q.get('season'))
  return {
    selection: league > 0 ? { leagueId: league, season: season > 0 ? season : null } : null,
    tab: ALL_TABS.find((t) => t.id === q.get('tab'))?.id ?? '',
    verifying: q.get('view') === 'verify',
  }
}

// Only IDs go in the URL, never cookies or tokens.
function writeUrl(selection: Selection | null, tab: string, verifying: boolean) {
  const q = new URLSearchParams()
  if (selection) q.set('league', String(selection.leagueId))
  if (selection?.season) q.set('season', String(selection.season))
  if (selection && verifying) q.set('view', 'verify')
  else if (selection && tab) q.set('tab', tab)
  const search = q.toString()
  window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
}

function keepKey(leagueId: number, teamId: number) {
  return `keep:${leagueId}:${teamId}`
}

function loadKeep(leagueId: number, teamId: number): number[] {
  try {
    const raw = localStorage.getItem(keepKey(leagueId, teamId))
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : []
  } catch {
    return []
  }
}

function storeKeep(leagueId: number, teamId: number, ids: number[]) {
  try {
    localStorage.setItem(keepKey(leagueId, teamId), JSON.stringify(ids))
  } catch {
    // storage unavailable; keepers last for this page view only
  }
}

export default function App() {
  const initial = readUrl()
  const qc = useQueryClient()
  const [signedIn, setSignedIn] = useState(() => loadToken() !== null)
  const [selection, setSelection] = useState<Selection | null>(initial.selection)
  const [tab, setTab] = useState<string>(initial.tab)
  const [verifying, setVerifying] = useState(initial.verifying)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
  const [keep, setKeep] = useState<number[]>([])
  const [appliedKeep, setAppliedKeep] = useState<number[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [job, setJob] = useState<AnalysisProgress>({ progress: 0, stage: 'Starting' })
  const [readyToast, setReadyToast] = useState(false)
  const running = useRef<AbortController | null>(null)
  // Bumped by the top bar's "Add a league" so My leagues focuses its add box.
  const [focusAdd, setFocusAdd] = useState(0)

  useEffect(() => writeUrl(selection, tab, verifying), [selection, tab, verifying])
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
  const myTeamId = overview.data?.my_team_id ?? null
  const ref = overview.data ? { leagueId: overview.data.league_id, season: overview.data.season } : null

  // Once the league is in, fetch the first screen of the "While you wait" pages in the
  // background, so opening one of them during the analysis finds it ready.
  const refLeague = ref?.leagueId
  const refSeason = ref?.season
  useEffect(() => {
    if (refLeague === undefined || refSeason === undefined) return
    prefetchPages(qc, { leagueId: refLeague, season: refSeason }, myTeamId, creds)
  }, [qc, refLeague, refSeason, myTeamId, creds])

  // The analysis is only for the team this account verified.
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

  const { mutate } = analysis
  const leagueReady = league.isSuccess && league.data.supported
  useEffect(() => {
    if (!selection || !myTeamId || !leagueReady) return
    const stored = loadKeep(selection.leagueId, myTeamId)
    setKeep(stored)
    // A refresh shows the last finished report at once; only an old one is worked out again, quietly.
    const saved = loadSavedReport(selection.leagueId, myTeamId, selection.season, stored)
    setReport(saved?.report ?? null)
    if (saved) setAppliedKeep(stored)
    if (saved?.fresh) return
    mutate({ teamId: myTeamId, keep: stored, quiet: saved !== null })
  }, [selection, myTeamId, leagueReady, mutate])

  const loadError = [overview.error, league.error].find((e) => e instanceof ApiError) as ApiError | undefined
  const needsCookies = loadError?.code === 'private_league'
  const verified = myTeamId !== null
  const tabs: readonly { id: string; label: string }[] = verified ? TABS : LEAGUE_TABS
  const activeTab = tabs.find((t) => t.id === tab)?.id ?? tabs[0].id
  const waitingForReport = verified && !report
  // Until the first report is in, the analysis tabs have nothing to show: the loading card
  // stands alone, and browsing from it offers only the pages that work meanwhile.
  const browseTabs = waitingForReport ? tabs.filter((t) => !ANALYSIS_TABS.has(t.id)) : tabs
  const showTabs =
    selection && !verifying && overview.data && !(waitingForReport && ANALYSIS_TABS.has(activeTab))
  const tabsRef = useTabInView(showTabs ? activeTab : null)
  const firstRun = waitingForReport && analysis.isPending
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

  function signedInWith(result: AuthResult) {
    saveToken(result.token)
    qc.setQueryData(['me'], result.me)
    setSignedIn(true)
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
    setSelection({ leagueId: l.league_id, season: l.season })
    setTab('')
    setVerifying(false)
    setReport(null)
    stopAnalysis()
  }

  function goHome() {
    setSelection(null)
    setFocusAdd(0)
    setVerifying(false)
    setReport(null)
    stopAnalysis()
  }

  function toggleKeep(id: number) {
    if (!selection || !myTeamId) return
    const next = keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id]
    setKeep(next)
    storeKeep(selection.leagueId, myTeamId, next)
  }

  const keepChanged = [...keep].sort().join(',') !== [...appliedKeep].sort().join(',')
  const leagueName = overview.data?.name ?? mine?.name
  const teamName = overview.data?.teams.find((t) => t.id === myTeamId)?.name

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={goHome} aria-label="Fantasy Analyzer, my leagues">
            <svg className="brand-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--gold)" />
              <g fill="var(--on-gold)" transform="translate(3.6 0) skewX(-13)">
                <rect x="8.5" y="7" width="4.8" height="18.5" rx="0.8" />
                <rect x="8.5" y="14.4" width="8.6" height="4.8" rx="0.8" />
                <path d="M8.5 7H19V3.8l7.2 5.5L19 14.8v-3.2H8.5z" />
              </g>
            </svg>
            <span className="brand-name">Fantasy Analyzer</span>
          </button>
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
            {analysis.isPending && verified && (
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
        {!signedIn && <Auth theme={theme} onSignedIn={signedInWith} />}

        {signedIn && me.isPending && !selection && <LeaguesSkeleton />}

        {signedIn && me.data && !selection && (
          <MyLeagues
            me={me.data}
            creds={creds}
            onCreds={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onOpen={openLeague}
            focusAdd={focusAdd}
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
            onVerified={() => {
              setVerifying(false)
              setTab('')
              qc.invalidateQueries({ queryKey: ['me'] })
              qc.invalidateQueries({ queryKey: ['overview'] })
              qc.invalidateQueries({ queryKey: ['feed'] })
            }}
            onCancel={() => setVerifying(false)}
          />
        )}

        {overview.data && ref && !verifying && !verified && activeTab === 'overview' && (
          <LeagueOverview overview={overview.data} onVerify={() => setVerifying(true)} />
        )}

        {overview.data && ref && !verifying && !verified && activeTab === 'feed' && (
          <LeagueChat leagueId={ref.leagueId} season={ref.season} creds={creds} onVerify={() => setVerifying(true)} />
        )}

        {overview.data && ref && !verifying && !verified && activeTab === 'news' && (
          <News leagueId={ref.leagueId} season={ref.season} myTeamId={null} teams={overview.data.teams} creds={creds} />
        )}

        {!verifying && overview.data && ref && waitingForReport && !ANALYSIS_TABS.has(activeTab) && (
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
                  overview={overview.data}
                  onVerify={() => undefined}
                  leagueRef={ref ?? undefined}
                  creds={creds}
                />
                {analysis.isPending && (
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
                teams={overview.data.teams}
                creds={creds}
                matchup={tonightMatchup(overview.data, myTeamId)}
              />
            )}
            {activeTab === 'news' && (
              <News
                leagueId={ref.leagueId}
                season={ref.season}
                myTeamId={myTeamId}
                teams={overview.data.teams}
                creds={creds}
              />
            )}
            {activeTab === 'chat' && <LeagueChat leagueId={ref.leagueId} season={ref.season} creds={creds} />}
          </div>
        )}

        {/* A quiet refresh that fails leaves the saved report up instead of covering it with an error. */}
        {!verifying &&
          verified &&
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

        {!verifying && verified && report && (
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
              overview={overview.data ?? null}
              onTab={(t) => setTab(t)}
            />
          </RoundValuesContext.Provider>
        )}
      </main>
      <PlayerCardHost
        leagueRef={verifying ? null : ref}
        creds={creds}
        teams={overview.data?.teams ?? []}
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
