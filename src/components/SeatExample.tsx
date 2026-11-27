import { ArrowRight, IdentificationBadge } from '@phosphor-icons/react'
import type { StatValue } from '../lib/catStrip'
import { CatStripPair } from './CatStrip'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import { YourCrest } from './YourCrest'
import './SeatExample.css'

// Fixed sample data: Kucukesat Aspavas against Çayyolu Bastards, 2–5–2 today, from the Line Score shots.
const STATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const figures = (values: number[]): StatValue[] => STATS.map((stat, i) => ({ stat, value: values[i] }))
const YOU = {
  id: -1,
  name: 'Kucukesat Aspavas',
  short: 'You',
  colour: '#f5b53d',
  today: figures([0.5, 1, 1, 6, 5, 1, 0, 3, 21]),
  week: figures([0.509, 0.744, 60, 225, 134, 37, 25, 62, 539]),
}
const THEM = {
  id: -2,
  name: 'Çayyolu Bastards',
  short: 'Bastards',
  colour: '#a3e35a',
  today: figures([0.429, 1, 5, 30, 16, 5, 0, 5, 53]),
  week: figures([0.476, 0.746, 82, 181, 144, 37, 11, 69, 669]),
}
const RUNGS = 10
const PLAYOFF = 6
const YOUR_RUNG = 6

/**
 * League, before you pick your team: an inert example of what the page shows a manager (your
 * matchup live, your playoff odds, your best trade every morning). Nothing in it can be pressed: the
 * banner's "Pick my team" is the one action.
 */
export function SeatExample() {
  return (
    <section className="lx-seat" aria-labelledby="lx-title">
      <h2 id="lx-title" className="lx-h">
        <IdentificationBadge className="lx-h-ic" aria-hidden="true" />
        Once you pick your team
      </h2>
      <p className="lx-sub">Example: how this page reads for Kucukesat Aspavas</p>
      <p className="sr-only">It shows your matchup live, your playoff odds, and your best trade every morning.</p>
      <div className="lx-panel" inert aria-hidden="true">
        <div className="lx-piece lx-mu">
          <h3 className="lx-ph">Your matchup, live</h3>
          <p className="lx-score">
            <YourCrest name={YOU.name} colour={YOU.colour} size={22} mine />
            <span>You</span>
            <b className="num">
              2<i>–</i>5<i>–</i>2
            </b>
            <span>{THEM.short}</span>
            <TeamCrest name={THEM.name} colour={THEM.colour} size={22} />
          </p>
          <CatStripPair a={YOU} b={THEM} top="today" mine="a" keyed="crest" label="Example matchup, today" />
        </div>

        <div className="lx-piece lx-odds">
          <h3 className="lx-ph">Your playoff odds</h3>
          <p className="lx-big">
            <b className="num">54%</b>
            <span>6th best of 10</span>
          </p>
          <div className="lx-ladder">
            {Array.from({ length: RUNGS }, (_, i) => (
              <span
                key={i}
                className={`lx-rung${i + 1 === YOUR_RUNG ? ' lx-you' : ''}${i === PLAYOFF ? ' lx-cut' : ''}`}
              />
            ))}
          </div>
          <div className="lx-ends">
            <span>1st</span>
            <span className="lx-line">top {PLAYOFF} make it</span>
            <span>{RUNGS}th</span>
          </div>
        </div>

        <div className="lx-piece lx-trade">
          <h3 className="lx-ph">Your best trade, every morning</h3>
          <p className="lx-swap">
            <PlayerHead player={{ id: 0, name: 'Jarrett Allen' }} size={26} />
            <span>J. Allen</span>
            <ArrowRight className="lx-arrow" />
            <PlayerHead player={{ id: 0, name: 'Amen Thompson' }} size={26} />
            <span>A. Thompson</span>
          </p>
          <p className="lx-with">
            <TeamCrest name="Aachen ShowManners" colour="#f97b3d" size={18} />
            with Aachen ShowManners
          </p>
          <p className="lx-big">
            <b className="num">56%</b>
            <span>from 54%</span>
            <span className="lx-gain num">+2 pts</span>
          </p>
        </div>
      </div>
    </section>
  )
}
