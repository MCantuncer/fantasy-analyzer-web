import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, fetchAnalysis, fetchLeague } from './api/client'
import type { AnalysisReport } from './api/client'
import { CookieForm } from './components/CookieForm'
import { Landing } from './components/Landing'
import { Report, TABS } from './components/Report'
import type { Tab } from './components/Report'
import { Status } from './components/Status'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/credentials'
import type { Credentials } from './lib/credentials'
import { parseLeagueInput } from './lib/espnUrl'
import { applyTheme, loadTheme } from './lib/theme'
import type { Theme } from './lib/theme'

interface Selection {
  leagueId: number
  season: number | null
}

function readUrl(): { selection: Selection | null; teamId: number | null; tab: Tab } {
  const q = new URLSearchParams(window.location.search)
  const league = Number(q.get('league'))
  const team = Number(q.get('team'))
  const season = Number(q.get('season'))
  return {
    selection: league > 0 ? { leagueId: league, season: season > 0 ? season : null } : null,
    teamId: team > 0 ? team : null,
    tab: TABS.find((t) => t.id === q.get('tab'))?.id ?? 'moves',
  }
}

// Only IDs go in the URL, never cookies.
function writeUrl(selection: Selection | null, teamId: number | null, tab: Tab) {
  const q = new URLSearchParams()
  if (selection) q.set('league', String(selection.leagueId))
  if (selection?.season) q.set('season', String(selection.season))
  if (teamId) q.set('team', String(teamId))
  if (teamId && tab !== 'moves') q.set('tab', tab)
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
  const [selection, setSelection] = useState<Selection | null>(initial.selection)
  const [teamId, setTeamId] = useState<number | null>(initial.teamId)
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
  const [keep, setKeep] = useState<number[]>([])
  const [appliedKeep, setAppliedKeep] = useState<number[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)

  useEffect(() => writeUrl(selection, teamId, tab), [selection, teamId, tab])
  useEffect(() => applyTheme(theme), [theme])

  const league = useQuery({
    queryKey: ['league', selection?.leagueId, selection?.season, creds?.swid ?? null],
    queryFn: () => fetchLeague(selection!.leagueId, selection!.season, creds),
    enabled: selection !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const analysis = useMutation({
    mutationFn: (args: { teamId: number; keep: number[] }) =>
      fetchAnalysis(selection!.leagueId, args.teamId, selection!.season, args.keep, creds),
    onSuccess: (data, args) => {
      setReport(data)
      setAppliedKeep(args.keep)
    },
  })

  // Run the analysis once the league is loaded and a team is chosen.
  const { mutate } = analysis
  const leagueReady = league.isSuccess && league.data.supported
  useEffect(() => {
    if (!selection || !teamId || !leagueReady) return
    const stored = loadKeep(selection.leagueId, teamId)
    setKeep(stored)
    setReport(null)
    mutate({ teamId, keep: stored })
  }, [selection, teamId, leagueReady, mutate])

  const leagueError = league.error instanceof ApiError ? league.error : null
  const needsCookies = leagueError?.code === 'private_league'
  const leagueData = league.data?.supported ? league.data : null

  function submitLeague(input: string) {
    const parsed = parseLeagueInput(input)
    if (!parsed.leagueId) return
    setSelection({ leagueId: parsed.leagueId, season: parsed.season ?? null })
    setTeamId(parsed.teamId ?? null)
    setTab('moves')
    setReport(null)
  }

  function chooseTeam(id: number | null) {
    setTeamId(id)
    setTab('moves')
  }

  function reset() {
    setSelection(null)
    setTeamId(null)
    setReport(null)
    analysis.reset()
  }

  function toggleKeep(id: number) {
    if (!selection || !teamId) return
    const next = keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id]
    setKeep(next)
    storeKeep(selection.leagueId, teamId, next)
  }

  const keepChanged = [...keep].sort().join(',') !== [...appliedKeep].sort().join(',')

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={reset} aria-label="Fantasy Analyzer, start over">
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
          {leagueData && teamId && (
            <div className="switcher">
              <span className="league-name" title={leagueData.name}>
                {leagueData.name}
              </span>
              <span className="crumb-sep" aria-hidden="true">
                /
              </span>
              {/* The visible name sizes the control; the native select sits invisibly on top of it. */}
              <span className="team-select">
                <span className="team-select-name">
                  {leagueData.teams.find((t) => t.id === teamId)?.name ?? 'Choose your team'}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
                <select
                  id="team-switch"
                  aria-label="Your team"
                  value={teamId}
                  onChange={(e) => chooseTeam(Number(e.target.value) || null)}
                >
                  {leagueData.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </span>
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
            {report && teamId && (
              <button
                className="icon"
                aria-label="Refresh analysis"
                title="Refresh"
                disabled={analysis.isPending}
                onClick={() => analysis.mutate({ teamId, keep })}
              >
                <svg className={analysis.isPending ? 'spinner' : undefined} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
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
                  <path d="M14.5 11.5A6.5 6.5 0 0 1 6.5 3.5a6.5 6.5 0 1 0 8 8z" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {report && (
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                className="tab"
                aria-selected={tab === t.id}
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
        {!selection && <Landing initial="" onSubmit={submitLeague} />}

        {selection && league.isLoading && <Status phase="league" />}

        {needsCookies && (
          <CookieForm
            onSubmit={(c, remember) => {
              saveCredentials(c, remember)
              setCreds(loadCredentials() ?? c)
            }}
            onCancel={reset}
          />
        )}

        {leagueError && !needsCookies && (
          <div className="card error stack">
            <h2>Couldn't load that league</h2>
            <p>{leagueError.message}</p>
            <div className="row">
              <button className="secondary" onClick={reset}>
                Try another league
              </button>
            </div>
          </div>
        )}

        {league.data && !league.data.supported && (
          <div className="card error stack">
            <h2>This league isn't supported yet</h2>
            <p>{league.data.unsupported_reason}</p>
            <div className="row">
              <button className="secondary" onClick={reset}>
                Try another league
              </button>
            </div>
          </div>
        )}

        {leagueData && !teamId && (
          <section className="card stack" aria-labelledby="pick-title">
            <div>
              <span className="eyebrow">{leagueData.name}</span>
              <h2 id="pick-title">Which team is yours?</h2>
            </div>
            <div className="team-grid">
              {leagueData.teams.map((t) => (
                <button key={t.id} className="secondary team-choice" onClick={() => chooseTeam(t.id)}>
                  <span>{t.name}</span>
                  {t.record !== '0-0-0' && <span className="muted tnum">{t.record}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {analysis.isPending && !report && <Status phase="analysis" leagueName={leagueData?.name} />}

        {analysis.error && (
          <div className="card error stack">
            <h2>Something went wrong</h2>
            <p>{analysis.error.message}</p>
            <div className="row">
              <button className="secondary" onClick={() => teamId && analysis.mutate({ teamId, keep })}>
                Try again
              </button>
            </div>
          </div>
        )}

        {report && (
          <Report
            report={report}
            tab={tab}
            keep={keep}
            keepChanged={keepChanged}
            onToggleKeep={toggleKeep}
            onRerun={() => teamId && analysis.mutate({ teamId, keep })}
            rerunning={analysis.isPending}
            creds={creds}
          />
        )}
      </main>
    </>
  )
}
