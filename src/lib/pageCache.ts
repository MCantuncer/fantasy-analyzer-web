import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { fetchFeed, fetchNews, fetchScoreGames } from '../api/client'
import type { Credentials } from './credentials'

// The "While you wait" pages (Scores, NBA News, League Chat) open at once:
//  - their first request goes out as soon as the league is in, before anyone taps the tab;
//  - their last answer is kept on this device, so a revisit shows it straight away and
//    refreshes underneath, the way the saved report works.

const STORAGE_KEY = 'pages:v1'
// Older than this, a saved page is more confusing than helpful (yesterday's scores, old news).
export const KEEP_MS = 6 * 60 * 60_000
// Keep the saved copy small: only the first screen of each page.
const KINDS = new Set(['score-games', 'news', 'feed'])

interface Entry {
  key: QueryKey
  data: unknown
  at: number
}

function read(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Entry[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(entries: Entry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked (private mode): the pages still load, just not instantly.
  }
}

function sameKey(a: QueryKey, b: QueryKey) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Put the saved pages back in the query cache, marked with when they were fetched so they refresh. */
export function restorePages(qc: QueryClient, now = Date.now()) {
  for (const e of read()) {
    if (now - e.at > KEEP_MS || qc.getQueryData(e.key) !== undefined) continue
    qc.setQueryData(e.key, e.data, { updatedAt: e.at })
  }
}

/**
 * Save each page's latest answer as it arrives. Private leagues are never saved: their
 * pages stay in memory only. Returns the unsubscribe function.
 */
export function savePages(qc: QueryClient, isPrivate: () => boolean) {
  return qc.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || isPrivate()) return
    const { queryKey, state } = event.query
    if (!KINDS.has(String(queryKey[0])) || state.data === undefined) return
    let data = state.data
    // League Chat: only the first week, the part that shows when the tab opens.
    if (queryKey[0] === 'feed') {
      const inf = data as { pages: unknown[]; pageParams: unknown[] }
      data = { pages: inf.pages.slice(0, 1), pageParams: inf.pageParams.slice(0, 1) }
    }
    const entries = read().filter((e) => !sameKey(e.key, queryKey) && Date.now() - e.at <= KEEP_MS)
    entries.push({ key: queryKey, data, at: state.dataUpdatedAt })
    // A handful of pages per league is plenty; the newest win.
    write(entries.slice(-12))
  })
}

export function clearPages() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing saved
  }
}

/**
 * Ask for the first screen of Scores, NBA News and League Chat in the background, with the
 * same keys those pages use, so opening a tab finds its data already there.
 */
export function prefetchPages(
  qc: QueryClient,
  ref: { leagueId: number; season: number },
  teamId: number | null,
  creds: Credentials | null,
) {
  const swid = creds?.swid ?? null
  const { leagueId, season } = ref
  if (teamId !== null) {
    qc.prefetchQuery({
      queryKey: ['score-games', leagueId, season, null, teamId, swid],
      queryFn: () => fetchScoreGames(leagueId, season, null, teamId, creds),
      staleTime: 30_000,
    })
  }
  qc.prefetchQuery({
    queryKey: ['news', leagueId, season, false, swid],
    queryFn: () => fetchNews(leagueId, season, false, creds),
    staleTime: 60_000,
  })
  qc.prefetchInfiniteQuery({
    queryKey: ['feed', leagueId, season],
    queryFn: ({ pageParam }) => fetchFeed(ref, pageParam as number, creds),
    initialPageParam: 0,
    staleTime: 30_000,
  })
}
