import { useState } from 'react'
import type { ReportChange } from '../api/client'
import { percent } from '../lib/progress'
import { Spinner } from './Spinner'
import './NewsSince.css'

const SHOWN = 3

export interface NewsSinceProps {
  changes: ReportChange[]
  /** True while the moves are being worked out again for this news. */
  running: boolean
  progress: number
  onDismiss: () => void
}

/** What moved in the league since the report on screen was built, while (and after) it is updated. */
export function NewsSince({ changes, running, progress, onDismiss }: NewsSinceProps) {
  const [open, setOpen] = useState(false)
  const shown = open ? changes : changes.slice(0, SHOWN)
  const more = changes.length - SHOWN
  return (
    <section className="card ns-card" aria-labelledby="ns-title" aria-busy={running}>
      <div className="ns-head">
        <h2 className="ns-title" id="ns-title">
          {running ? 'News since your last look' : 'Your moves now include this news'}
        </h2>
        {running ? (
          <span className="ns-status small" role="status">
            <Spinner />
            <span className="muted">Updating your moves</span>
            <span className="tnum ns-pct">{percent(progress)}</span>
          </span>
        ) : (
          <button type="button" className="icon ns-close" aria-label="Dismiss" onClick={onDismiss}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
      </div>
      <ul className="ns-list">
        {shown.map((c, i) => (
          <li key={`${c.kind}-${c.player_id ?? i}`} className={c.mine ? 'ns-item ns-mine' : 'ns-item'}>
            <span className="ns-dot" aria-hidden="true" />
            <span>{c.text}</span>
            {c.mine && <span className="sr-only"> (your team)</span>}
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button type="button" className="link small ns-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : `${more} more`}
        </button>
      )}
    </section>
  )
}
