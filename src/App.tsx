import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, fetchAnalysis, fetchLeague, fetchMe, fetchOverview, signOut } from './api/client'
import type { AnalysisReport, AuthResult, MyLeague } from './api/client'
import { Auth } from './components/Auth'
import { CookieForm } from './components/CookieForm'
import { LeagueChat } from './components/LeagueChat'
import { LeagueOverview } from './components/LeagueOverview'
import { MyLeagues } from './components/MyLeagues'
import { News } from './components/News'
import { Report, TABS } from './components/Report'
import type { Tab } from './components/Report'
import { Status } from './components/Status'
import { VerifyTeam } from './components/VerifyTeam'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/credentials'
import type { Credentials } from './lib/credentials'
import { clearToken, loadToken, saveToken } from './lib/session'
import { applyTheme, loadTheme } from './lib/theme'
import type { Theme } from './lib/theme'
import { RoundValuesContext } from './lib/tradeValue'

interface Selection {
  leagueId: number
  season: number | null
}

// Before verifying, a league shows only league-wide pages.
const LEAGUE_TABS = [
  { id: 'overview', label: 'League' },
  { id: 'feed', label: 'Moves feed' },
  { id: 'news', label: 'NBA News' },
] as const

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

  useEffect(() => writeUrl(selection, tab, verifying), [selection, tab, verifying])
  useEffect(() => applyTheme(theme), [theme])

  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled: signedIn, retry: false, staleTime: 60_000 })
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
    retry: false,
    staleTime: 2 * 60_000,
  })
  const myTeamId = overview.data?.my_team_id ?? null
  const ref = overview.data ? { leagueId: overview.data.league_id, season: overview.data.season } : null

  // The analysis is only for the team this account verified.
  const league = useQuery({
    queryKey: ['league', selection?.leagueId, season, creds?.swid ?? null],
    queryFn: () => fetchLeague(selection!.leagueId, season, creds),
    enabled: myTeamId !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const analysis = useMutation({
    mutationFn: (args: { teamId: number; keep: number[] }) =>
      fetchAnalysis(selection!.leagueId, args.teamId, season, args.keep, creds),
    onSuccess: (data, args) => {
      setReport(data)
      setAppliedKeep(args.keep)
    },
  })

  const { mutate } = analysis
  const leagueReady = league.isSuccess && league.data.supported
  useEffect(() => {
    if (!selection || !myTeamId || !leagueReady) return
    const stored = loadKeep(selection.leagueId, myTeamId)
    setKeep(stored)
    setReport(null)
    mutate({ teamId: myTeamId, keep: stored })
  }, [selection, myTeamId, leagueReady, mutate])

  const loadError = [overview.error, league.error].find((e) => e instanceof ApiError) as ApiError | undefined
  const needsCookies = loadError?.code === 'private_league'
  const verified = myTeamId !== null
  const tabs: readonly { id: string; label: string }[] = verified ? TABS : LEAGUE_TABS
  const activeTab = tabs.find((t) => t.id === tab)?.id ?? tabs[0].id
  const showTabs = selection && !verifying && overview.data && (!verified || report)

  function signedInWith(result: AuthResult) {
    saveToken(result.token)
    qc.setQueryData(['me'], result.me)
    setSignedIn(true)
  }

  function endSession() {
    clearToken()
    qc.clear()
    setSignedIn(false)
    goHome()
  }

  function openLeague(l: MyLeague) {
    setSelection({ leagueId: l.league_id, season: l.season })
    setTab('')
    setVerifying(false)
    setReport(null)
    analysis.reset()
  }

  function goHome() {
    setSelection(null)
    setVerifying(false)
    setReport(null)
    analysis.reset()
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
            <svg className="brand-mark" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--accent)" />
              <path
                d="M8 19 L12 13 L16 16 L20 9"
                stroke="var(--on-accent)"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="brand-name">Fantasy Analyzer</span>
          </button>
          {selection && leagueName && (
            <div className="switcher">
              <span className="league-name" title={leagueName}>
                {leagueName}
              </span>
              {teamName && (
                <>
                  <span className="crumb-sep" aria-hidden="true">
                    /
                  </span>
                  <span className="team-name" title={teamName}>
                    {teamName}
                  </span>
                </>
              )}
            </div>
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
            {report && myTeamId && activeTab !== 'chat' && (
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
          <nav className="tabs" role="tablist" aria-label="Sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                className="tab"
                aria-selected={activeTab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="main">
        {!signedIn && <Auth theme={theme} onSignedIn={signedInWith} />}

        {signedIn && me.isPending && <div className="card muted">Loading your account…</div>}

        {signedIn && me.data && !selection && (
          <MyLeagues
            me={me.data}
            creds={creds}
            onCreds={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onOpen={openLeague}
          />
        )}

        {signedIn && selection && overview.isLoading && <Status phase="league" />}

        {signedIn && selection && needsCookies && (
          <CookieForm
            onSubmit={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onCancel={goHome}
          />
        )}

        {signedIn && selection && loadError && !needsCookies && (
          <div className="card error stack">
            <h2>Couldn't load that league</h2>
            <p>{loadError.message}</p>
            <div className="row">
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

        {!verifying && verified && analysis.isPending && !report && <Status phase="analysis" leagueName={leagueName} />}

        {!verifying && verified && analysis.error && (
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
    </>
  )
}
