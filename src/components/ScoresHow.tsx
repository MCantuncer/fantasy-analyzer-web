import { useId, useState } from 'react'
import { CaretDown, Info } from '@phosphor-icons/react'

/** The foot of Scores: a bare "How this works" row that opens three short notes (what Our call
    and its % colours mean, where the scores and clock come from, and what Owner means). */
export function ScoresHow() {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <section className="sc-how">
      <button
        type="button"
        className="sc-how-row"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Info className="sc-how-ic" aria-hidden="true" />
        <b>How this works</b>
        <CaretDown className="sc-how-caret" aria-hidden="true" />
      </button>
      <ul id={id} className="sc-how-notes" hidden={!open}>
        <li>
          <b>Our call</b> is our score for each game, locked at tip-off. The % is how sure we are of the winner:{' '}
          <span className="kw" data-band="sure">
            green
          </span>{' '}
          sure,{' '}
          <span className="kw" data-band="lean">
            amber
          </span>{' '}
          a lean,{' '}
          <span className="kw" data-band="flip">
            grey
          </span>{' '}
          a coin flip.
        </li>
        <li>Scores add up ESPN's fantasy stats and refresh every minute while games are live; the clock is ESPN's.</li>
        <li>
          <b>Owner</b> in a box score is the fantasy team in this league.
        </li>
      </ul>
    </section>
  )
}
