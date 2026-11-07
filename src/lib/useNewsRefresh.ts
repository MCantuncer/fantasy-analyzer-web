import { useEffect, useState } from 'react'
import { checkNews } from '../api/client'
import type { NewsPage, NewsStory } from '../api/client'

/** How often the page asks for the news while a check it asked for runs. */
const FOLLOW_MS = 3_000
/** How long the page waits on a check before it stops spinning; stories still arrive on their own. */
const GIVE_UP_MS = 90_000
/** How long "2 new stories" stays before the line goes back to "Updated just now". */
const RESULT_MS = 8_000

export type RefreshPhase =
  | { kind: 'idle' }
  | { kind: 'checking'; seen: Map<string, string>; since: string | null; started: number }
  | { kind: 'result'; text: string; fresh: boolean }

/** Stories new since the press, and stories that gained a source, said in a few words. */
export function changesSince(seen: Map<string, string>, stories: NewsStory[]): { text: string; fresh: boolean } {
  let added = 0
  let updated = 0
  for (const s of stories) {
    const before = seen.get(s.id)
    if (before === undefined) added += 1
    else if (s.updated_at > before) updated += 1
  }
  if (added === 0 && updated === 0) return { text: 'Nothing new yet', fresh: false }
  const parts = []
  if (added > 0) parts.push(`${added} new ${added === 1 ? 'story' : 'stories'}`)
  if (updated > 0) parts.push(`${updated} updated`)
  return { text: parts.join(', '), fresh: true }
}

/**
 * The News page's own refresh: asks the server to check every source now, then follows the
 * check until it lands. Separate from the top bar's refresh, which reruns the trade analysis.
 */
export function useNewsRefresh(data: NewsPage | undefined, refetch: () => Promise<unknown>) {
  const [phase, setPhase] = useState<RefreshPhase>({ kind: 'idle' })
  const [failed, setFailed] = useState(false)

  // The check landed: the server is no longer checking and its last check is newer than at the press.
  useEffect(() => {
    if (phase.kind !== 'checking' || !data) return
    const landed = !data.refreshing && data.updated_at !== phase.since
    const late = Date.now() - phase.started > GIVE_UP_MS
    if (landed) setPhase({ kind: 'result', ...changesSince(phase.seen, data.stories) })
    else if (late) setPhase({ kind: 'result', text: 'Still checking. Stories show on their own', fresh: false })
  }, [data, phase])

  const checking = phase.kind === 'checking'
  useEffect(() => {
    if (!checking) return
    const t = window.setInterval(() => void refetch(), FOLLOW_MS)
    return () => window.clearInterval(t)
  }, [checking, refetch])

  useEffect(() => {
    if (phase.kind !== 'result') return
    const t = window.setTimeout(() => setPhase({ kind: 'idle' }), RESULT_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  async function start() {
    if (!data || phase.kind === 'checking') return
    const seen = new Map(data.stories.map((s) => [s.id, s.updated_at]))
    setFailed(false)
    try {
      const check = await checkNews()
      if (check.refreshing) {
        setPhase({ kind: 'checking', seen, since: data.updated_at ?? null, started: Date.now() })
        void refetch() // a quick check may already be done
        return
      }
      // Checked under two minutes ago (by anyone): the stored news is already the latest.
      await refetch()
      setPhase({ kind: 'result', text: 'Up to date', fresh: false })
    } catch {
      setFailed(true)
      setPhase({ kind: 'idle' })
    }
  }

  return { phase, failed, start, checking }
}
