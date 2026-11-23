import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { STAT_UNIT, clock, nightLabel, odds } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import {
  bestRung,
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
  resultOf,
  rungLabel,
  rungName,
  rungsServed,
  saveChoice,
  signed2,
  tapeBands,
  tapeOf,
  who,
} from '../lib/valueRungs'
import type { Pick, PickGroup, TapeItem } from '../lib/valueRungs'
import { PlayerLink } from './PlayerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
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

/** The Value rungs tool row's header line: "0 of 380 rungs beat their price · closest Andrew
 *  Nembhard 7+ assists at 1.47, −0.02". The name opens the player card, so this line sits beside
 *  the row's button, never inside it. */
export function ValueRungsLine({ data, lines }: { data: BookCompare; lines: Line[] }) {
  const tape = useMemo(() => tapeOf(lines), [lines])
  const best = useMemo(() => bestRung(lines), [lines])
  if (!rungsServed(data)) return null
  if (tape.length === 0) return <>The book's ladders didn't load for {nightLabel(data.date)}</>
  const n = tape.filter((t) => t.pick).length
  const l = best?.line
  const p = l ? { id: l.playerId ?? 0, name: l.name } : null
  return (
    <>
      <span className="vr-l-n">
        <b className="num">{n}</b> of <b className="num">{tape.length.toLocaleString('en')}</b> rungs beat their price
      </span>
      {best && l && p && (
        <span className="vr-l-best">
          {' · '}
          {n > 0 ? 'best' : 'closest'}{' '}
          <span className="vr-l-who">
            <PlayerLink player={p} decorative>
              <PlayerHead player={p} team={l.team} size={20} />
            </PlayerLink>
            <PlayerLink player={p} />
          </span>{' '}
          {best.rung.n}+ {STAT_UNIT[l.stat]} at <span className="num">{odds(best.rung.odd)}</span>,{' '}
          <span className="num">{signed2(best.value)}</span>
        </span>
      )}
    </>
  )
}

/** Value rungs, opened from Tools: the dot tape (every priced rung by odds band, against
 *  break-even), then the rungs that beat their price, if any did. Everything comes from the rungs
 *  the server sends; the notes are written from the data only. Comparison only. */
export function ValueRungs({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  const phone = usePhone()
  const [chosen, setChosen] = useState<View | null>(() => loadChoice(VIEW, ['player', 'chance'] as const))
  const [more, setMore] = useState<Record<string, boolean>>({})
  const view: View = chosen ?? (phone ? 'chance' : 'player')
  const picks = useMemo(() => picksOf(lines), [lines])
  const tape = useMemo(() => tapeOf(lines), [lines])

  if (!rungsServed(data)) return null

  const label = nightLabel(data.date)
  const looks = data.games.map((g) => g.checked).sort()
  const last = looks[looks.length - 1] ?? ''
  const pick = (v: View) => {
    setChosen(v)
    saveChoice(VIEW, v)
  }

  if (tape.length === 0)
    return (
      <div className="vr" role="status">
        <p className="vr-failed">
          <b>The book's ladders didn't load for {label}.</b> Our lines are kept. Value and rung scores need the
          ladders, so this night is not in the record. Last try <span className="num">{clock(last)}</span>.
        </p>
      </div>
    )

  return (
    <div className="vr">
      <DotTape items={tape} />
      <p className="vr-cap">
        Each dot is one rung: our chance × its odds − 1. Right of the line pays more than it should.
        {!settled && (
          <span className="vr-when">
            <span className="ic-live" aria-hidden="true" />
            Odds of <span className="num">{clock(last)}</span>, the last look. They can move until tip.
          </span>
        )}
      </p>
      {picks.length > 0 && (
        <>
          <div className="vr-finds-h">
            <h4>{settled ? `How the ${picks.length} went` : `Tonight's ${picks.length}`}</h4>
            <div className="vr-seg" role="group" aria-label="Group value rungs">
              <button type="button" aria-pressed={view === 'player'} onClick={() => pick('player')}>
                By Player
              </button>
              <button type="button" aria-pressed={view === 'chance'} onClick={() => pick('chance')}>
                By Hit Chance
              </button>
            </div>
          </div>
          <Sum picks={picks} settled={settled} />
          <Finds
            picks={picks}
            view={view}
            limit={phone ? 4 : 6}
            more={more}
            onMore={(k) => setMore((m) => ({ ...m, [k]: !m[k] }))}
          />
        </>
      )}
    </div>
  )
}

/** The value scale's ends: −1 (our chance 0) on the left; the right end leaves room for the rungs
 *  that beat their price, up to +1 (anything past it sits at the edge). */
function scaleOf(items: TapeItem[]) {
  const lo = -1
  const top = items.reduce((m, i) => Math.max(m, i.value), 0)
  const hi = Math.min(1, Math.max(0.1, top * 1.08))
  const at = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100
  return { hi, at }
}

/** The dot tape: one row per odds band, a dot per rung at its value, the band's average as a tall
 *  mark and the break-even line through every row. Drawn in CSS percentages, so it needs no
 *  measuring; the numbers are in the text beside it. */
function DotTape({ items }: { items: TapeItem[] }) {
  const bands = tapeBands(items)
  const s = scaleOf(items)
  const be = s.at(0)
  const ticks = [-1, -0.5, ...(s.hi >= 0.5 ? [0.5] : [])]
  return (
    <div className="vr-tape" style={{ '--vr-be': `${be.toFixed(2)}%` } as CSSProperties}>
      <div className="vr-axis" aria-hidden="true">
        <span />
        <span className="vr-ax">
          {ticks.map((t) => (
            <i key={t} className="num" style={{ left: `${s.at(t).toFixed(2)}%` }}>
              {signed2(t)}
            </i>
          ))}
          <i className="be" style={{ left: `${be.toFixed(2)}%` }}>
            Break-even
          </i>
        </span>
        <span />
      </div>
      <ol>
        {bands.map((b) => (
          <li key={b.name}>
            <span className="vr-tb">
              <b className="num">{b.name}</b>
              <span>
                <span className="num">{b.items.length.toLocaleString('en')}</span> rungs
              </span>
            </span>
            <span className="vr-strip" aria-hidden="true">
              {b.items.map((it, i) => (
                <i key={i} className={it.pick ? 'up' : undefined} style={{ left: `${s.at(it.value).toFixed(2)}%` }} />
              ))}
              <i className="avg" style={{ left: `${s.at(b.avg).toFixed(2)}%` }} />
            </span>
            <span className="vr-ta">
              Average <b className="num">{signed2(b.avg)}</b>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** One line in place of the old tiles: what our chances say of the picks, or how they went. */
function Sum({ picks, settled }: { picks: Pick[]; settled: boolean }) {
  const s = nightSum(picks)
  if (settled)
    return (
      <p className="vr-sum">
        <b className="num">{s.hits}</b> of <span className="num">{s.n}</span> landed (our chances said{' '}
        <span className="num">{s.said.toFixed(1)}</span>) ·{' '}
        <b className={`num ${s.net >= 0 ? 'good' : 'bad'}`}>{signed2(s.net)}</b> at one unit each
      </p>
    )
  return (
    <p className="vr-sum">
      Our chances say <b className="num">{s.said.toFixed(1)}</b> of <span className="num">{s.n}</span> land ·{' '}
      <b className="num">{signed2(s.marked)}</b> on average if they are right
    </p>
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
              <h5>One player, one call</h5>
              <p>{conc.text}</p>
              <small>
                Written from the data · {conc.n} picks · {conc.players} players
              </small>
            </aside>,
          )
        if (big && bigAt === g.key)
          notes.push(
            <aside className="vr-note-m" key="b">
              <h5>{big.title}</h5>
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
                <button type="button" className="vr-more" aria-expanded={!!all} onClick={() => onMore(`${view}:${g.key}`)}>
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
    const who = { id: l.playerId ?? 0, name: l.name }
    return (
      <div className="vr-g-head">
        <span className="vr-face">
          <PlayerLink player={who} decorative>
            <PlayerHead player={who} team={l.team} size={36} />
          </PlayerLink>
          <span className="vr-face-team" aria-hidden="true">
            <TeamLogo abbrev={l.team} size={16} />
          </span>
        </span>
        <div className="vr-g-who">
          <b>
            <PlayerLink player={who} />
          </b>
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

/** One rung that beat its price: its value as a plain bold number (no stamp box), the rung and its
 *  odds, our chance against what the odds need, then where it stands. */
function PickRow({ pick: p, showName }: { pick: Pick; showName: boolean }) {
  const r = p.rung
  const l = p.line
  const res = resultOf(p)
  const words = landWords(p.ours)
  const pending = res.kind === 'pending' || res.kind === 'live' ? ', not played yet' : ''
  const who = { id: l.playerId ?? 0, name: l.name }
  return (
    <li
      className={showName ? 'vr-row vr-row-who' : 'vr-row'}
      aria-label={`${l.name}, ${rungLabel(r, STAT_UNIT[l.stat])}${pending}`}
    >
      <span className="vr-val" aria-hidden="true">
        <b className="num">{signed2(p.value)}</b>
        <small>value</small>
      </span>
      <span className="vr-rung">
        {showName && (
          <span className="vr-who">
            <PlayerLink player={who} decorative>
              <PlayerHead player={who} team={l.team} size={24} />
            </PlayerLink>
            <PlayerLink player={who} />
          </span>
        )}
        <span className="vr-rl" aria-hidden="true">
          <b>{rungName(l.stat, r.n)}</b> at <span className="num">{odds(r.odd)}</span>
        </span>
      </span>
      <span className="vr-chance" aria-hidden="true">
        <span className="vr-ct">
          Ours <b className="num">{pctText(p.ours)}</b> · needs <span className="num">{pctText(p.price)}</span> · book{' '}
          <span className="num">{pctText(r.book)}</span>
        </span>
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
