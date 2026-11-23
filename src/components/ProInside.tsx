import type { CSSProperties } from 'react'
import { CaretLeft, Clock } from '@phosphor-icons/react'
import { teamLight } from '../lib/nbaTeams'
import { PRICES } from '../lib/plans'
import { usePro } from '../lib/pro'
import { Chance } from './EstimateBits'
import { ProMark } from './Pro'
import { TeamLogo } from './PlayerHead'
import './ProInside.css'

/** One made-up game, drawn with the real game-picks markup so a Free account sees the page as it is. */
const EXAMPLE = {
  away: 'LAL',
  home: 'DEN',
  tip: '8:00 PM',
  call: [112, 118] as const,
  rows: [
    { mk: 'Handicap', bet: 'DEN −4.5', num: true, book: 'DEN −4.5', ours: 'DEN −6', odd: '1.87', pct: 0.56 },
    { mk: 'Total points', bet: 'Over 226.5', num: true, book: '226.5', ours: '230', odd: '1.90', pct: 0.57 },
    { mk: 'Match result', bet: 'DEN to win', num: false, book: 'DEN 58%', ours: 'DEN 64%', odd: '1.55', pct: 0.64 },
  ],
}

const SECOND = { away: 'BOS', home: 'NYK', tip: '7:30 PM', call: [109, 104] as const }

const GETS = [
  { h: 'Game picks', p: 'Our score for every game, and one bet on each of the sportsbook’s lines.' },
  { h: 'Player lines', p: 'Every player’s number tonight, set beside the sportsbook’s.' },
  { h: 'The record', p: 'Every pick judged once the game ends, the misses kept in view.' },
] as const

function Head({ away, home, tip, call }: { away: string; home: string; tip: string; call: readonly [number, number] }) {
  const disc = (team: string) => (
    <span className="ic-gp-disc" style={{ '--tc': teamLight(team) ?? 'transparent' } as CSSProperties}>
      <TeamLogo abbrev={team} size={40} fallback />
    </span>
  )
  const pick = call[1] > call[0] ? home : away
  return (
    <div className="ic-gp-gh">
      <span className="ic-gp-pair">
        {disc(away)}
        {disc(home)}
      </span>
      <span className="ic-gp-gn">
        <b>{`${away} @ ${home}`}</b>
        <span>
          <Clock size={14} />
          Tip <span className="num">{tip}</span>
        </span>
      </span>
      <span className="ic-gp-sc">
        <span className="lab">Our score</span>
        <b className="num">
          <small>{away}</small> {call[0]}
          <i>–</i>
          {call[1]} <small>{home}</small>
        </b>
        <span className="sub">
          {pick} by <span className="num">{Math.abs(call[1] - call[0])}</span> · Total{' '}
          <span className="num">{call[0] + call[1]}</span>
        </span>
      </span>
    </div>
  )
}

/** The page behind the lock: the real game-picks look, with example numbers, fading out. */
function Peek() {
  const e = EXAMPLE
  return (
    <div className="pi-peek" aria-hidden="true" inert>
      <p className="pi-ex">
        <span>Example</span> How a game looks on Our Estimates
      </p>
      <section className="ic-gp">
        <ol className="ic-gp-games">
          <li className="ic-gp-game">
            <Head away={e.away} home={e.home} tip={e.tip} call={e.call} />
            <ul className="ic-gp-rows">
              {e.rows.map((r) => (
                <li key={r.mk} className="ic-gp-row">
                  <span className="ml">{r.mk}</span>
                  <span className="mb">
                    <b className={`bt${r.num ? ' num' : ''}`}>{r.bet}</b>
                    <span className="bo">
                      Book <b className="num">{r.book}</b> · Ours <b className="num">{r.ours}</b>
                    </span>
                  </span>
                  <span className="od">
                    <b className="num">{r.odd}</b>
                    <span>odds</span>
                  </span>
                  <Chance value={r.pct} />
                </li>
              ))}
            </ul>
          </li>
          <li className="ic-gp-game">
            <Head away={SECOND.away} home={SECOND.home} tip={SECOND.tip} call={SECOND.call} />
          </li>
        </ol>
      </section>
    </div>
  )
}

/**
 * Our Estimates for a Free account: the page as it looks (an example game, fading out), then one
 * way in. No real numbers, since the API sends none. ``ended``: Pro ran out while the page was open.
 */
export function ProInside({ ended = false, onBack }: { ended?: boolean; onBack: () => void }) {
  const { open } = usePro()
  const year = PRICES.year
  const month = PRICES.month
  return (
    <div className="ic stack pro-inside-page">
      <button type="button" className="pi-back" onClick={onBack}>
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        Back
      </button>
      <header className="pi-head">
        <h1 className="page-title">
          Our Estimates <ProMark size="md" />
        </h1>
        <p>Our score for every game and our line for every player, before tip-off, set against the sportsbook’s.</p>
      </header>

      <section className="pi-stage" aria-labelledby="pi-h">
        <Peek />
        <div className="pi-pay">
          <ProMark size="lg" />
          {ended ? (
            <>
              <h2 id="pi-h">Your Pro has ended</h2>
              <p className="pi-lede">Picks and player lines are locked again. Your leagues stay as they are.</p>
              <button type="button" className="pi-cta" aria-haspopup="dialog" onClick={open}>
                Get Pro again
              </button>
              <p className="pi-fine">
                {year.amount} {year.per}, or {month.amount} {month.per}.
              </p>
            </>
          ) : (
            <>
              <h2 id="pi-h">Every pick, before tip-off</h2>
              <p className="pi-lede">
                Unlock the picks, how sure we are on each, and the full record behind them.
              </p>
              <button type="button" className="pi-cta" aria-haspopup="dialog" onClick={open}>
                Start 7-day free trial
              </button>
              <p className="pi-fine">
                Then {year.amount} {year.per}, or {month.amount} {month.per}. Cancel any time.
              </p>
            </>
          )}
        </div>
        <ul className="pi-gets">
          {GETS.map((g) => (
            <li key={g.h}>
              <b>{g.h}</b>
              <span>{g.p}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
