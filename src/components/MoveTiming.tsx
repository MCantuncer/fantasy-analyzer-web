import type { PlayerRef } from '../api/client'
import { lastName, longDay, spotDays, spotGames, type MoveTiming } from '../lib/moveTiming'
import './MoveTiming.css'

/** Where the seam goes: before the first day the new player has the spot (after the last when it's next week). */
function seamAt(t: MoveTiming): number {
  const i = t.days.findIndex((d) => !t.next_week && d.date >= t.make_on)
  return i < 0 ? t.days.length : i
}

/**
 * The roster spot over the days left: one cell a day naming who plays in it, cut by an ink
 * seam where the spot changes hands. Shown when waiting beats making the move now.
 */
export function SpotDays({ timing, add, drop }: { timing: MoveTiming; add: PlayerRef; drop: PlayerRef }) {
  const cells = spotDays(timing)
  const seam = seamAt(timing)
  const games = spotGames(timing)
  const name = (who: 'add' | 'drop' | null) =>
    who === 'add' ? lastName(add.name) : who === 'drop' ? lastName(drop.name) : 'Off'
  const said = cells
    .map((c, i) => `${i === 0 ? 'Today' : longDay(c.day.date)}: ${c.who ? `${name(c.who)} plays` : 'off'}`)
    .join('. ')
  const columns = [
    ...cells.map((_, i): string => (i === seam ? '2px minmax(0, 1fr)' : 'minmax(0, 1fr)')),
    ...(seam === cells.length ? ['2px'] : []),
  ].join(' ')
  return (
    <div
      className="mt-spot"
      role="img"
      aria-label={`Your roster spot, days left. ${said}. ${games.best} games in the spot; ${games.now} if made today.`}
    >
      <p className="mt-spot-head" aria-hidden="true">
        <span className="mt-lead">
          <span className="num">{games.best}</span> games in the spot
        </span>{' '}
        · <span className="num">{games.now}</span> if made today
      </p>
      <ol
        className="mt-days"
        style={{ gridTemplateColumns: columns }}
        data-many={cells.length > 5 || undefined}
        aria-hidden="true"
      >
        {cells.flatMap((c, i) => {
          const cut = i === seam - 1 ? ' mt-cut-r' : i === seam ? ' mt-cut-l' : ''
          const cell = (
            <li key={c.day.date} className={`mt-d ${c.who ? 'mt-plays' : 'mt-off'}${cut}`}>
              <span className="mt-day">
                {i === 0 && <i className="mt-live" />}
                {i === 0 ? 'Today' : longDay(c.day.date).slice(0, 3)}
              </span>
              <span className="mt-who">{name(c.who)}</span>
            </li>
          )
          return i === seam ? [<li key="seam" className="mt-seam" />, cell] : [cell]
        })}
        {seam === cells.length && <li key="seam" className="mt-seam" />}
      </ol>
    </div>
  )
}

/** The same hand-off at row size: one letter a day, lit where the spot has a game, and the seam. */
export function SpotStrip({ timing }: { timing: MoveTiming }) {
  const cells = spotDays(timing)
  const seam = seamAt(timing)
  return (
    <span className="mt-strip" aria-hidden="true">
      {cells.map((c, i) => (
        <span key={c.day.date} className="mt-strip-cell">
          {i === seam && <b className="mt-strip-seam" />}
          <i className={`${c.who ? 'on' : ''}${i === seam - 1 ? ' cut-r' : i === seam ? ' cut-l' : ''}`}>
            {longDay(c.day.date)[0]}
          </i>
        </span>
      ))}
      {seam === cells.length && <b className="mt-strip-seam" />}
    </span>
  )
}
