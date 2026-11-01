import { percent } from '../lib/progress'

const STEPS = [
  {
    label: 'Loading your league',
    stages: ['Starting', 'Loading your league', 'Reading rosters'],
  },
  {
    label: 'Screening trades',
    stages: ['Screening trades', 'Screening edge trades'],
  },
  { label: 'Screening pickups', stages: ['Screening pickups'] },
  { label: 'Simulating the season', stages: ['Simulating the season'] },
]

function stepIndex(stage: string) {
  const i = STEPS.findIndex((s) => s.stages.includes(stage))
  return i < 0 ? 0 : i
}

interface CardProps {
  progress: number
  stage: string
  onBrowse: (tab: 'scores' | 'news' | 'chat' | 'league') => void
}

/** Shown in place of a tab that needs the analysis while it runs. */
export function AnalysisCard({ progress, stage, onBrowse }: CardProps) {
  const now = stepIndex(stage)
  const pct = percent(progress)
  return (
    <section className="card analysis-card stack" aria-labelledby="analysis-title">
      <div className="analysis-head">
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h2 id="analysis-title">Finding your best moves</h2>
          <span className="small muted" aria-live="polite">
            {STEPS[now].label}…
          </span>
        </div>
        <span className="analysis-pct num tnum" aria-hidden="true">
          {pct}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(progress * 100)}
      >
        <span style={{ width: pct }} />
      </div>
      <ol className="analysis-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i < now ? 'done' : i === now ? 'now' : 'todo'}>
            {s.label}
          </li>
        ))}
      </ol>
      <div className="analysis-browse stack">
        <p className="small muted">
          This runs on our server, so you can keep using the app. We'll let you know when your moves are ready.
        </p>
        <div className="row">
          <button type="button" className="secondary" onClick={() => onBrowse('scores')}>
            Scores
          </button>
          <button type="button" className="secondary" onClick={() => onBrowse('league')}>
            League
          </button>
          <button type="button" className="secondary" onClick={() => onBrowse('news')}>
            NBA News
          </button>
          <button type="button" className="secondary" onClick={() => onBrowse('chat')}>
            League chat
          </button>
        </div>
      </div>
    </section>
  )
}

/** Small top-bar indicator, visible from every tab while the analysis runs. */
export function AnalysisPill({ progress, onClick }: { progress: number; onClick: () => void }) {
  return (
    <button type="button" className="analysis-pill" onClick={onClick} title="Finding your best moves">
      <svg className="spinner" width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="30 20" />
      </svg>
      <span className="hide-sm">Analyzing</span>
      <span className="tnum">{percent(progress)}</span>
      <span className="sr-only">done. Show progress.</span>
    </button>
  )
}

/** Tells someone browsing another tab that their moves are in. */
export function ReadyToast({ onView, onDismiss }: { onView: () => void; onDismiss: () => void }) {
  return (
    <div className="toast" role="status">
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="var(--good)" />
        <path d="M6 10l3 3 5-6" stroke="var(--on-good)" strokeWidth="2" fill="none" />
      </svg>
      <span>Your moves are ready</span>
      <button type="button" className="link" onClick={onView}>
        View moves
      </button>
      <button type="button" className="icon" aria-label="Dismiss" onClick={onDismiss}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
    </div>
  )
}
