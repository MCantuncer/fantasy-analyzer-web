import { ArrowClockwise } from '@phosphor-icons/react'
import type { NewsPage } from '../api/client'
import { ago } from '../lib/news'
import type { useNewsRefresh } from '../lib/useNewsRefresh'

export function NewsRefresh({
  data,
  now,
  refresh,
}: {
  data: NewsPage
  now: Date
  refresh: ReturnType<typeof useNewsRefresh>
}) {
  const { phase, failed, start, checking } = refresh
  const busy = checking || data.refreshing
  let status: string
  if (checking) status = 'Asking every source…'
  else if (phase.kind === 'result') status = phase.text
  else if (failed) status = "Couldn't refresh. Try again"
  else if (data.refreshing) status = 'Checking sources…'
  else status = data.updated_at ? `Updated ${ago(data.updated_at, now)}` : 'Not checked yet'

  return (
    <div className="news-refresh">
      <button
        type="button"
        className="secondary news-refresh-btn"
        onClick={start}
        disabled={checking}
        aria-busy={busy || undefined}
        aria-describedby="news-refresh-status"
      >
        <ArrowClockwise size={16} weight="bold" className={busy ? 'spinner' : undefined} aria-hidden="true" />
        {checking ? 'Checking' : 'Refresh news'}
      </button>
      <span
        id="news-refresh-status"
        className="news-refresh-status"
        data-state={failed ? 'error' : phase.kind === 'result' && phase.fresh ? 'fresh' : undefined}
        role="status"
      >
        {status}
      </span>
    </div>
  )
}
