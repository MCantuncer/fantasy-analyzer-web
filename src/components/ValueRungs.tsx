import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { STAT_UNIT, clock, nightLabel, odds } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import {
  bigValueNote,
  byChance,
  byPlayer,
  concentration,
  hadOf,
  landWords,
  loadChoice,
  nightSum,
  pctText,
  picksOf,
  pipFills,
  resultOf,
  rungLabel,
  rungName,
  saveChoice,
  signed2,
  tapeOf,
  typical,
  who,
} from '../lib/valueRungs'
import type { Pick, PickGroup } from '../lib/valueRungs'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { RungTape } from './RungTape'
import { RungTrack, ShapeBook } from './RungTrack'
import './ValueRungs.css'

const PHONE = '(max-width: 719px)'
const VIEW = 'vr-finds'
type View = 'player' | 'chance'

function usePhone() {
  const ask = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches
  const [phone, setPhone] = useState(ask)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}

/** Value Rungs: the night's rungs where the odds pay more than our chance needs. Everything comes
 *  from the rungs the server sends; the notes are written from the data only. Comparison only. */
export function ValueRungs({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  const phone = usePhone()
  const [chosen, setChosen] = useState<View | null>(() => loadChoice(VIEW, ['player', 'chance'] as const))
  const [more, setMore] = useState<Record<string, boolean>>({})
  const view: View = chosen ?? (phone ? 'chance' : 'player')
  const picks = useMemo(() => picksOf(lines), [lines])
  const tape = useMemo(() => tapeOf(lines), [lines])

  // A server from before the rungs sends none at all: show nothing rather than a false "failed".
  const served = data.games.some((g) => g.players.some((p) => p.rungs !== undefined))
  if (!served || data.games.length === 0) return null

  const label = nightLabel(data.date)
  const rungs = lines.reduce((s, l) => s + (l.kind === 'player' ? l.rungs.length : 0), 0)
  const looks = data.games.map((g) => g.checked).sort()
  const last = looks[looks.length - 1] ?? ''
  const pick = (v: View) => {
    setChosen(v)
    saveChoice(VIEW, v)
  }

  return (
    <section className="ic-sec vr" aria-labelledby="vr-h">
      <div className="vr-h">
        <h2 id="vr-h">
          <NotchIcon />
          Value Rungs
        </h2>
      </div>
      <p className="vr-gloss">
        <span className="vr-hide-s">Rungs where the odds pay more than our chance needs. </span>
        <b>Value = our chance × odds − 1</b>: +0.30 means 1.30 back per 1, on average, if our chance is right.
        <span className="vr-hide-s"> Only odds over 1.33; the book's chance has its margin removed.</span>
      </p>
      {!settled && rungs > 0 && (
        <p className="vr-when">
          <span className="ic-live" aria-hidden="true" />
          Odds of&nbsp;<span className="num">{clock(last)}</span>, the last look. They can move until tip.
        </p>
      )}
      {rungs === 0 ? (
        <div className="vr-empty" role="status">
          <b>The book's ladders didn't load for {label}.</b>
          <p>
            Our lines are kept. Value and rung scores need the ladders, so this night is not in the record. Last try{' '}
            <span className="num">{clock(last)}</span>.
          </p>
        </div>
      ) : (
        <>
          {picks.length > 0 && <PhoneSum picks={picks} total={tape.length} settled={settled} />}
          {picks.length > 0 && <Tiles picks={picks} total={tape.length} settled={settled} where="top" />}
          <RungTape items={tape} phone={phone} />
          {picks.length === 0 ? (
            <div className="vr-empty" role="status">
              <b>No rung beat its price {settled ? 'that night' : 'so far tonight'}.</b>
              <p>
                Typical rung <span className="num">{signed2(typical(tape) ?? 0)}</span> a unit at our chances.{' '}
                {settled ? `Nothing goes into the record for ${label}.` : 'Odds can move until tip.'}
              </p>
            </div>
          ) : (
            <>
              <div className="vr-finds-h">
                <h3>{settled ? `How the ${picks.length} went` : `Tonight's ${picks.length}`}</h3>
                <div className="ic-seg vr-seg" role="group" aria-label="Group value rungs">
                  <button type="button" aria-pressed={view === 'player'} onClick={() => pick('player')}>
                    By Player
                  </button>
                  <button type="button" aria-pressed={view === 'chance'} onClick={() => pick('chance')}>
                    By Hit Chance
                  </button>
                </div>
              </div>
              <Legend />
              <Finds
                picks={picks}
                view={view}
                limit={phone ? 4 : 6}
                more={more}
                onMore={(k) => setMore((m) => ({ ...m, [k]: !m[k] }))}
              />
              <Tiles picks={picks} total={tape.length} settled={settled} where="after" />
            </>
          )}
        </>
      )}
    </section>
  )
}

function Finds({
  picks,
  view,
  limit,
  more,
  onMore,
}: {
  picks: Pick[]
  view: View
  limit: number
  more: Record<string, boolean>
  onMore: (k: string) => void
}) {
  const groups = view === 'player' ? byPlayer(picks) : byChance(picks)
  const conc = concentration(picks)
  const big = bigValueNote(picks)
  // each note sits beside the group it is about: the player's (most of his rungs), the biggest value's
  const home = (f: (p: Pick) => boolean) =>
    [...groups].sort((a, b) => b.picks.filter(f).length - a.picks.filter(f).length)[0]?.key
  const concAt = conc ? home((p) => who(p) === conc.key) : null
  const bigAt = big ? home((p) => p === big.pick) : null
  const settled = picks.some((p) => p.rung.hit != null)
  return (
    <div className="vr-finds">
      {groups.map((g) => {
        const all = more[`${view}:${g.key}`]
        const shown = all ? g.picks : g.picks.slice(0, limit)
        const notes: ReactNode[] = []
        if (conc && concAt === g.key)
          notes.push(
            <aside className="vr-note-m" key="c">
              <h4>
                <LinkIcon />
                One player, one call
              </h4>
              <p>{conc.text}</p>
              <small>
                Written from the data · {conc.n} picks · {conc.players} players
              </small>
            </aside>,
          )
        if (big && bigAt === g.key)
          notes.push(
            <aside className="vr-note-m" key="b">
              <h4>
                <InfoIcon />
                {big.title}
              </h4>
              <p>{big.text}</p>
              <dl>
                <dt>Out of 100 like it</dt>
                <dd>{big.per100} land</dd>
                <dt>Each pays</dt>
                <dd>{odds(big.pick.rung.odd)}</dd>
                <dt>Back for 100 out</dt>
                <dd>{big.back}</dd>
                <dt>A unit, on average</dt>
                <dd>{signed2(big.pick.value)}</dd>
              </dl>
              <small>Written from the night's biggest value</small>
            </aside>,
          )
        return (
          <div className={`vr-group${notes.length ? '' : ' no-note'}`} key={g.key}>
            <div className="vr-g-main">
              <GroupHead group={g} settled={settled} />
              <ul className="vr-rows">
                {shown.map((p) => (
                  <PickRow key={`${p.line.id}-${p.rung.n}`} pick={p} showName={!g.line} />
                ))}
              </ul>
              {g.picks.length > limit && (
                <button type="button" className="secondary vr-more" aria-expanded={!!all} onClick={() => onMore(`${view}:${g.key}`)}>
                  <Chevron />
                  {all ? 'Show fewer' : `Show ${g.picks.length - limit} more ${g.line ? `${g.title} rungs` : g.title.toLowerCase()}`}
                </button>
              )}
            </div>
            {notes.length > 0 && <div className="vr-g-notes">{notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

function GroupHead({ group: g, settled }: { group: PickGroup; settled: boolean }) {
  const done = g.picks.every((p) => p.rung.hit != null)
  const s = nightSum(g.picks)
  const sum = done ? (
    <span className="vr-g-sum">
      <b className={s.net >= 0 ? 'good' : 'bad'}>{signed2(s.net)}u</b>
      <span>
        {s.hits} of {s.n} landed
      </span>
    </span>
  ) : (
    <span className="vr-g-sum">
      <span>
        our chances say <b>{s.said.toFixed(1)}</b> of {s.n}
        {settled && s.settled > 0 ? ` · ${s.hits} landed so far` : ''}
      </span>
    </span>
  )
  if (g.line) {
    const l = g.line
    const stats = [...new Set(g.picks.map((p) => p.line))]
    const had = stats.map(hadOf).filter(Boolean)
    return (
      <div className="vr-g-head">
        <span className="vr-face" aria-hidden="true">
          <PlayerHead player={{ id: l.playerId ?? 0, name: l.name }} team={l.team} size={38} />
          <span className="vr-face-team">
            <TeamLogo abbrev={l.team} size={16} />
          </span>
        </span>
        <div className="vr-g-who">
          <b>{l.name}</b>
          <span>
            {l.gameLabel} · {g.picks.length} rungs{had.length ? ` · had ${had.join(' · ')}` : ''}
          </span>
        </div>
        {sum}
      </div>
    )
  }
  return (
    <div className="vr-g-title">
      <b>{g.title}</b>
      <span className="vr-g-sub">{g.sub}</span>
      {sum}
    </div>
  )
}

function PickRow({ pick: p, showName }: { pick: Pick; showName: boolean }) {
  const r = p.rung
  const l = p.line
  const res = resultOf(p)
  const words = landWords(p.ours)
  const pending = res.kind === 'pending' || res.kind === 'live' ? ', not played yet' : ''
  return (
    <li className="vr-row" aria-label={`${l.name}, ${rungLabel(r, STAT_UNIT[l.stat])}${pending}`}>
      <span className="vr-stamp" aria-hidden="true">
        <b className="num">{signed2(p.value)}</b>
        <small>value</small>
      </span>
      <span className="vr-rung" aria-hidden="true">
        {showName && <span className="pl">{l.name}</span>}
        <b>{rungName(l.stat, r.n)}</b>{' '}
        <span className="at">
          at <span className="num">{odds(r.odd)}</span>
        </span>
      </span>
      <span className="vr-chance" aria-hidden="true">
        <RungTrack ours={p.ours} book={r.book} odd={r.odd} />
        <span className="vr-ct">
          <span>
            Ours <b>{pctText(p.ours)}</b>
          </span>
          <span>
            needs <b>{pctText(p.price)}</b>
          </span>
          <span>
            book <span className="num">{pctText(r.book)}</span>
          </span>
        </span>
      </span>
      <span className="vr-pips" aria-hidden="true">
        <Pips p={p.ours} />
        <span className="vr-pw">
          {words.pre}
          <b>{words.strong}</b>
          {words.post}
        </span>
      </span>
      <ResultSlot pick={p} />
    </li>
  )
}

/** The fixed 10-pip strip: filled for our chance in tenths, the last pip partly. */
function Pips({ p }: { p: number }) {
  return (
    <span className="vr-pip-strip">
      {pipFills(p).map((f, i) => (
        <span className="vr-pip" key={i}>
          {f > 0.02 && <span style={{ width: `${Math.round(f * 100)}%` }} />}
        </span>
      ))}
    </span>
  )
}

/** Where the rung stands: still to tip with the time of the odds, playing, then landed or missed. */
function ResultSlot({ pick: p }: { pick: Pick }) {
  const res = resultOf(p)
  const g = p.line.game
  if (res.kind === 'landed' || res.kind === 'missed')
    return (
      <span className={`vr-res ${res.kind === 'landed' ? 'good' : 'bad'}`} aria-hidden="true">
        {res.kind === 'landed' ? <TickIcon /> : <CrossIcon />}
        <span>
          <b>{res.kind === 'landed' ? 'Landed' : 'Missed'}</b>
          <small>{res.had}</small>
        </span>
      </span>
    )
  if (res.kind === 'out')
    return (
      <span className="vr-res wait" aria-hidden="true">
        <span>
          <b>No result</b>
          <small>{res.had}</small>
        </span>
      </span>
    )
  return (
    <span className="vr-res wait" aria-hidden="true">
      {res.kind === 'live' ? <span className="ic-live" /> : <ClockIcon />}
      <span>
        <b>
          {res.kind === 'live' ? (
            'Playing'
          ) : (
            <>
              Tip <span className="num">{clock(g.tip)}</span>
            </>
          )}
        </b>
        <small>
          odds of <span className="num">{clock(g.checked)}</span>
        </small>
      </span>
    </span>
  )
}

function Tiles({ picks, total, settled, where }: { picks: Pick[]; total: number; settled: boolean; where: 'top' | 'after' }) {
  const s = nightSum(picks)
  const conc = concentration(picks)
  const hero = (
    <div className="vr-tile first">
      <div className="vr-hero">
        <span className="vr-outline">{s.n}</span>
        <span className="of">/ {total.toLocaleString('en')}</span>
      </div>
      <div className="sub">rungs beat their price · {((s.n / Math.max(total, 1)) * 100).toFixed(1)}%</div>
    </div>
  )
  const note = (
    <div className="vr-tile note">
      <LinkIcon />
      <div>
        <b>
          {s.n} picks · {s.players} players.
        </b>{' '}
        {conc ? `${conc.count} of the ${conc.n} are ${conc.name}: they land or miss together.` : 'Picks on one player land or miss together.'}
      </div>
    </div>
  )
  const tile = (big: ReactNode, sub: ReactNode, cls = '') => (
    <div className="vr-tile">
      <div className={`big ${cls}`}>{big}</div>
      <div className="sub">{sub}</div>
    </div>
  )
  return (
    <div className={`vr-tiles ${where}`}>
      {hero}
      {settled ? (
        <>
          {tile(
            <>
              {s.hits} <small>of {s.n} landed</small>
            </>,
            `our chances said ${s.said.toFixed(1)}`,
          )}
          {tile(
            <>
              {signed2(s.net)}
              <small>u</small>
            </>,
            'one unit each, at the odds',
            s.net >= 0 ? 'good' : 'bad',
          )}
          {s.top &&
            s.withoutTop != null &&
            tile(
              <>
                {signed2(s.withoutTop)}
                <small>u</small>
              </>,
              <>
                Without the biggest hit · one <span className="num">{odds(s.top.rung.odd)}</span> hit
              </>,
              s.withoutTop >= 0 ? 'good' : 'bad',
            )}
        </>
      ) : (
        <>
          {tile(
            <>
              {s.said.toFixed(1)} <small>of {s.n}</small>
            </>,
            'land, if our chances are right',
          )}
          {tile(
            <>
              {signed2(s.marked)}
              <small>u</small>
            </>,
            'on average, if our chances are right',
          )}
          {tile(
            <>
              {signed2(-s.n)}
              <small>u</small>
            </>,
            'if none land · a miss costs 1',
          )}
        </>
      )}
      {note}
    </div>
  )
}

/** Phones: two lines in place of the tiles at the top, so the first rung is on the first screen. */
function PhoneSum({ picks, total, settled }: { picks: Pick[]; total: number; settled: boolean }) {
  const s = nightSum(picks)
  return (
    <div className="vr-ph-sum">
      <div className="vr-hero">
        <span className="vr-outline">{s.n}</span>
        <span className="of">/ {total.toLocaleString('en')}</span>
      </div>
      <div className="t">
        rungs beat their price.
        <br />
        {settled ? (
          <>
            <b>{s.hits} landed</b> (said {s.said.toFixed(1)}) ·{' '}
            <b className={s.net >= 0 ? 'good' : 'bad'}>{signed2(s.net)}u</b>
          </>
        ) : (
          <>
            Our chances say <b>{s.said.toFixed(1)}</b> land.
          </>
        )}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="vr-legend" aria-hidden="true">
      <span>
        <svg viewBox="0 0 26 14">
          <rect className="o" x="1" y="3" width="24" height="8" rx="3" />
        </svg>
        Ours
      </span>
      <span>
        <ShapeBook />
        <span>
          Book<span className="vr-hide-s">, margin off</span>
        </span>
      </span>
      <span>
        <svg viewBox="0 0 26 14">
          <rect className="tr" x="1" y="4" width="24" height="7" rx="3" />
          <rect className="nt" x="12" y="0" width="2.5" height="14" />
        </svg>
        <span>
          Price<span className="vr-hide-s">: the chance the odds need (1 ÷ odds)</span>
        </span>
      </span>
      <span>
        <svg viewBox="0 0 26 14">
          <rect className="tr" x="1" y="4" width="24" height="7" rx="3" />
          <rect className="vl" x="13" y="4" width="10" height="7" />
          <rect className="nt" x="12" y="0" width="2.5" height="14" />
        </svg>
        <span className="vr-hide-s">Ours above the price: the value</span>
        <span className="vr-ph-in">Value</span>
      </span>
    </div>
  )
}

function NotchIcon() {
  return (
    <svg className="ic-i vr-hi" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 15h18" />
      <path d="M12 6v13" />
      <path d="M8 9h8" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="ic-i vr-ni" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="ic-i vr-ni" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6v.4" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="vr-ri" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function TickIcon() {
  return (
    <svg className="vr-ri" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 8.6 6.4 11.6 12.8 4.6" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg className="vr-ri" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 4.2 11.8 11.8" />
      <path d="M11.8 4.2 4.2 11.8" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="ic-i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
