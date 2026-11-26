import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Anchor,
  ArrowLeft,
  ArrowUUpLeft,
  CaretLeft,
  CaretRight,
  Check,
  Info,
  Person,
  Sword,
  TrendUp,
  X,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { fetchCrazyOne } from '../api/client'
import type { CrazyGame, CrazyOne as CrazyData, CrazyRecord } from '../api/client'
import {
  BELIEFS,
  MYTHS,
  RECORD_WORDS,
  beliefOf,
  chanceFor,
  craziest,
  edge100,
  flips,
  leanOf,
  movesWinner,
  nightOf,
  onTotal,
  ordered,
  pct,
  rangeMarks,
  recordState,
  signed,
  steps,
  swingOf,
  totals,
  trackAt,
  voice,
} from '../lib/crazyOne'
import type { BeliefKey } from '../lib/crazyOne'
import { clock } from '../lib/iddaaCompare'
import { upgradeRequired } from '../lib/plans'
import { useFeature } from '../lib/pro'
import { TeamLogo } from './PlayerHead'
import { ProInside } from './ProInside'
import './CrazyDoor.css'
import './CrazyOne.css'

const ICON: Record<BeliefKey, Icon> = {
  rivalry: Sword,
  bounce: ArrowUUpLeft,
  slump: TrendUp,
  tank: Anchor,
  one_man: Person,
}

/** Crazy One's World (?view=crazy): a persona that believes what fans believe and the data backs on
 *  average but not every season. Its own room, its own ink, always "Crazy One's call", never Our call. */
export function CrazyOne({ onBack }: { onBack: () => void }) {
  const allowed = useFeature('estimates')
  const qc = useQueryClient()
  const [day, setDay] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['crazy-one', day],
    queryFn: () => fetchCrazyOne(day),
    enabled: allowed,
    placeholderData: keepPreviousData,
    retry: (n, err) => !upgradeRequired(err) && n < 3,
    refetchInterval: (query) => (query.state.data?.games.some((g) => !g.final) ? 5 * 60_000 : false),
  })
  const ended = !!upgradeRequired(q.error)
  useEffect(() => {
    if (ended) qc.invalidateQueries({ queryKey: ['me'] })
  }, [ended, qc])
  if (!allowed || ended) return <ProInside ended={ended} onBack={onBack} />
  const data = q.data
  const call = data ? craziest(data.games) : null
  return (
    <div className="cz">
      <div className="cz-room">
        <div className="cz-top">
          <button type="button" className="cz-back" onClick={onBack}>
            <ArrowLeft size={20} aria-hidden="true" />
            Our Estimates
          </button>
          <span className="cz-persona">Persona · not Our call</span>
        </div>

        <section className="cz-hero" aria-labelledby="cz-name">
          <div className="cz-who cz-rise">
            <Face />
            <div className="cz-who-t">
              <h1 className="cz-name" id="cz-name">
                Crazy <em>One</em>
              </h1>
              <p className="cz-voice">{data ? voice(call) : 'Reading tonight’s stories…'}</p>
            </div>
            <p className="cz-honest">
              <Info size={18} aria-hidden="true" />
              <span>
                I believe things a fan would nod at that paid on average but not in every season, so{' '}
                <b>we haven’t proven them</b>. My numbers never go into Our call, Our Estimates or the Kupons.
              </span>
            </p>
          </div>
          {data && call && <Craziest g={call} />}
        </section>

        {data && data.days.length > 1 && <Nights data={data} onDay={setDay} />}

        {q.isPending && <Loading />}
        {q.error && !ended && (
          <section className="cz-card cz-error" role="alert">
            <p>{q.error instanceof Error ? q.error.message : 'Couldn’t reach Crazy One’s World.'}</p>
          </section>
        )}

        {data && <Tonight data={data} />}

        <section className="cz-sec" aria-labelledby="cz-bel">
          <div className="cz-sec-h">
            <h2 id="cz-bel">What I believe</h2>
            <p>The beliefs that move my calls, their weight in plain words, and how often they held.</p>
          </div>
          <Beliefs games={data?.games ?? []} />
        </section>

        {data && <Record r={data.record} />}

        <footer className="cz-foot">
          <button type="button" className="cz-back cz-back-foot" onClick={onBack}>
            <ArrowLeft size={20} aria-hidden="true" />
            Back to Our Estimates
          </button>
          <span>
            Picked over two other believers on a replay of five seasons (2021-22 to 2025-26), by a small margin.
            One good night is not a lead.
          </span>
        </footer>
      </div>
    </div>
  )
}

/** Its portrait: a disc with an off-centre moon and a slow dotted orbit. */
function Face() {
  return (
    <svg className="cz-face" viewBox="0 0 132 132" aria-hidden="true">
      <circle className="o1" cx="66" cy="66" r="62" />
      <circle className="o2" cx="66" cy="66" r="54" />
      <circle className="disc" cx="66" cy="66" r="42" />
      <circle className="moon" cx="82" cy="52" r="16" />
      <circle className="eye" cx="88" cy="47" r="4" />
    </svg>
  )
}

/** "OKC by 5.6" */
function leanWords(c: CrazyGame['ours'], g: CrazyGame) {
  const l = leanOf(c, g)
  return l.by < 0.05 ? 'Even' : `${l.team} by ${l.by.toFixed(1)}`
}

function Craziest({ g }: { g: CrazyGame }) {
  const side = g.swing >= 0 ? 'home' : 'away'
  const team = side === 'home' ? g.home : g.away
  const lean = leanOf(g.crazy, g)
  const apart = Math.abs(g.crazy.home - g.crazy.away - (g.ours.home - g.ours.away))
  return (
    <article className="cz-loud cz-rise cz-rise-2" aria-label="Tonight’s craziest call">
      <div className="cz-loud-k">
        <span className="cz-loud-tag">{g.final ? 'The night’s craziest call' : 'Tonight’s craziest call'}</span>
        <span>
          {g.away} @ {g.home} · <span className="num">{clock(g.tip)}</span>
        </span>
      </div>
      <p className="cz-shout">
        <span className="t">{lean.team}</span>
        <span className="w">by</span>
        <span className="n num">{lean.by.toFixed(1)}</span>
      </p>
      <p className="cz-loud-sub">
        Crazy One’s call · {team} win chance <b className="num">{pct(chanceFor(g.crazy, side))}</b>
      </p>
      <div className="cz-under">
        <span className="lbl">Our call</span>
        <span className="v">{leanWords(g.ours, g)}</span>
        <span className="cz-apart">
          Apart <span className="num">{apart.toFixed(1)}</span> pts
        </span>
      </div>
      <ol className="cz-steps">
        {steps(g).map((s, i) => (
          <li key={i}>
            <span>{s.label}</span>
            <span className="num">{s.value}</span>
          </li>
        ))}
      </ol>
      {g.final && <Settled g={g} />}
    </article>
  )
}

function Nights({ data, onDay }: { data: CrazyData; onDay: (d: number) => void }) {
  const i = data.day == null ? -1 : data.days.indexOf(data.day)
  const prev = i > 0 ? data.days[i - 1] : null
  const next = i >= 0 && i < data.days.length - 1 ? data.days[i + 1] : null
  return (
    <nav className="cz-nights" aria-label="Nights">
      <button
        type="button"
        className="cz-ib"
        aria-label="Night before"
        disabled={prev == null}
        onClick={() => prev != null && onDay(prev)}
      >
        <CaretLeft size={20} aria-hidden="true" />
      </button>
      <span className="cz-night">{nightOf(data.games) || `Night ${data.day ?? ''}`}</span>
      <button
        type="button"
        className="cz-ib"
        aria-label="Night after"
        disabled={next == null}
        onClick={() => next != null && onDay(next)}
      >
        <CaretRight size={20} aria-hidden="true" />
      </button>
    </nav>
  )
}

function Tonight({ data }: { data: CrazyData }) {
  const games = ordered(data)
  const moved = games.filter(movesWinner)
  const quiet = games.filter((g) => !movesWinner(g))
  const night = nightOf(data.games)
  return (
    <section className="cz-sec" aria-labelledby="cz-tonight">
      <div className="cz-sec-h">
        <h2 id="cz-tonight">Where I disagree{night ? `, ${night}` : ''}</h2>
        <p>Biggest disagreement first. Each line runs from the away team’s win to the home team’s.</p>
      </div>
      {games.length === 0 ? (
        <div className="cz-card cz-empty">
          <p>No calls for this night yet. I write mine in the last 90 minutes before each tip-off.</p>
        </div>
      ) : (
        <>
          <Key />
          <ol className="cz-games">
            {moved.map((g, i) => (
              <Game g={g} rank={i + 1} key={g.game_id} />
            ))}
            {quiet.map((g) => (
              <Game g={g} key={g.game_id} />
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function Key() {
  return (
    <p className="cz-key" aria-hidden="true">
      <span>
        <i className="cz-mk cz-mk-ours" /> Our call
      </span>
      <span>
        <i className="cz-mk cz-mk-cz" /> Crazy One’s call
      </span>
      <span>
        <i className="cz-mk cz-mk-book" /> The book
      </span>
    </p>
  )
}

function Game({ g, rank }: { g: CrazyGame; rank?: number }) {
  const quiet = rank == null
  const swing = swingOf(g)
  const total = totals(g)
  const ours = trackAt(g.ours.home_chance)
  const cz = trackAt(g.crazy.home_chance)
  const label =
    `${g.away} at ${g.home}. Our call ${g.home} ${pct(g.ours.home_chance)}, ` +
    `Crazy One’s call ${g.home} ${pct(g.crazy.home_chance)}` +
    (g.book_home_chance != null ? `, the book ${g.home} ${pct(g.book_home_chance)}` : '')
  return (
    <li className={`cz-game${quiet ? ' is-quiet' : ''}`}>
      <span className="cz-rank num" aria-hidden="true">
        {quiet ? '' : rank}
      </span>
      <div className="cz-match">
        <span className="cz-teams">
          <TeamLogo abbrev={g.away} size={28} />
          {g.away}
          <span className="cz-at">@</span>
          <TeamLogo abbrev={g.home} size={28} />
          {g.home}
        </span>
        <small>
          {g.final ? (
            <>
              Final <span className="num">{g.final[0]}–{g.final[1]}</span>
            </>
          ) : (
            <>
              Tip <span className="num">{clock(g.tip)}</span>
            </>
          )}
        </small>
      </div>
      <div className="cz-line">
        <div className="cz-track" role="img" aria-label={label}>
          <span className="cz-track-ends" aria-hidden="true">
            <span>{g.away}</span>
            <span>{g.home}</span>
          </span>
          <span className="cz-track-rail" aria-hidden="true">
            <span className="cz-track-mid" />
            <span
              className="cz-track-gap"
              style={{ left: `${Math.min(ours, cz)}%`, width: `${Math.abs(cz - ours)}%` }}
            />
            {g.book_home_chance != null && (
              <i className="cz-mk cz-mk-book" style={{ left: `${trackAt(g.book_home_chance)}%` }} />
            )}
            <i className="cz-mk cz-mk-ours" style={{ left: `${ours}%` }} />
            <i className="cz-mk cz-mk-cz" style={{ left: `${cz}%` }} />
          </span>
        </div>
        <div className="cz-calls">
          <span>
            <span className="lab">Our call</span>
            <b>{leanWords(g.ours, g)}</b>
          </span>
          <span className="is-cz">
            <span className="lab">Crazy One’s call</span>
            <b>{leanWords(g.crazy, g)}</b>
          </span>
        </div>
      </div>
      <div className="cz-why">
        {quiet ? (
          <p className="cz-agree">{total ? 'I agree on the winner.' : 'I agree with you.'}</p>
        ) : (
          <>
            <p className="cz-swing">
              <span className="num">{signed(swing.per100)}</span> wins per 100 toward {swing.team}
              {flips(g) && <span className="cz-flip">Other winner</span>}
            </p>
          </>
        )}
        {total && (
          <p className="cz-total">
            Total <span className="num">{total.ours.toFixed(1)}</span> → <b className="num">{total.crazy.toFixed(1)}</b>
          </p>
        )}
        {g.beliefs.length > 0 && (
          <ul className="cz-chips">
            {g.beliefs.map((b, i) => {
              const Mark = ICON[b.belief as BeliefKey] as Icon | undefined
              return (
                <li key={i} className="cz-chip">
                  {Mark && <Mark size={14} aria-hidden="true" />}
                  {beliefOf(b.belief)?.name ?? b.belief} {onTotal(b) ? 'total' : b.team}{' '}
                  <span className="num">{signed(b.points)}</span>
                </li>
              )
            })}
          </ul>
        )}
        {g.final && <Settled g={g} />}
      </div>
    </li>
  )
}

/** Hit or missed, for both calls, in words and a mark (never colour alone). */
function Settled({ g }: { g: CrazyGame }) {
  const one = (who: string, hit: boolean | null | undefined) =>
    hit == null ? null : (
      <span className={`cz-res ${hit ? 'hit' : 'miss'}`}>
        {hit ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        {who} {hit ? 'hit' : 'missed'}
      </span>
    )
  return (
    <p className="cz-settled">
      {one('Crazy One', g.crazy_hit)}
      {one('Our call', g.ours_hit)}
    </p>
  )
}

function Beliefs({ games }: { games: CrazyGame[] }) {
  const live = new Set(games.flatMap((g) => g.beliefs.map((b) => b.belief)))
  return (
    <>
      <ul className="cz-beliefs">
        {BELIEFS.map((b) => {
          const Mark = ICON[b.key]
          return (
            <li key={b.key} className={`cz-belief${live.has(b.key) ? ' is-live' : ''}`}>
              <h3>
                <span className="ci">
                  <Mark size={18} aria-hidden="true" />
                </span>
                {b.name}
              </h3>
              <p className="say">{b.creed}</p>
              <p className="w">{b.weight}</p>
              <p className="held">
                {b.pips && (
                  <span className="cz-pips" aria-hidden="true">
                    {Array.from({ length: b.pips[1] }, (_, i) => (
                      <i key={i} className={i < b.pips![0] ? '' : 'x'} />
                    ))}
                  </span>
                )}
                {b.held}
              </p>
              {live.has(b.key) && <p className="on">In play this night</p>}
            </li>
          )
        })}
      </ul>
      <p className="cz-myths">
        <span className="cz-myths-h">Myths I refuse</span>
        {MYTHS.map((m) => (
          <span className="cz-myth" key={m.name}>
            <s>{m.name}</s>
            <span>{m.data}</span>
          </span>
        ))}
      </p>
    </>
  )
}

function Record({ r }: { r: CrazyRecord }) {
  const state = recordState(r)
  const marks = rangeMarks(r)
  return (
    <section className="cz-sec" aria-labelledby="cz-rec">
      <div className="cz-sec-h">
        <h2 id="cz-rec">My record: luck or a lead?</h2>
        <p>Scored against Our call on the same final games, misses included.</p>
      </div>
      <div className="cz-rec">
        <div className="cz-card">
          <h3>{state === 'empty' ? 'No record yet' : `${r.games} final ${r.games === 1 ? 'game' : 'games'}`}</h3>
          {state !== 'empty' && (
            <div className="cz-tally">
              <div>
                <span className="num">{r.crazy_hits}</span>Crazy One’s winners right
              </div>
              <div>
                <span className="num">{r.ours_hits}</span>Our call’s winners right
              </div>
            </div>
          )}
          {marks && (
            <div
              className="cz-range"
              role="img"
              aria-label={`Edge over Our call ${edge100(r.edge)} per 100 games, range ${edge100(r.edge_low)} to ${edge100(r.edge_high)}`}
            >
              <span className="bar" style={{ left: `${marks.low}%`, width: `${marks.high - marks.low}%` }} />
              <span className="z" style={{ left: `${marks.zero}%` }} />
              <span className="pt" style={{ left: `${marks.edge}%` }} />
              <span className="lb" style={{ left: `${marks.low}%` }}>
                <span className="num">{edge100(r.edge_low)}</span>
              </span>
              <span className="lb" style={{ left: `${marks.high}%` }}>
                <span className="num">{edge100(r.edge_high)}</span>
              </span>
              <span className="lb lb-z" style={{ left: `${marks.zero}%` }}>
                <span className="num">0</span>
              </span>
            </div>
          )}
          {marks && (
            <p className="cz-rec-edge">
              Edge over Our call <b className="num">{edge100(r.edge)}</b> per 100 games (log loss)
            </p>
          )}
          <p className={`cz-verdict is-${state}`}>
            <Info size={16} aria-hidden="true" />
            {RECORD_WORDS[state]}
          </p>
        </div>
        <div className="cz-card">
          <h3>Bold calls (10+ wins per 100 from Our call)</h3>
          {r.bold.length === 0 ? (
            <p className="cz-muted">None final yet. When I go far from you, it lands here, hit or miss.</p>
          ) : (
            <ul className="cz-bold">
              {r.bold.map((b) => {
                const toward = b.swing >= 0 ? b.home : b.away
                return (
                  <li key={b.game_id}>
                    <span className={`cz-res ${b.hit ? 'hit' : 'miss'}`}>
                      {b.hit ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                      {b.hit ? 'Hit' : 'Missed'}
                    </span>
                    <span>
                      {b.away} @ {b.home} · leaned <b>{toward}</b>
                    </span>
                    <span className="num">{signed(Math.abs(b.swing) * 100)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="cz-muted">“A lead” shows only when the whole range sits above zero.</p>
        </div>
      </div>
    </section>
  )
}

function Loading() {
  return (
    <div className="cz-games" aria-busy="true">
      <span className="sr-only">Loading Crazy One’s calls</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div className="cz-game cz-sk" key={i} />
      ))}
    </div>
  )
}
