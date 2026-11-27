import { useState } from 'react'
import type { Game } from '../api/client'
import { band, firstFinal, percent, pick, tally, timesInTen, verdict, type Call } from '../lib/ourCall'
import { nickname } from '../lib/scores'
import './OurCall.css'

/* Our call on the Scores page (Plate): the score we expected for each side, locked at tip-off, in
   its own column on a faint plate right of the score, named in the card's foot with how sure we were
   of the winner. After the final, one word judges the winner pick and one number says how far off
   we were. Drawn large, in outline, in exactly one place: the box score. */

const AVG_MISS = 9 // a team's score, points: 8.9-9.4 in each of five seasons (api scripts/game_score_backtest.py)

/** The open caret: the outline of the house's solid winner caret, after our pick. */
function OpenCaret({ className = 'open-caret' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 8 10" width="7" height="9" aria-hidden="true">
      <path d="M7.2 1v8L1 5z" />
    </svg>
  )
}

function SolidCaret() {
  return (
    <svg className="win-caret" viewBox="0 0 6 8" width="6" height="8" aria-hidden="true">
      <path d="M6 0v8L0 4z" />
    </svg>
  )
}

/** One side's figure in a team row's fourth column. */
export function CallCell({ call, side }: { call: Call; side: 'away' | 'home' }) {
  return (
    <span className={`call${pick(call) === side ? ' call-pick' : ''}`} aria-hidden="true">
      <span className="num">{call[side]}</span>
      <OpenCaret />
    </span>
  )
}

/** The ledger's last line under the two teams: the game's total, ours on the plate under our two
    figures (with a short rule, like a sum) and, from tip-off, the real one in the score column. */
export function CallTotal({ game }: { game: Game }) {
  const c = game.call
  if (!c) return null
  const a = game.away.score
  const h = game.home.score
  const real = game.status !== 'scheduled' && a != null && h != null ? a + h : null
  return (
    <span className="call-total-row" aria-hidden="true">
      <span />
      <span className="ct-label">Total</span>
      <span className="ct-real num">{real ?? ''}</span>
      <span className="ct-call num">{c.away + c.home}</span>
    </span>
  )
}

/** The flat plate behind both figures: a slip with our numbers on it. Not a line, no glow. */
export function CallPlate() {
  return <span className="call-plate" aria-hidden="true" />
}

/** "Our call · 84%" in the foot; only the figure takes its band's colour. */
export function CallLabel({ call }: { call: Call }) {
  const pct = percent(call)
  return (
    <span className="call-label" aria-hidden="true">
      Our call{' '}
      <span className="conf-band" data-band={band(pct)}>
        · <span className="num">{pct}%</span>
      </span>
    </span>
  )
}

/** After "Final": a tick and "Called it", or a cross and "Missed", then "off by N". */
export function CallVerdict({ game }: { game: Game }) {
  const v = verdict(game)
  // The mark draws the first time this browser sees the game final; after that it just sits there.
  const [fresh] = useState(() => v != null && firstFinal(game.id))
  if (!v) return null
  return (
    <span className={`call-verdict${fresh ? ' fresh' : ''}`} aria-hidden="true">
      {v.called ? (
        <svg className="tick" viewBox="0 0 12 10" width="12" height="10">
          <path d="M1.2 5.4 4.4 8.4 10.8 1.4" />
        </svg>
      ) : (
        <svg className="cross" viewBox="0 0 10 10" width="10" height="10">
          <path d="M1.5 1.5l7 7" />
          <path d="M8.5 1.5l-7 7" />
        </svg>
      )}
      <span className="word">{v.called ? 'Called it' : 'Missed'}</span>
      <span className="off">
        · off by <span className="num">{v.off}</span>
      </span>
    </span>
  )
}

/** The card's sentence for screen readers (the column, label and verdict are hidden from them). */
export function CallSentence({ game }: { game: Game }) {
  const c = game.call
  if (!c) return null
  const away = nickname(game.away.name)
  const home = nickname(game.home.name)
  const pair = `${away} ${c.away}, ${home} ${c.home}, ${c.away + c.home} in all, ${percent(c)}% sure of the ${pick(c) === 'home' ? home : away}`
  const v = verdict(game)
  let text = `Our call, locked at tip-off: ${pair}.`
  if (game.status === 'scheduled') text = `Our call: ${pair}. Locks at tip-off.`
  else if (v)
    text += ` ${v.called ? 'Called the winner' : 'Missed the winner'}. Off by at most ${v.off} points for either team.`
  return <span className="sr-only">{text}</span>
}

/** Our calls on the summary row, once a final with a call lands: "Our calls tonight 1 of 1 right ·
    15 pts off a team". Past days read "Our calls". What "Our call" means lives in How this works. */
export function CallTally({ games, today }: { games: Game[]; today: boolean }) {
  const t = tally(games)
  if (!t) return null
  return (
    <span className="call-tally">
      {today ? 'Our calls tonight' : 'Our calls'}{' '}
      <b className="num">
        {t.right} of {t.finals}
      </b>{' '}
      right <span className="dot">·</span> <b className="num">{t.avg}</b> pts off a team
    </span>
  )
}

/** The box score's band: our call drawn large in outline on its plate, the real score below in solid ink. */
export function CallBand({ game }: { game: Game }) {
  const c = game.call
  const a = game.away.score
  const h = game.home.score
  if (!c || a == null || h == null) return null
  const final = game.status === 'final'
  const pct = percent(c)
  const picked = pick(c)
  const lead = a === h ? null : h > a ? 'home' : 'away'
  const v = verdict(game)
  const fig = (side: 'away' | 'home') => (
    <span className={`big solid${lead && lead !== side ? ' trail' : ''}`} role="cell">
      {game[side].score}
      {final && lead === side && <SolidCaret />}
    </span>
  )
  const fav = picked === 'home' ? game.home.abbrev : game.away.abbrev
  const won = lead === 'home' ? game.home.abbrev : game.away.abbrev
  const worst =
    v &&
    (v.misses[0] >= v.misses[1] ? { side: game.away, got: a, ours: c.away } : { side: game.home, got: h, ours: c.home })
  return (
    <div className="callband">
      <div
        className="ledger-mini"
        role="table"
        aria-label={`Our call against the ${final ? 'final' : 'current'} score`}
      >
        <div className="lm-row head" role="row">
          <span role="columnheader">
            <span className="sr-only">Row</span>
          </span>
          <span className="h" role="columnheader">
            {game.away.abbrev}
          </span>
          <span className="h" role="columnheader">
            {game.home.abbrev}
          </span>
        </div>
        <div className="lm-row call-row" role="row">
          <span className="rl" role="rowheader">
            Our call
            <small className="conf-band" data-band={band(pct)}>
              <span className="num">{pct}%</span> sure
            </small>
          </span>
          <span className="big hollow" role="cell">
            {c.away}
            {picked === 'away' && <OpenCaret className="oc" />}
          </span>
          <span className="big hollow" role="cell">
            {c.home}
            {picked === 'home' && <OpenCaret className="oc" />}
          </span>
        </div>
        <div className="lm-gap" aria-hidden="true" />
        <div className="lm-row" role="row">
          <span className="rl" role="rowheader">
            {final ? 'Final' : 'Now'}
          </span>
          {fig('away')}
          {fig('home')}
        </div>
      </div>
      <div className="callnote">
        {v && worst ? (
          <>
            <p className="lead">
              {v.called ? 'Called it' : 'Missed'}. We said {fav} by{' '}
              <span className="num">{Math.abs(c.home - c.away)}</span>, <span className="num">{pct}%</span> sure; {won}{' '}
              won by <span className="num">{Math.abs(h - a)}</span>.
            </p>
            <p>
              Off by <span className="num">{v.off}</span>: the bigger of the two misses, {nickname(worst.side.name)}{' '}
              {worst.got} against our {worst.ours}. Total: <span className="num">{c.away + c.home}</span> called,{' '}
              <span className="num">{a + h}</span> played.
            </p>
            <p className="fine">
              At <span className="num">{pct}%</span>, a pick like this is {v.called ? 'right' : 'wrong'} about{' '}
              {timesInTen(pct, v.called)} times in 10. Our calls miss a team's score by about {AVG_MISS} points on
              average. Locked at tip-off, never corrected.
            </p>
          </>
        ) : (
          <p className="fine">
            Our calls miss a team's score by about {AVG_MISS} points on average and pick the winner in about 2 games of
            3. Locked at tip-off, never corrected.
          </p>
        )}
      </div>
    </div>
  )
}
