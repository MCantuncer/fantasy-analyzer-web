import { useEffect, useState } from 'react'

type Step = { label: string; state: 'done' | 'now' | 'todo' }

function Icon({ state }: { state: Step['state'] }) {
  if (state === 'done')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="var(--good)" />
        <path d="M6 10l3 3 5-6" stroke="var(--on-good)" strokeWidth="2" fill="none" />
      </svg>
    )
  if (state === 'now')
    return (
      <svg className="spinner" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="30 20" />
      </svg>
    )
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="var(--border)" strokeWidth="2" fill="none" />
    </svg>
  )
}

function useElapsed() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return seconds
}

/** Loading card. phase 'league' while the league loads, 'analysis' while moves are computed. */
export function Status({ phase, leagueName }: { phase: 'league' | 'analysis'; leagueName?: string }) {
  const seconds = useElapsed()
  // The free server sleeps when idle; a slow first answer almost always means it is waking up.
  const waking = phase === 'league' && seconds >= 4
  const steps: Step[] =
    phase === 'league'
      ? [
          { label: waking ? 'Waking up the server' : 'Reaching the server', state: 'now' },
          { label: 'Loading your league', state: 'todo' },
          { label: 'Simulating the season', state: 'todo' },
          { label: 'Screening every trade and pickup', state: 'todo' },
        ]
      : [
          { label: 'Server awake', state: 'done' },
          { label: leagueName ? `League loaded · ${leagueName}` : 'League loaded', state: 'done' },
          { label: 'Simulating the season', state: seconds < 3 ? 'now' : 'done' },
          { label: 'Screening every trade and pickup', state: seconds < 3 ? 'todo' : 'now' },
        ]

  return (
    <section className="card status" aria-live="polite" aria-busy="true">
      <h2>{waking ? 'Waking up the analyzer' : phase === 'league' ? 'Loading your league' : 'Finding your best moves'}</h2>
      <p className="small muted">
        {waking
          ? 'The free server naps when nobody uses it. The first load can take up to a minute; after that it is quick.'
          : phase === 'analysis'
            ? 'This takes a few seconds.'
            : 'One moment.'}
      </p>
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.label} className={s.state}>
            <Icon state={s.state} />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {seconds >= 4 && <span className="small muted tnum">{seconds}s</span>}
    </section>
  )
}
