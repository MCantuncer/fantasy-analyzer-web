import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, fetchAnalysis, fetchLeague } from './api/client'
import type { AnalysisReport } from './api/client'
import { CookieForm } from './components/CookieForm'
import { Report } from './components/Report'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/credentials'
import type { Credentials } from './lib/credentials'
import { parseLeagueInput } from './lib/espnUrl'

interface Selection {
  leagueId: number
  season: number | null
}

function readUrl(): { selection: Selection | null; teamId: number | null } {
  const q = new URLSearchParams(window.location.search)
  const league = Number(q.get('league'))
  const team = Number(q.get('team'))
  const season = Number(q.get('season'))
  return {
    selection: league > 0 ? { leagueId: league, season: season > 0 ? season : null } : null,
    teamId: team > 0 ? team : null,
  }
}

// Only IDs go in the URL, never cookies.
function writeUrl(selection: Selection | null, teamId: number | null) {
  const q = new URLSearchParams()
  if (selection) q.set('league', String(selection.leagueId))
  if (selection?.season) q.set('season', String(selection.season))
  if (teamId) q.set('team', String(teamId))
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
  const [input, setInput] = useState(initial.selection ? String(initial.selection.leagueId) : '')
  const [selection, setSelection] = useState<Selection | null>(initial.selection)
  const [teamId, setTeamId] = useState<number | null>(initial.teamId)
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
  const [keep, setKeep] = useState<number[]>([])
  const [appliedKeep, setAppliedKeep] = useState<number[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)

  useEffect(() => writeUrl(selection, teamId), [selection, teamId])

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

  function submitLeague(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseLeagueInput(input)
    if (!parsed.leagueId) return
    setSelection({ leagueId: parsed.leagueId, season: parsed.season ?? null })
    setTeamId(parsed.teamId ?? null)
    setReport(null)
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
    <div className="page">
      <header className="topbar">
        <button className="link brand" onClick={reset}>
          Fantasy Analyzer
        </button>
        {creds && (
          <button
            className="link small"
            onClick={() => {
              clearCredentials()
              setCreds(null)
            }}
          >
            Forget ESPN cookies
          </button>
        )}
      </header>

      <main className="stack">
        {!selection && (
          <form className="card stack" onSubmit={submitLeague}>
            <h1>Find the moves that win your league</h1>
            <p className="muted">
              For ESPN fantasy basketball head-to-head category leagues. Get trades the other owner should accept,
              pickups with the right drop, and how each one changes your playoff odds.
            </p>
            <label>
              League ID or your ESPN team page URL
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="744636428 or https://fantasy.espn.com/basketball/team?leagueId=…&teamId=…"
                inputMode="url"
                autoFocus
              />
            </label>
            <button type="submit" disabled={!parseLeagueInput(input).leagueId}>
              Load league
            </button>
          </form>
        )}

        {selection && league.isLoading && <p className="card">Loading league…</p>}

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
            <p>{leagueError.message}</p>
            <button className="secondary" onClick={reset}>
              Try another league
            </button>
          </div>
        )}

        {league.data && !league.data.supported && (
          <div className="card error">
            <p>{league.data.unsupported_reason}</p>
          </div>
        )}

        {league.data && league.data.supported && (
          <section className="card">
            <label>
              Your team in {league.data.name}
              <select
                value={teamId ?? ''}
                onChange={(e) => {
                  setTeamId(Number(e.target.value) || null)
                }}
              >
                <option value="">Choose your team</option>
                {league.data.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.record})
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {analysis.isPending && !report && (
          <p className="card">Simulating the season and screening every trade… this takes a few seconds.</p>
        )}

        {analysis.error && (
          <div className="card error">
            <p>{analysis.error.message}</p>
          </div>
        )}

        {report && (
          <Report
            report={report}
            keep={keep}
            keepChanged={keepChanged}
            onToggleKeep={toggleKeep}
            onRerun={() => teamId && analysis.mutate({ teamId, keep })}
            rerunning={analysis.isPending}
          />
        )}
      </main>
    </div>
  )
}
