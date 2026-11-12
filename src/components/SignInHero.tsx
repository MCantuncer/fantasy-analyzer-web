import { ArrowUp, ArrowsLeftRight, GridNine, Percent, Users, type Icon } from '@phosphor-icons/react'
import { useState } from 'react'
import './SignInHero.css'

/*
 * The sign-in page's hero: COURT read down the capitals. Each word stands on its floor (the pieces of the rail
 * that joins C and T in the wordmark) with one line on what it means. Static; on the first visit on a device
 * the words drop into the column once.
 */

const ROWS: { word: string; desc: string; icon: Icon }[] = [
  { word: 'Categories', desc: '9-cat standings, all week', icon: GridNine },
  { word: 'Odds', desc: 'Playoff odds, simulated', icon: Percent },
  { word: 'Upgrades', desc: 'Free agents worth a pickup', icon: ArrowUp },
  { word: 'Rosters', desc: 'Every team’s roster', icon: Users },
  { word: 'Trades', desc: 'Ranked by playoff odds', icon: ArrowsLeftRight },
]

const SEEN_KEY = 'court-hero-seen'

/** True only the first time this device shows the hero. Storage can be missing or blocked. */
function firstVisit(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false
    localStorage.setItem(SEEN_KEY, '1')
    return true
  } catch {
    return false
  }
}

export function SignInHero() {
  const [drop] = useState(firstVisit)
  return (
    <section className={`signin-hero${drop ? ' drop' : ''}`} aria-labelledby="signin-hero-title">
      <h1 id="signin-hero-title" className="sr-only">
        COURT
      </h1>
      <ul className="sr-only">
        {ROWS.map((r) => (
          <li key={r.word}>
            {r.word}: {r.desc}
          </li>
        ))}
      </ul>
      <ol className="hero-rows" aria-hidden="true">
        {ROWS.map((r, i) => {
          const I = r.icon
          return (
            <li key={r.word} style={{ '--i': i } as React.CSSProperties}>
              <span className="hero-word">
                <b>{r.word[0]}</b>
                {r.word.slice(1)}
                <span className="hero-floor" />
              </span>
              <span className="hero-desc">
                <I size={18} />
                {r.desc}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="hero-line">Built for ESPN head-to-head 9-category leagues.</p>
    </section>
  )
}
