import { useState } from 'react'
import { parseLeagueInput } from '../lib/espnUrl'

const SAMPLE_LEAGUE = '744636428'

export function Landing({ initial, onSubmit }: { initial: string; onSubmit: (input: string) => void }) {
  const [input, setInput] = useState(initial)
  const [tried, setTried] = useState(false)
  const valid = Boolean(parseLeagueInput(input).leagueId)

  return (
    <div className="landing">
      <div className="landing-copy">
        <span className="eyebrow" style={{ color: 'var(--accent-text)' }}>
          ESPN fantasy basketball · H2H categories
        </span>
        <h1>Know your next move.</h1>
        <p className="lead">
          Trades the other owner should accept, pickups with the right drop, and how each one changes your playoff
          odds.
        </p>
        <form
          className="landing-form"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (valid) onSubmit(input)
          }}
        >
          <label htmlFor="league-input">League ID or your ESPN team page link</label>
          <div className="input-row">
            <input
              id="league-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 744636428"
              inputMode="url"
              autoComplete="off"
              autoFocus
              aria-invalid={tried && !valid}
              aria-describedby={tried && !valid ? 'league-error' : undefined}
            />
            <button type="submit">Analyze my team</button>
          </div>
          {tried && !valid && (
            <span id="league-error" className="small bad">
              Enter a league ID (numbers only) or paste the link to your ESPN team page.
            </span>
          )}
          <span className="small muted">
            Private league? You'll be asked for two ESPN cookies next; they stay in your browser.{' '}
            <button type="button" className="link" onClick={() => onSubmit(SAMPLE_LEAGUE)}>
              Try a sample league
            </button>
          </span>
        </form>
        <ul className="points">
          <li>
            <strong>Playoff odds</strong>
            <span className="small muted">thousands of simulated seasons</span>
          </li>
          <li>
            <strong>Fair trades</strong>
            <span className="small muted">valued the way owners see them</span>
          </li>
          <li>
            <strong>Smart pickups</strong>
            <span className="small muted">every add tested against every drop</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
