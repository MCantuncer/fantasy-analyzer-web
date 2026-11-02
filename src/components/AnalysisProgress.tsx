import { useEffect, useState } from 'react'
import { percent } from '../lib/progress'

// ``short`` names the dot on the stepper; ``label`` is the line under the heading.
const STEPS = [
  { short: 'Server', label: 'Waking up the server', stages: [] as string[] },
  {
    short: 'League',
    label: 'Loading your league',
    stages: ['Starting', 'Loading your league', 'Reading rosters'],
  },
  {
    short: 'Trades',
    label: 'Screening trades',
    stages: ['Screening trades', 'Screening edge trades'],
  },
  { short: 'FAs', label: 'Screening free agents', stages: ['Screening pickups'] },
  { short: 'Season', label: 'Simulating the season', stages: ['Simulating the season'] },
]

function stepIndex(stage: string) {
  const i = STEPS.findIndex((s) => s.stages.includes(stage))
  return i < 0 ? 1 : i
}

function StepDot({ state }: { state: 'done' | 'now' | 'todo' }) {
  if (state === 'done')
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 6.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    )
  return null
}

const stroke = { stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const BROWSE: { tab: 'scores' | 'league' | 'news' | 'chat'; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    tab: 'scores',
    label: 'Scores',
    desc: "Tonight's box scores for every rostered player",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2.5" y="3.5" width="13" height="11" rx="2" {...stroke} />
        <path d="M9 3.5v11M2.5 9h3M12.5 9h3" {...stroke} />
      </svg>
    ),
  },
  {
    tab: 'league',
    label: 'League',
    desc: "Standings, this week's matchups and the MVP race",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M3 15V9M7.5 15V4M12 15v-4M15.5 15H2" {...stroke} />
      </svg>
    ),
  },
  {
    tab: 'news',
    label: 'NBA News',
    desc: 'Injuries, returns and who gains minutes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2.5" y="3" width="13" height="12" rx="2" {...stroke} />
        <path d="M5.5 6.5h7M5.5 9h7M5.5 11.5h4" {...stroke} />
      </svg>
    ),
  },
  {
    tab: 'chat',
    label: 'League Chat',
    desc: 'Trades, waiver claims and banter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M3 4.5h12v7H8l-3 2.5v-2.5H3z" {...stroke} />
      </svg>
    ),
  },
]

interface CardProps {
  progress: number
  stage: string
  onBrowse: (tab: 'scores' | 'news' | 'chat' | 'league') => void
  /** True until the (possibly sleeping) server answers with the league. */
  waking?: boolean
  /** Heading while waking, for a league whose moves this account won't get. */
  title?: string
}

/** Shown in place of a tab that needs the analysis while it runs. */
function useSeconds(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])
  return seconds
}

export function AnalysisCard({ progress, stage, onBrowse, waking = false, title = 'Finding your best moves' }: CardProps) {
  const wakingFor = useSeconds(waking)
  const now = waking ? 0 : stepIndex(stage)
  const pct = percent(progress)
  return (
    <section className={`card analysis-card stack${waking ? ' waking' : ''}`} aria-labelledby="analysis-title">
      <div className="analysis-head">
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h2 id="analysis-title">{title}</h2>
          <span className="small muted" aria-live="polite">
            {STEPS[now].label}…
          </span>
        </div>
        <span className="analysis-pct num tnum" aria-hidden="true">
          {waking ? (wakingFor >= 4 ? `${wakingFor}s` : '') : pct}
        </span>
      </div>
      {waking && wakingFor >= 4 && (
        <p className="small muted analysis-note">
          The free server naps when nobody uses it. The first load can take up to a minute; after that it's quick.
        </p>
      )}
      <div
        className="progress"
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={waking ? undefined : Math.floor(progress * 100)}
        aria-valuetext={waking ? 'Waking up the server' : undefined}
      >
        <span style={waking ? undefined : { width: pct }} />
      </div>
      <ol className="stepper" aria-label="Steps">
        {STEPS.map((s, i) => {
          const state = i < now ? 'done' : i === now ? 'now' : 'todo'
          return (
            <li key={s.short} className={state} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="stepper-dot">
                <StepDot state={state} />
              </span>
              <span className="stepper-label">{s.short}</span>
              <span className="sr-only">
                {state === 'done' ? ', done' : state === 'now' ? ', in progress' : ''}
              </span>
            </li>
          )
        })}
      </ol>
      <nav className="wait-list" aria-labelledby="wait-title">
        <div className="wait-head">
          <span className="eyebrow" id="wait-title">
            While you wait
          </span>
          <span className="small muted">
            {waking ? 'These open as soon as the server is up.' : "We'll let you know when your moves are ready."}
          </span>
        </div>
        <ul>
          {BROWSE.map((b) => (
            <li key={b.tab}>
              <button type="button" className="wait-item" disabled={waking} onClick={() => onBrowse(b.tab)}>
                <span className="wait-icon" aria-hidden="true">
                  {b.icon}
                </span>
                <span className="wait-text">
                  <span className="wait-title">{b.label}</span>
                  <span className="wait-desc">{b.desc}</span>
                </span>
                <svg className="wait-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </nav>
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
