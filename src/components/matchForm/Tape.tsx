import { Flame, GlobeSimple, Snowflake } from '@phosphor-icons/react'
import { useRef } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { clock } from '../../lib/iddaaCompare'
import { FORM_GAMES, LAST_GAMES, barHeight, dayDate, formRead, marginOf, nick, signedMargin } from '../../lib/matchForm'
import type { FormGame, Side, TeamForm } from '../../lib/matchForm'
import { TeamLogo } from '../PlayerHead'

/** The Tape: each team's last ten winning margins as bars, oldest to newest, running into tonight.
 *  Wins rise in green, losses drop in red; bars stop at 20 points with a pointed end, and the label
 *  keeps the real number. The last five carry the hot/cold edge. */
export function Tape({
  away,
  home,
  shown,
  venue,
  tip,
  picked,
  onPick,
}: {
  away: TeamForm
  home: TeamForm
  shown: Record<Side, FormGame[]>
  venue: boolean
  tip: string | null
  picked: number | null
  onPick: (side: Side, gameId: number) => void
}) {
  return (
    <section className="mf-tape-s" aria-labelledby="mf-tape-h">
      <div className="mf-blk-h">
        <h3 id="mf-tape-h">The Tape</h3>
        <p>Winning margin per game, newest on the right. Bars stop at 20; the number is the real one.</p>
      </div>
      <div className="mf-tape">
        <Lane team={away} side="away" games={shown.away} venue={venue} tip={tip} picked={picked} onPick={onPick} />
        <Lane team={home} side="home" games={shown.home} venue={venue} tip={null} picked={picked} onPick={onPick} />
      </div>
    </section>
  )
}

function Lane({
  team,
  side,
  games,
  venue,
  tip,
  picked,
  onPick,
}: {
  team: TeamForm
  side: Side
  games: FormGame[]
  venue: boolean
  tip: string | null
  picked: number | null
  onPick: (side: Side, gameId: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const list = games.slice(0, LAST_GAMES).reverse() // oldest to newest
  const pad = LAST_GAMES - list.length
  const read = formRead(games)
  const lit = Math.min(FORM_GAMES, list.length)
  const sel = list.findIndex((g) => g.game_id === picked)
  const stop = sel >= 0 ? sel : list.length - 1
  const where = venue ? (side === 'home' ? ' at home' : ' on the road') : ''
  const key = (e: ReactKeyboardEvent) => {
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.mf-col[data-id]') ?? [])]
    const at = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: btns.length - 1 }[e.key]
    if (to == null || to < 0 || to >= btns.length) return
    e.preventDefault()
    btns.forEach((b, i) => (b.tabIndex = i === to ? 0 : -1))
    btns[to].focus()
  }
  return (
    <>
      <div className="mf-lane-h">
        <TeamLogo abbrev={team.abbrev} size={30} fallback />
        <span className="t">
          <b>{nick(team.abbrev)}</b>
          <span>
            <span className="num">
              {team.wins}-{team.losses}
            </span>{' '}
            · {side}
          </span>
        </span>
      </div>
      <div
        ref={ref}
        className="mf-bars"
        role="group"
        aria-label={`${nick(team.abbrev)}, last ${list.length}${where}, oldest to newest`}
        onKeyDown={key}
      >
        {Array.from({ length: pad }, (_, i) => (
          <span key={`gap${i}`} className="mf-col gap" aria-hidden="true">
            <span className="up" />
            <span className="dn">
              <i className="dot" />
            </span>
            <span className="foot" />
          </span>
        ))}
        {list.map((g, i) => {
          const m = marginOf(g)
          const { h, capped } = barHeight(m, 1)
          const bar = <i className={`bar${capped ? ' cap' : ''}`} style={{ '--r': h, '--i': i } as CSSProperties} />
          const label = (
            <b className="ml num">{signedMargin(m)}</b>
          )
          const va = g.neutral ? 'neutral site vs' : g.home ? 'vs' : 'at'
          return (
            <button
              key={g.game_id}
              type="button"
              data-id={g.game_id}
              className={`mf-col${i < list.length - FORM_GAMES ? ' old' : ''}`}
              aria-pressed={g.game_id === picked}
              aria-label={`${dayDate(g.date)}, ${va} ${nick(g.opponent)}, ${g.won ? 'won' : 'lost'} ${g.points}-${g.opponent_points}, ${signedMargin(m)}${g.kind === 'cup' ? ', NBA Cup' : ''}`}
              tabIndex={i === stop ? 0 : -1}
              onClick={() => onPick(side, g.game_id)}
            >
              <span className="up">
                {g.won && label}
                {g.won && bar}
              </span>
              <span className="dn">
                {!g.won && bar}
                {!g.won && label}
              </span>
              <span className="foot">
                <TeamLogo abbrev={g.opponent} size={22} fallback />
                <span className="vm">{g.neutral ? <GlobeSimple size={12} weight="bold" /> : g.home ? 'vs' : '@'}</span>
              </span>
            </button>
          )
        })}
        {lit > 0 && (
          <span className={`mf-edge ${read.heat}`} style={{ left: `${((LAST_GAMES - lit) / LAST_GAMES) * 100}%` }} aria-hidden="true">
            <i />
            <span>
              {read.heat === 'hot' && <Flame size={12} weight="fill" />}
              {read.heat === 'cold' && <Snowflake size={12} weight="fill" />}
              Last {lit}
              {venue ? (side === 'home' ? ' · At Home' : ' · On The Road') : ''}
            </span>
          </span>
        )}
      </div>
      <div className={`mf-tonight ${side}`} aria-hidden="true">
        {tip != null && (
          <span className="tn">
            Tonight
            <b className="num">{tip ? clock(tip) : ''}</b>
          </span>
        )}
        <span className="me">
          <TeamLogo abbrev={team.abbrev} size={34} fallback />
        </span>
      </div>
    </>
  )
}
