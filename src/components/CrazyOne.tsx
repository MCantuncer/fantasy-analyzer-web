import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Anchor,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowUUpLeft,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  Clock,
  Fire,
  Info,
  Person,
  Prohibit,
  Repeat,
  Sword,
  TrendUp,
  Waveform,
  X,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { fetchCrazyOne } from '../api/client'
import type { CrazyBoom, CrazyBoomRecord, CrazyGame, CrazyOne as CrazyData, CrazyRecord } from '../api/client'
import {
  BOOM_BELIEFS,
  BOOM_WORDS,
  SEASONS,
  STAT_WORD,
  boomBeliefOf,
  boomState,
  boomVoice,
  calm,
  callId,
  gapOf,
  horizon,
  lift,
  mainStat,
  marks,
  shortName,
  shown,
  skyFloor,
  skyTop,
  stars,
  statLong,
  surpriseTag,
  surprises,
  touches,
  whyWords,
} from '../lib/crazyBooms'
import type { BoomBelief, BoomStat, Filter } from '../lib/crazyBooms'
import type { Myth, MythKind } from '../lib/crazyOne'
import {
  BELIEFS,
  GAME_MYTHS,
  PLAYER_MYTHS,
  RECORD_WORDS,
  beliefOf,
  edge100,
  flips,
  leanOf,
  movesWinner,
  nightOf,
  onTotal,
  pct,
  rangeMarks,
  recordState,
  signed,
  swingOf,
  totals,
  trackAt,
} from '../lib/crazyOne'
import { useEscapeLayer } from '../lib/escapeStack'
import { clock } from '../lib/iddaaCompare'
import { useSwipeToClose } from '../lib/swipeToClose'
import { upgradeRequired } from '../lib/plans'
import { useFeature } from '../lib/pro'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { ProInside } from './ProInside'
import './CrazyDoor.css'
import './CrazyOne.css'

/** Crazy 1's World (?view=crazy): a persona that hunts booms, the nights far beyond what we expected,
 *  on beliefs that paid on average but not every season. Its own room, its own ink, always "Crazy 1's
 *  call", never Our call. Every part of it can be touched: the sky, the calls, the beliefs, the record. */
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

        {q.isPending && <Loading />}
        {q.error && !ended && (
          <section className="cz-card cz-error" role="alert">
            <p>{q.error instanceof Error ? q.error.message : 'Couldn’t reach Crazy 1’s World.'}</p>
          </section>
        )}
        {data && <World data={data} onDay={setDay} />}

        <footer className="cz-foot">
          <button type="button" className="cz-back cz-back-foot" onClick={onBack}>
            <ArrowLeft size={20} aria-hidden="true" />
            Back to Our Estimates
          </button>
          <span>
            His beliefs come from a blind replay of five seasons (2021-22 to 2025-26) and this one so far. They catch a
            little more than expected on average, not every season. One good night is not a lead.
          </span>
        </footer>
      </div>
    </div>
  )
}

/** What lights up: a belief (hovered, or pinned by a tap), a call or a game under the pointer. */
interface Light {
  belief: string | null
  pinned: boolean
  call: string | null
  game: number | null
}

const DARK: Light = { belief: null, pinned: false, call: null, game: null }

function World({ data, onDay }: { data: CrazyData; onDay: (d: number) => void }) {
  const booms = data.booms ?? []
  const [filter, setFilter] = useState<Filter>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [light, setLight] = useState<Light>(DARK)
  const calls = shown(booms, filter)
  const current = booms.find((b) => callId(b) === picked) ?? calls[0] ?? null
  const lit = light.belief ? touches(light.belief, booms, data.games) : null
  const breaks = surprises(data.games)

  const hoverBelief = (key: string | null) => setLight((l) => (l.pinned ? l : { ...l, belief: key }))
  const pinBelief = (key: string) =>
    setLight((l) =>
      l.pinned && l.belief === key ? { ...l, belief: null, pinned: false } : { ...l, belief: key, pinned: true },
    )
  const showBelief = (key: string) => {
    setLight((l) => ({ ...l, belief: key, pinned: true }))
    document.getElementById('cz-sky')?.scrollIntoView?.({ behavior: smooth(), block: 'center' })
  }
  const pick = (id: string, reveal = false) => {
    setPicked(id)
    setLight((l) => ({ ...l, call: null }))
    if (reveal) document.getElementById('cz-card')?.scrollIntoView?.({ behavior: smooth(), block: 'nearest' })
  }
  const ctx: Ctx = {
    light,
    lit,
    setLight,
    hoverBelief,
    pinBelief,
    showBelief,
    pick,
    current,
  }

  return (
    <>
      <section className="cz-hero" aria-labelledby="cz-name">
        <div className="cz-who cz-rise">
          <Face />
          <div className="cz-who-t">
            <h1 className="cz-name" id="cz-name">
              Crazy <em>1</em>
            </h1>
            <p className="cz-voice">{boomVoice(booms)}</p>
          </div>
        </div>
        <div className="cz-hero-row">
          {data.days.length > 1 ? <Nights data={data} onDay={onDay} /> : <span />}
          <dl className="cz-counts">
            <div>
              <dt>games</dt>
              <dd className="num">{data.games.length}</dd>
            </div>
            <div className="is-cz">
              <dt>boom calls</dt>
              <dd className="num">{booms.length}</dd>
            </div>
            <div>
              <dt>games that could break</dt>
              <dd className="num">{breaks.length}</dd>
            </div>
          </dl>
        </div>
        <p className="cz-honest">
          <Info size={18} aria-hidden="true" />
          <span>
            I hunt nights far over the line. My beliefs paid a little on average but not every season, so{' '}
            <b>we haven’t proven them</b>. My numbers never go into Our call, Our Estimates or the Kupons.
          </span>
        </p>
      </section>

      <div className="cz-stage">
        <Sky data={data} booms={booms} filter={filter} onFilter={setFilter} ctx={ctx} />
        {current ? (
          <BoomCard call={current} booms={booms} onPick={(id) => pick(id)} />
        ) : (
          <aside className="cz-card cz-boom-card cz-empty" id="cz-card">
            <p>No boom calls this night. Pick another night, or read what I believe below.</p>
          </aside>
        )}
      </div>

      {calls.length > 0 && (
        <section className="cz-sec" aria-labelledby="cz-calls">
          <div className="cz-sec-h">
            <h2 id="cz-calls">Booms I’m calling</h2>
          </div>
          <ol className="cz-rows">
            {calls.map((b) => (
              <BoomRow key={callId(b)} b={b} ctx={ctx} />
            ))}
          </ol>
        </section>
      )}

      <Breaks games={data.games} ctx={ctx} />

      <section className="cz-sec" aria-labelledby="cz-bel">
        <div className="cz-sec-h">
          <h2 id="cz-bel">What I believe</h2>
        </div>
        <Beliefs booms={booms} games={data.games} ctx={ctx} />
      </section>

      <section className="cz-sec" aria-labelledby="cz-rec">
        <div className="cz-sec-h">
          <h2 id="cz-rec">My record: booms caught</h2>
          <p>Every call I made, misses included, against what Our chance expected of the same calls.</p>
        </div>
        <div className="cz-rec">
          <BoomTally r={data.boom_record} />
          <LuckOrLead r={data.boom_record} />
        </div>
        <GameRecord r={data.record} />
      </section>
    </>
  )
}

const smooth = (): ScrollBehavior =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

interface Ctx {
  light: Light
  lit: { calls: string[]; games: number[] } | null
  setLight: Dispatch<SetStateAction<Light>>
  hoverBelief: (key: string | null) => void
  pinBelief: (key: string) => void
  showBelief: (key: string) => void
  pick: (id: string, reveal?: boolean) => void
  current: CrazyBoom | null
}

/** Is this call lit, dimmed or plain right now? */
function callLook(id: string, gid: number, ctx: Ctx): string {
  const { light, lit } = ctx
  if (light.call === id || (light.game != null && light.game === gid)) return ' is-lit'
  if (lit) return lit.calls.includes(id) ? ' is-lit' : ' is-dim'
  if (light.call || light.game != null) return ' is-dim'
  return ''
}

const BELIEF_ICON: Record<string, Icon> = {
  hot: Fire,
  swings: Waveform,
  minutes: Clock,
  done_it: Repeat,
  rivalry: Sword,
  bounce: ArrowUUpLeft,
  slump: TrendUp,
  tank: Anchor,
  one_man: Person,
}

function nameOf(key: string): string {
  return boomBeliefOf(key)?.name ?? beliefOf(key)?.name ?? key
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

function Game({ g, rank, tag, look = '' }: { g: CrazyGame; rank?: number; tag?: string; look?: string }) {
  const quiet = rank == null
  const swing = swingOf(g)
  const total = totals(g)
  const ours = trackAt(g.ours.home_chance)
  const cz = trackAt(g.crazy.home_chance)
  const label =
    `${g.away} at ${g.home}. Our call ${g.home} ${pct(g.ours.home_chance)}, ` +
    `Crazy 1’s call ${g.home} ${pct(g.crazy.home_chance)}` +
    (g.book_home_chance != null ? `, the book ${g.home} ${pct(g.book_home_chance)}` : '')
  return (
    <li className={`cz-game${quiet ? ' is-quiet' : ''}${look}`}>
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
              Final{' '}
              <span className="num">
                {g.final[0]}–{g.final[1]}
              </span>
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
              style={{
                left: `${Math.min(ours, cz)}%`,
                width: `${Math.abs(cz - ours)}%`,
              }}
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
            <span className="lab">Crazy 1’s call</span>
            <b>{leanWords(g.crazy, g)}</b>
          </span>
        </div>
      </div>
      <div className="cz-why">
        {tag && <span className="cz-tag">{tag}</span>}
        {quiet || !movesWinner(g) ? (
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
              const Mark = BELIEF_ICON[b.belief] as Icon | undefined
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
      {one('Crazy 1', g.crazy_hit)}
      {one('Our call', g.ours_hit)}
    </p>
  )
}

function Loading() {
  return (
    <div className="cz-games" aria-busy="true">
      <span className="sr-only">Loading Crazy 1’s calls</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div className="cz-game cz-sk" key={i} />
      ))}
    </div>
  )
}

/** Tonight as a sky: games on the horizon in tip order, each boom call a star above its game, as high as
 *  Crazy 1's chance; the hollow dot under it is Our chance, the stem the gap. Beliefs draw their
 *  constellation through the calls they pushed. */
function Sky({
  data,
  booms,
  filter,
  onFilter,
  ctx,
}: {
  data: CrazyData
  booms: CrazyBoom[]
  filter: Filter
  onFilter: (f: Filter) => void
  ctx: Ctx
}) {
  const kept = shown(booms, filter)
  const all = stars(kept, data.games)
  const { order, at } = horizon(data.games, kept)
  const top = skyTop(kept)
  const floor = skyFloor(kept)
  const breaking = new Set(surprises(data.games).map((g) => g.game_id))
  const byId = new Map(data.games.map((g) => [g.game_id, g]))
  const tips = new Map(kept.map((b) => [b.game_id, b]))
  const lined = ctx.lit ? all.filter((s) => ctx.lit!.calls.includes(s.id)).sort((a, b) => a.x - b.x) : []
  const chips = [...BOOM_BELIEFS.map((b) => b.key), ...BELIEFS.map((b) => b.key)]
    .map((key) => ({ key, n: touchCount(key, kept, data.games) }))
    .filter((c) => c.n > 0)
  const ticks = Array.from({ length: Math.round((top - floor) * 20) + 1 }, (_, i) =>
    Math.round((floor + i * 0.05) * 100),
  )
  return (
    <section className="cz-sky-wrap" id="cz-sky" aria-label="Tonight’s sky of boom calls">
      <div className="cz-sky-head">
        <p className="cz-key" aria-hidden="true">
          <span>
            <i className="cz-mk cz-mk-star" /> My boom chance
          </span>
          <span>
            <i className="cz-mk cz-mk-ours" /> Our chance
          </span>
        </p>
        <div className="cz-seg" role="group" aria-label="Show">
          {(['all', 'pts', 'reb'] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => onFilter(f)}>
              {f === 'all' ? 'All' : f === 'pts' ? 'Points' : 'Rebounds'}
            </button>
          ))}
        </div>
      </div>
      <div className={`cz-sky${ctx.lit ? ' is-drawing' : ''}`}>
        <div className="cz-sky-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${((t / 100 - floor) / (top - floor)) * 100}%` }}>
              <span className="num">{t}%</span>
            </span>
          ))}
        </div>
        <div className="cz-field">
          {lined.length > 1 && (
            <svg className="cz-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                key={ctx.light.belief ?? ''}
                pathLength={1}
                points={lined.map((s) => `${s.x * 100},${100 - s.y * 100}`).join(' ')}
              />
            </svg>
          )}
          {all.map((s) => {
            const b = s.call
            const look = callLook(s.id, b.game_id, ctx)
            const isPicked = ctx.current != null && callId(ctx.current) === s.id
            const size = 10 + Math.min(14, Math.max(0, gapOf(b)) * 3)
            return (
              <div key={s.id} className={`cz-star-col${look}`} style={{ left: `${s.x * 100}%` }}>
                <span
                  className="cz-stem"
                  style={{
                    bottom: `${s.ours * 100}%`,
                    height: `${Math.max(0, s.y - s.ours) * 100}%`,
                  }}
                  aria-hidden="true"
                />
                <span className="cz-ours-dot" style={{ bottom: `${s.ours * 100}%` }} aria-hidden="true" />
                <button
                  type="button"
                  className={`cz-star${s.first ? ' is-first' : ''}${isPicked ? ' is-picked' : ''}${b.boom === true ? ' is-boom' : ''}${b.boom === false ? ' is-dud' : ''}`}
                  style={{
                    bottom: `${s.y * 100}%`,
                    ['--r' as string]: `${size}px`,
                  }}
                  aria-label={`${b.name}, ${STAT_WORD[b.stat]} ${b.bar}+: my chance ${pct(b.crazy)}, Our chance ${pct(b.ours)}${b.boom == null ? '' : b.boom ? ', boomed' : ', no boom'}`}
                  aria-pressed={isPicked}
                  onClick={() => ctx.pick(s.id, true)}
                  onPointerEnter={() => ctx.setLight((l) => ({ ...l, call: s.id }))}
                  onPointerLeave={() => ctx.setLight((l) => ({ ...l, call: null }))}
                  onFocus={() => ctx.setLight((l) => ({ ...l, call: s.id }))}
                  onBlur={() => ctx.setLight((l) => ({ ...l, call: null }))}
                >
                  <span className="cz-star-dot" />
                  <span className="cz-star-lb" aria-hidden="true">
                    {shortName(b.name)}
                    <span className="num">
                      {pct(b.crazy)} {STAT_WORD[b.stat]}
                    </span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>
        <ol className="cz-horizon" aria-label="Tonight’s games in tip order">
          {order.map((gid) => {
            const g = byId.get(gid)
            const b = tips.get(gid)
            const away = g?.away ?? (b ? (b.home ? b.opponent : b.team) : '')
            const home = g?.home ?? (b ? (b.home ? b.team : b.opponent) : '')
            const tip = g?.tip ?? b?.tip ?? ''
            const look = ctx.lit?.games.includes(gid) ? ' is-lit' : ''
            return (
              <li
                key={gid}
                className={`cz-hz${breaking.has(gid) ? ' is-break' : ''}${look}`}
                style={{ left: `${(at.get(gid) ?? 0.5) * 100}%` }}
                onPointerEnter={() => ctx.setLight((l) => ({ ...l, game: gid }))}
                onPointerLeave={() => ctx.setLight((l) => ({ ...l, game: null }))}
              >
                <span className="cz-hz-dot" aria-hidden="true" />
                <span className="cz-hz-t">
                  <span>{away}</span>
                  <span className="cz-hz-at"> @ </span>
                  <span>{home}</span>
                </span>
                <span className="cz-hz-tip num">{tip ? clock(tip) : ''}</span>
              </li>
            )
          })}
        </ol>
      </div>
      {chips.length > 0 && (
        <div className="cz-constellations">
          <span className="cz-con-h">Draw a belief</span>
          {chips.map(({ key, n }) => {
            const Mark = BELIEF_ICON[key]
            const on = ctx.light.belief === key
            return (
              <button
                key={key}
                type="button"
                className={`cz-chip cz-con${on ? ' is-on' : ''}`}
                aria-pressed={on && ctx.light.pinned}
                onPointerEnter={() => ctx.hoverBelief(key)}
                onPointerLeave={() => ctx.hoverBelief(null)}
                onFocus={() => ctx.hoverBelief(key)}
                onBlur={() => ctx.hoverBelief(null)}
                onClick={() => ctx.pinBelief(key)}
              >
                {Mark && <Mark size={14} aria-hidden="true" />}
                {nameOf(key)} <span className="num">{n}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function touchCount(key: string, booms: CrazyBoom[], games: CrazyGame[]): number {
  const t = touches(key, booms, games)
  return t.calls.length + t.games.length
}

/** Two fills on one bar: Our chance and Crazy 1's, out of the same ceiling. */
function Fills({ ours, crazy, grow = false }: { ours: number; crazy: number; grow?: boolean }) {
  const scale = Math.max(0.3, Math.ceil(Math.max(ours, crazy) * 10) / 10)
  return (
    <div className={`cz-fills${grow ? ' is-grow' : ''}`}>
      <span className="lab">Our call</span>
      <span className="bar" aria-hidden="true">
        <span className="fill ours" style={{ width: `${(ours / scale) * 100}%` }} />
      </span>
      <span className="v num">{pct(ours)}</span>
      <span className="lab is-cz">Crazy 1</span>
      <span className="bar" aria-hidden="true">
        <span className="fill cz" style={{ width: `${(crazy / scale) * 100}%` }} />
      </span>
      <span className="v num is-cz">{pct(crazy)}</span>
    </div>
  )
}

function Result({ b }: { b: CrazyBoom }) {
  if (b.boom == null) return null
  return (
    <span className={`cz-res ${b.boom ? 'hit' : 'miss'}`}>
      {b.boom ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
      {b.boom ? 'Boom' : 'No boom'} · <span className="num">{b.got}</span> {STAT_WORD[b.stat]}
    </span>
  )
}

/** The picked call, opened: his ceiling with both chances, and why Crazy 1 believes it. */
function BoomCard({ call, booms, onPick }: { call: CrazyBoom; booms: CrazyBoom[]; onPick: (id: string) => void }) {
  const mine = booms.filter((b) => b.player === call.player && b.game_id === call.game_id)
  const gap = gapOf(call)
  return (
    <aside className="cz-card cz-boom-card" id="cz-card" aria-label={`Boom call: ${call.name}`} aria-live="polite">
      <span className="cz-eyebrow">Boom call</span>
      <div className="cz-bc-who">
        <PlayerHead player={{ id: call.player, name: call.name }} size={48} team={call.team} />
        <div>
          <h3>{call.name}</h3>
          <p>
            {call.team} {call.home ? 'vs' : '@'} {call.opponent} · Tip <span className="num">{clock(call.tip)}</span>
          </p>
        </div>
      </div>
      {mine.length > 1 && (
        <div className="cz-seg" role="group" aria-label="Stat">
          {mine.map((b) => (
            <button key={b.stat} type="button" aria-pressed={b.stat === call.stat} onClick={() => onPick(callId(b))}>
              {STAT_WORD[b.stat]}
            </button>
          ))}
        </div>
      )}
      <p className="cz-bc-line">
        <span>
          {STAT_WORD[call.stat]} line <b className="num">{call.line.toFixed(1)}</b>
        </span>
        <span>
          Boom <b className="num">{call.bar}+</b>
        </span>
      </p>
      <Fills key={callId(call)} ours={call.ours} crazy={call.crazy} grow />
      <p className="cz-bc-gap">
        I see <b className="num">{signed(gap)}</b> points of chance more than Our call.
      </p>
      <div className="cz-bc-why">
        <span className="cz-eyebrow">Why I think so</span>
        {call.beliefs.length === 0 ? (
          <p>Nothing extra: he’s here because Our chance already likes him, and I add nothing to it.</p>
        ) : (
          <ul>
            {call.beliefs.map((x) => {
              const Mark = BELIEF_ICON[x.belief]
              return (
                <li key={x.belief}>
                  {Mark && <Mark size={16} aria-hidden="true" />}
                  <span>
                    <b>{nameOf(x.belief)}.</b> {whyWords(x, call)}
                  </span>
                  <span className="num cz-push">{signed(x.push * 100)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="cz-bc-after">
        {call.boom == null ? (
          <>
            After the final I mark it <span className="cz-res hit">Boom</span> or{' '}
            <span className="cz-res miss">No boom</span>
          </>
        ) : (
          <Result b={call} />
        )}
      </p>
    </aside>
  )
}

/** One call as a plain row that pulls open to its reasons; it lights its star while pointed at. */
function BoomRow({ b, ctx }: { b: CrazyBoom; ctx: Ctx }) {
  const [open, setOpen] = useState(false)
  const id = callId(b)
  const look = callLook(id, b.game_id, ctx)
  return (
    <li
      className={`cz-row${open ? ' is-open' : ''}${look}`}
      onPointerEnter={() => ctx.setLight((l) => ({ ...l, call: id }))}
      onPointerLeave={() => ctx.setLight((l) => ({ ...l, call: null }))}
    >
      <button
        type="button"
        className="cz-row-btn"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          ctx.pick(id)
        }}
      >
        <PlayerHead player={{ id: b.player, name: b.name }} size={40} team={b.team} />
        <span className="cz-row-who">
          <b>{b.name}</b>
          <small>
            {b.team} {b.home ? 'vs' : '@'} {b.opponent} · <span className="num">{clock(b.tip)}</span>
          </small>
        </span>
        <span className="cz-row-line">
          <small>
            {STAT_WORD[b.stat]} line <span className="num">{b.line.toFixed(1)}</span>
          </small>
          <b className="num">Boom {b.bar}+</b>
        </span>
        <Fills ours={b.ours} crazy={b.crazy} />
        <span className="cz-row-chips">
          {b.beliefs.map((x) => (
            <span key={x.belief} className="cz-chip">
              {nameOf(x.belief)}
            </span>
          ))}
          <Result b={b} />
        </span>
        <CaretDown className="cz-caret" size={18} aria-hidden="true" />
      </button>
      <div className="cz-drawer">
        <div>
          {b.beliefs.length === 0 ? (
            <p>Our chance already likes him; none of my beliefs adds to it.</p>
          ) : (
            <ul>
              {b.beliefs.map((x) => (
                <li key={x.belief}>
                  <b>{nameOf(x.belief)}:</b> {whyWords(x, b)} <span className="num">{signed(x.push * 100)}</span> pts of
                  chance
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

/** Games a belief moved: an upset, a lean or a low total, with Our call and Crazy 1's on one line. */
function Breaks({ games, ctx }: { games: CrazyGame[]; ctx: Ctx }) {
  const moved = [...surprises(games)].sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
  const quiet = calm(games)
  if (!games.length) return null
  return (
    <section className="cz-sec" aria-labelledby="cz-breaks">
      <div className="cz-sec-h">
        <h2 id="cz-breaks">Games that could break</h2>
        <p>Where a belief moves the winner or the total. Each line runs from the away team’s win to the home team’s.</p>
      </div>
      {moved.length === 0 ? (
        <div className="cz-card cz-empty">
          <p>No game breaks from Our call this night. My beliefs only move a game when their story fits.</p>
        </div>
      ) : (
        <ol className="cz-games">
          {moved.map((g, i) => (
            <Game
              g={g}
              rank={i + 1}
              key={g.game_id}
              tag={surpriseTag(g)}
              look={ctx.lit ? (ctx.lit.games.includes(g.game_id) ? ' is-lit' : ' is-dim') : ''}
            />
          ))}
        </ol>
      )}
      {quiet.length > 0 && (
        <p className="cz-calm">
          <span>Same as Our call:</span>
          {quiet.map((g) => (
            <span key={g.game_id} className="cz-chip">
              {g.away} @ {g.home}
              {g.final && <Settled g={g} />}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/** Each belief as a card with two sides: the creed and who it touches tonight, and its seasons. */
function Beliefs({ booms, games, ctx }: { booms: CrazyBoom[]; games: CrazyGame[]; ctx: Ctx }) {
  const [myths, setMyths] = useState<MythKind | null>(null)
  return (
    <>
      <div className="cz-bel-row">
        <h3 className="cz-bel-group">For players: who goes way over</h3>
        <MythButton kind="player" onOpen={setMyths} />
      </div>
      <ul className="cz-beliefs is-players">
        {BOOM_BELIEFS.map((b) => (
          <BeliefCard
            key={b.key}
            k={b.key}
            name={b.name}
            creed={b.creed}
            held={b.held}
            n={touchCount(b.key, booms, games)}
            unit="call"
            ctx={ctx}
            front={<SeasonBars b={b} stat={mainStat(b)} />}
            back={
              <div className="cz-back-seasons">
                <p className="cz-back-h">Booms over expected, among its top fifth</p>
                <SeasonTable b={b} />
              </div>
            }
          />
        ))}
      </ul>
      <div className="cz-bel-row">
        <h3 className="cz-bel-group">For games: who wins, and by how much</h3>
        <MythButton kind="game" onOpen={setMyths} />
      </div>
      <ul className="cz-beliefs">
        {BELIEFS.map((b) => (
          <BeliefCard
            key={b.key}
            k={b.key}
            name={b.name}
            creed={b.creed}
            held={b.held}
            n={touchCount(b.key, booms, games)}
            unit="game"
            ctx={ctx}
            front={
              b.pips ? (
                <span className="cz-pips" aria-hidden="true">
                  {Array.from({ length: b.pips[1] }, (_, i) => (
                    <i key={i} className={i < b.pips![0] ? '' : 'x'} />
                  ))}
                </span>
              ) : null
            }
            back={
              <div className="cz-back-seasons">
                <p className="cz-back-h">Its weight</p>
                <p>{b.weight}</p>
                <p className="cz-back-h">How it held</p>
                <p>{b.held}</p>
              </div>
            }
          />
        ))}
      </ul>
      {myths && <MythSheet kind={myths} onClose={() => setMyths(null)} />}
    </>
  )
}

const MYTHS_OF: Record<MythKind, { title: string; list: Myth[] }> = {
  player: { title: 'Player myths I refuse', list: PLAYER_MYTHS },
  game: { title: 'Game myths I refuse', list: GAME_MYTHS },
}

/** The way into a set of refused myths: a small button by its beliefs. */
function MythButton({ kind, onOpen }: { kind: MythKind; onOpen: (k: MythKind) => void }) {
  const { title, list } = MYTHS_OF[kind]
  return (
    <button type="button" className="cz-myth-btn" aria-haspopup="dialog" onClick={() => onOpen(kind)}>
      <Prohibit size={16} aria-hidden="true" />
      {title}
      <span className="num">{list.length}</span>
    </button>
  )
}

/** The refused myths in a pop-up: centred on desktop, a bottom sheet you can swipe away on phones. */
function MythSheet({ kind, onClose }: { kind: MythKind; onClose: () => void }) {
  const { title, list } = MYTHS_OF[kind]
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    sheet.current?.querySelector<HTMLElement>('.cz-sheet-x')?.focus()
    document.body.classList.add('cz-sheet-open')
    return () => {
      document.body.classList.remove('cz-sheet-open')
      opener?.focus?.()
    }
  }, [])
  useEscapeLayer(true, onClose)
  useSwipeToClose(sheet, onClose, { media: '(max-width: 719px)' })
  return createPortal(
    <div className="cz-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cz-sheet" role="dialog" aria-modal="true" aria-labelledby="cz-sheet-t" ref={sheet}>
        <div className="cz-sheet-handle" aria-hidden="true" />
        <div className="cz-sheet-head">
          <span className="ci">
            <Prohibit size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="cz-sheet-t">{title}</h2>
            <p>Fan favourites I tested on past seasons and threw out.</p>
          </div>
          <button type="button" className="cz-sheet-x" aria-label="Close" onClick={onClose}>
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <ul className="cz-myth-list">
          {list.map((m) => (
            <li key={m.name}>
              <s>{m.name}</s>
              <p className="says">“{m.says}”</p>
              <p className="data">{m.data}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

function BeliefCard({
  k,
  name,
  creed,
  held,
  n,
  unit,
  ctx,
  front,
  back,
}: {
  k: string
  name: string
  creed: string
  held: string
  n: number
  unit: 'call' | 'game'
  ctx: Ctx
  front: ReactNode
  back: ReactNode
}) {
  const [turned, setTurned] = useState(false)
  const Mark = BELIEF_ICON[k]
  const on = ctx.light.belief === k
  return (
    <li
      className={`cz-belief${n > 0 ? ' is-live' : ''}${on ? ' is-on' : ''}${turned ? ' is-turned' : ''}`}
      onPointerEnter={() => n > 0 && ctx.hoverBelief(k)}
      onPointerLeave={() => n > 0 && ctx.hoverBelief(null)}
    >
      <div className="cz-face-side" key={turned ? 'back' : 'front'}>
        <h4>
          <span className="ci">{Mark && <Mark size={18} aria-hidden="true" />}</span>
          {name}
        </h4>
        {turned ? (
          back
        ) : (
          <>
            <p className="say">{creed}</p>
            {front}
            <p className="held">{held}</p>
          </>
        )}
      </div>
      <div className="cz-belief-foot">
        {n > 0 ? (
          <button type="button" className="cz-chip cz-touch" onClick={() => ctx.showBelief(k)}>
            <span className="num">{n}</span>{' '}
            {unit === 'call' ? (n === 1 ? 'call' : 'calls') : n === 1 ? 'game' : 'games'} tonight
          </button>
        ) : (
          <span className="cz-muted">Not in play tonight</span>
        )}
        <button type="button" className="cz-turn" aria-pressed={turned} onClick={() => setTurned(!turned)}>
          <ArrowCounterClockwise size={14} aria-hidden="true" />
          {turned ? 'Turn back' : 'Turn over'}
        </button>
      </div>
    </li>
  )
}

/** A belief's replay, season by season: booms seen over booms expected among its top fifth. */
function SeasonBars({ b, stat }: { b: BoomBelief; stat: BoomStat }) {
  const vals = b.seasons[stat] ?? []
  const reach = Math.max(0.2, ...vals.map((v) => Math.abs(v - 1)))
  return (
    <div
      className="cz-bars"
      role="img"
      aria-label={`${b.name}, ${statLong(stat)}: ${vals.map((v, i) => `${SEASONS[i]} ${lift(v)}`).join(', ')}`}
    >
      {vals.map((v, i) => (
        <span key={i} className={`cz-bar-col${i === vals.length - 1 ? ' is-now' : ''}`}>
          <span
            className={`cz-bar ${v >= 1 ? 'up' : 'down'}`}
            style={{ height: `${(Math.abs(v - 1) / reach) * 50}%` }}
          />
        </span>
      ))}
    </div>
  )
}

/** The same replay as a table, season by season, a column per stat it believes for. */
function SeasonTable({ b }: { b: BoomBelief }) {
  const stats = (['pts', 'reb'] as BoomStat[]).filter((s) => b.seasons[s])
  return (
    <table className="cz-season-table">
      <thead>
        <tr>
          <th scope="col">Season</th>
          {stats.map((s) => (
            <th key={s} scope="col">
              {STAT_WORD[s]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SEASONS.map((season, i) => (
          <tr key={season} className={i === SEASONS.length - 1 ? 'is-now' : ''}>
            <th scope="row">{i === SEASONS.length - 1 ? `${season} so far` : season}</th>
            {stats.map((s) => {
              const v = b.seasons[s]![i]
              return (
                <td key={s} className={`num ${v >= 1 ? 'up' : 'down'}`}>
                  {lift(v)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** One mark per settled call, lit when it boomed; tap one to read it. */
function BoomTally({ r }: { r: CrazyBoomRecord | null | undefined }) {
  const [only, setOnly] = useState<'all' | 'boom' | 'miss'>('all')
  const [read, setRead] = useState<string | null>(null)
  const all = marks(r)
  const kept = all.filter((m) => only === 'all' || (only === 'boom') === m.boom)
  const open = all.find((m) => m.key === read)
  return (
    <div className="cz-card cz-tally-card">
      <div className="cz-tally-head">
        <div className="cz-tally">
          <div>
            <span className="num is-cz">{r?.caught ?? 0}</span>booms caught
          </div>
          <div>
            <span className="num">{r?.picks ?? 0}</span>calls
          </div>
        </div>
        {all.length > 0 && (
          <div className="cz-seg" role="group" aria-label="Show calls">
            {(['all', 'boom', 'miss'] as const).map((o) => (
              <button key={o} type="button" aria-pressed={only === o} onClick={() => setOnly(o)}>
                {o === 'all' ? 'All' : o === 'boom' ? 'Booms' : 'Misses'}
              </button>
            ))}
          </div>
        )}
      </div>
      {all.length === 0 ? (
        <p className="cz-muted">{BOOM_WORDS.empty}</p>
      ) : (
        <>
          <ul className="cz-marks">
            {kept.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  className={`cz-mark ${m.boom ? 'boom' : 'miss'}`}
                  aria-label={`${m.name} ${STAT_WORD[m.stat]}: ${m.boom ? 'boomed' : 'no boom'}`}
                  aria-pressed={read === m.key}
                  onClick={() => setRead(read === m.key ? null : m.key)}
                />
              </li>
            ))}
          </ul>
          <p className="cz-mark-read" aria-live="polite">
            {open ? (
              <>
                <b>{open.name}</b> {STAT_WORD[open.stat]}, {open.team}: {open.boom ? 'went way over' : 'no boom'} (Our
                chance said <span className="num">{pct(open.ours)}</span>)
              </>
            ) : (
              'Tap a mark to read the call. Filled marks went way over; outlines are misses.'
            )}
          </p>
        </>
      )}
    </div>
  )
}

/** Booms caught against what Our chance expected, and whether the gap is more than luck. */
function LuckOrLead({ r }: { r: CrazyBoomRecord | null | undefined }) {
  const state = boomState(r)
  const range = r ? rangeMarks(r) : null
  const reach = r ? Math.max(r.caught, r.expected, 1) * 1.15 : 1
  return (
    <div className="cz-card">
      <h3>Luck or lead?</h3>
      {r && r.nights > 0 && (
        <>
          <p className="cz-muted">
            Over <span className="num">{r.nights}</span> {r.nights === 1 ? 'night' : 'nights'}, what Our chance expected
            from my calls and what they did.
          </p>
          <div
            className="cz-vs"
            role="img"
            aria-label={`Our chance expected ${r.expected.toFixed(1)} booms, I caught ${r.caught}`}
          >
            <span className="rail" />
            <span className="pt ours" style={{ left: `${(r.expected / reach) * 100}%` }}>
              <span className="lb">
                Our chance said <b className="num">{r.expected.toFixed(1)}</b>
              </span>
            </span>
            <span className="pt cz" style={{ left: `${(r.caught / reach) * 100}%` }}>
              <span className="lb">
                Caught <b className="num">{r.caught}</b>
              </span>
            </span>
          </div>
        </>
      )}
      {range && r && (
        <div
          className="cz-range"
          role="img"
          aria-label={`Booms over Our chance a night ${signed(r.edge ?? 0, 2)}, range ${signed(r.edge_low ?? 0, 2)} to ${signed(r.edge_high ?? 0, 2)}`}
        >
          <span
            className="bar"
            style={{
              left: `${range.low}%`,
              width: `${range.high - range.low}%`,
            }}
          />
          <span className="z" style={{ left: `${range.zero}%` }} />
          <span className="pt" style={{ left: `${range.edge}%` }} />
          <span className="lb" style={{ left: `${range.low}%` }}>
            <span className="num">{signed(r.edge_low ?? 0, 2)}</span>
          </span>
          <span className="lb" style={{ left: `${range.high}%` }}>
            <span className="num">{signed(r.edge_high ?? 0, 2)}</span>
          </span>
          <span className="lb lb-z" style={{ left: `${range.zero}%` }}>
            <span className="num">0</span>
          </span>
        </div>
      )}
      <p className={`cz-verdict is-${state}`}>
        <Info size={16} aria-hidden="true" />
        {state === 'empty'
          ? 'Once my calls settle, this weighs what I caught against what Our chance expected.'
          : BOOM_WORDS[state]}
      </p>
    </div>
  )
}

/** His game calls against Our call: winners right and the bold ones, kept small under the booms. */
function GameRecord({ r }: { r: CrazyRecord }) {
  const state = recordState(r)
  return (
    <details className="cz-card cz-game-rec">
      <summary>
        <span>My game calls</span>
        <span className="cz-muted">
          {state === 'empty'
            ? 'none final yet'
            : `${r.crazy_hits} of ${r.games} winners right · Our call ${r.ours_hits}`}
        </span>
        <CaretDown className="cz-caret" size={18} aria-hidden="true" />
      </summary>
      <p className={`cz-verdict is-${state}`}>
        <Info size={16} aria-hidden="true" />
        {RECORD_WORDS[state]} {state !== 'empty' && r.edge != null && <>Edge {edge100(r.edge)} per 100 games.</>}
      </p>
      {r.bold.length > 0 && (
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
    </details>
  )
}
