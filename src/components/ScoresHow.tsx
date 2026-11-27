import { HowItWorks } from './HowItWorks'

/** The foot of Scores: the shared "How this works" row with three short notes (what Our call and
    its % colours mean, where the scores and clock come from, and what Owner means). */
export function ScoresHow() {
  return (
    <HowItWorks
      notes={[
        <>
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
        </>,
        <>Scores add up ESPN's fantasy stats and refresh every minute while games are live; the clock is ESPN's.</>,
        <>
          <b>Owner</b> in a box score is the fantasy team in this league.
        </>,
      ]}
    />
  )
}
