import type { CSSProperties } from 'react'
import { CaretLeft } from '@phosphor-icons/react'
import { teamLight } from '../lib/nbaTeams'
import { PRICES } from '../lib/plans'
import { usePro } from '../lib/pro'
import { ProMark } from './Pro'
import { TeamLogo } from './PlayerHead'
import './ProInside.css'

/** One made-up game, drawn with the real game-picks markup so a Free account sees the page as it is. */
const EXAMPLE = {
  away: 'LAL',
  home: 'DEN',
  tip: '8:00 PM',
  call: [112, 118] as const,
  pct: 64,
  slips: [
    { mk: 'Match result', q: 'To win', hero: 'DEN', txt: true, ours: 'DEN −6', odd: '1.55', pct: 64 },
    { mk: 'Handicap', q: 'DEN', dot: 'DEN', hero: '−4.5', ours: 'DEN −6', odd: '1.87', pct: 56 },
    { mk: 'Total points', q: 'Over', hero: '226.5', ours: '+230', odd: '1.90', pct: 57 },
  ],
}

const SECOND = { away: 'BOS', home: 'NYK', tip: '7:30 PM', call: [109, 104] as const }

const GETS = [
  { h: 'Game picks', p: 'Our score for every game, and one bet on each of the sportsbook’s lines.' },
  { h: 'Player lines', p: 'Every player’s number tonight, set beside the sportsbook’s.' },
  { h: 'The record', p: 'Every pick judged once the game ends, the misses kept in view.' },
] as const

function Ring({ pct }: { pct: number }) {
  const size = 40
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="ic-gp-conf" data-band={pct >= 65 ? 'likely' : pct >= 55 ? 'lean' : 'flip'}>
      <svg className="ic-gp-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle className="trk" cx={20} cy={20} r={r} strokeWidth={stroke} />
        <circle
          className="arc"
          cx={20}
          cy={20}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${((c * pct) / 100).toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="pct num">
        {pct}
        <small>%</small>
      </span>
    </span>
  )
}

function Board({ away, home, call }: { away: string; home: string; call: readonly [number, number] }) {
  const pickHome = call[1] > call[0]
  const side = (team: string, s: 'a' | 'h') => (
    <span className={`side ${s}`}>
      <TeamLogo abbrev={team} size={36} fallback />
      <span className="ab">{team}</span>
    </span>
  )
  return (
    <div className="ic-gp-board pre">
      {side(away, 'a')}
      <span className={`dg a hollow${pickHome ? '' : ' pk'}`} style={{ '--tl': teamLight(away) } as CSSProperties}>
        {call[0]}
      </span>
      <span className="dash">–</span>
      <span className={`dg h hollow${pickHome ? ' pk' : ''}`} style={{ '--tl': teamLight(home) } as CSSProperties}>
        {call[1]}
      </span>
      {side(home, 'h')}
    </div>
  )
}

function Clock() {
  return (
    <svg className="ic-gp-ico" viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.3 1.5" />
    </svg>
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
      <section className="ic-sec ic-gp">
        <ol className="ic-gp-games">
          <li className="ic-gp-game">
            <div className="ic-gp-call">
              <div className="ic-gp-top">
                <span className="when">
                  <Clock />
                  Tip <b className="num">{e.tip}</b>
                </span>
                <span className="callpct">
                  Our call · <b className="num" data-band="lean">{e.pct}%</b> {e.home} to win
                </span>
              </div>
              <Board away={e.away} home={e.home} call={e.call} />
              <p className="ic-gp-line">
                <b>{e.home}</b> by <b className="num">{e.call[1] - e.call[0]}</b> · Total{' '}
                <b className="num">{e.call[0] + e.call[1]}</b>
              </p>
            </div>
            <ol className="ic-gp-slips">
              {e.slips.map((s, i) => (
                <li key={s.mk} className={`ic-gp-slip${i === e.slips.length - 1 ? ' last' : ''}`}>
                  <div className="body">
                    <span className="mk">{s.mk}</span>
                    <span className="q">
                      {s.dot && <i className="dot" style={{ '--tl': teamLight(s.dot) } as CSSProperties} />}
                      {s.q}
                    </span>
                    <b className={`hero${s.txt ? '' : ' num'}`}>{s.hero}</b>
                    <span className="us ours" data-band={s.pct >= 55 ? 'lean' : 'flip'}>
                      Ours <b className="est">{s.ours}</b>
                    </span>
                  </div>
                  <div className="stub">
                    <span className="price">
                      <span className="lab">Odds</span>
                      <b className="num odd">{s.odd}</b>
                    </span>
                    <Ring pct={s.pct} />
                  </div>
                </li>
              ))}
            </ol>
          </li>
          <li className="ic-gp-game">
            <div className="ic-gp-call">
              <div className="ic-gp-top">
                <span className="when">
                  <Clock />
                  Tip <b className="num">{SECOND.tip}</b>
                </span>
              </div>
              <Board away={SECOND.away} home={SECOND.home} call={SECOND.call} />
            </div>
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
