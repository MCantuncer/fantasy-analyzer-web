import type { AnalysisReport } from '../api/client'

// The last finished analysis for a team, kept on this device so a refresh (or iOS reloading a
// tab it put to sleep) shows it at once instead of starting the "Finding your best moves" wait.

const PREFIX = 'analysis:'
// A report this young is still fresh. The page asks the server on every open anyway (it answers at
// once when the league hasn't moved, and says what moved when it has), so urgent news isn't hidden.
export const FRESH_MS = 10 * 60_000
// Older reports still show at once while a fresh one is worked out quietly; past this they're dropped.
export const KEEP_MS = 12 * 60 * 60_000

interface Saved {
  season: number
  keep: number[]
  savedAt: number
  report: AnalysisReport
}

export interface SavedReport {
  report: AnalysisReport
  fresh: boolean
}

function key(leagueId: number, teamId: number) {
  return `${PREFIX}${leagueId}:${teamId}`
}

function sameIds(a: number[], b: number[]) {
  return [...a].sort((x, y) => x - y).join(',') === [...b].sort((x, y) => x - y).join(',')
}

/** The saved report for this team and keepers, if it is recent enough to show. */
export function loadSavedReport(
  leagueId: number,
  teamId: number,
  season: number | null,
  keep: number[],
  now = Date.now(),
): SavedReport | null {
  try {
    const raw = localStorage.getItem(key(leagueId, teamId))
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    const age = now - saved.savedAt
    if (!saved.report || !Array.isArray(saved.keep) || !(age >= 0) || age > KEEP_MS) return null
    if (season !== null && saved.season !== season) return null
    if (saved.report.team_id !== teamId || !sameIds(saved.keep, keep)) return null
    return { report: saved.report, fresh: age < FRESH_MS }
  } catch {
    return null
  }
}

export function saveReport(leagueId: number, teamId: number, keep: number[], report: AnalysisReport, now = Date.now()) {
  const saved: Saved = { season: report.league.season, keep, savedAt: now, report }
  try {
    localStorage.setItem(key(leagueId, teamId), JSON.stringify(saved))
  } catch {
    // storage full or blocked: a refresh just runs the analysis again
  }
}

/** Forget every saved report, e.g. on sign-out, so the next person on this device can't see them. */
export function clearSavedReports() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch {
    // ignore
  }
}
