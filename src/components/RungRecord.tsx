import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchBookRecord } from '../api/client'
import { nightLabel } from '../lib/iddaaCompare'
import type { BookCompare, BookRecord } from '../lib/iddaaCompare'
import {
  EARLY_NIGHTS,
  bandsOf,
  calNote,
  calRows,
  ledgerOf,
  losingRun,
  oftenText,
  totalsOf,
  unitsText,
  withoutBiggest,
} from '../lib/rungRecord'
import type { CalRow, LedgerNight, RecordBand, RecordTotals } from '../lib/rungRecord'
import './RungRecord.css'

type Known = BookCompare['nights']
const PHONE = '(max-width: 719px)'
const LEDGER_ROWS = 6
const NONE: Known = []

/** One query for the ribbon and the section: the record over the server's default nights. */
function useRecord() {
  return useQuery({ queryKey: ['book-record'], queryFn: () => fetchBookRecord(), retry: false, staleTime: 5 * 60_000 })
}

/** An older server has no record endpoint: show nothing rather than an error. */
const missing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405)

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

interface Read {
  rec: BookRecord
  bands: RecordBand[]
  tot: RecordTotals
  ledger: LedgerNight[]
  since: string | null
  counted: number
  without: number
}

function read(rec: BookRecord, known: Known): Read {
  const bands = bandsOf(rec.picks)
  const tot = totalsOf(bands)
  const ledger = ledgerOf(rec.series, known)
  const first = ledger[0]?.date
  const counted = ledger.length ? ledger.filter((n) => n.kind !== 'none').length : rec.nights
  return {
    rec,
    bands,
    tot,
    ledger,
    since: first ? nightLabel(first).split(' ').slice(1).join(' ') : null,
    counted,
    without: ledger.filter((n) => n.kind === 'none').length,
  }
}

/** The record, one tap from the top of the page: the balance and the hit count, a link down to it. */
export function RecordRibbon({ nights = NONE }: { nights?: Known }) {
  const q = useRecord()
  const r = useMemo(() => (q.data ? read(q.data, nights) : null), [q.data, nights])
  if (!r || r.tot.picks === 0) return null
  const { tot } = r
  return (
    <a href="#vr-record" className="vr-ribbon">
      <span className="vr-ribbon-lab">
        Running record
        <small>{r.since ? `since ${r.since}` : `last ${r.counted} nights`}</small>
      </span>
      <span className="vr-ribbon-figs">
        <span>
          <b className={`num ${tot.net >= 0 ? 'good' : 'bad'}`}>
            {unitsText(tot.net)}
            <span className="vr-ph-in">u</span>
          </b>
          <span className="vr-hide-s"> units</span>
        </span>
        <span>
          <b className="num">{tot.hits}</b> of <b className="num">{tot.picks}</b> landed
        </span>
      </span>
      <svg className="ic-i vr-ribbon-go" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </a>
  )
}

/** The Running Record: every night's value rungs as one balance, the nights it came from, the odds
 *  bands, and whether each side's chances came true as often as they said. Outside the night: it is
 *  the same whichever night is open. */
export function RungRecord({ nights = NONE, day = null }: { nights?: Known; day?: number | null }) {
  const q = useRecord()
  const r = useMemo(() => (q.data ? read(q.data, nights) : null), [q.data, nights])
  if (q.isError && missing(q.error)) return null
  return (
    <section className="vr-rec" id="vr-record" aria-labelledby="vr-rec-h">
      <h2 id="vr-rec-h" className="vr-rec-title">
        <TrendIcon />
        Running Record
      </h2>
      {q.isPending ? (
        <p className="vr-rec-wait" role="status">
          Reading the record…
        </p>
      ) : q.isError ? (
        <div className="vr-rec-empty" role="alert">
          <b>Couldn't load the running record.</b>
          <p>The night above is unaffected.</p>
          <button type="button" className="secondary" onClick={() => void q.refetch()}>
            Try again
          </button>
        </div>
      ) : !r || r.tot.picks === 0 ? (
        <div className="vr-rec-empty" role="status">
          <b>No settled value rungs yet.</b>
          <p>The record starts with the first night that has both ladders and results.</p>
        </div>
      ) : (
        <Body r={r} day={day} />
      )}
    </section>
  )
}

function Body({ r, day }: { r: Read; day: number | null }) {
  const phone = usePhone()
  const { rec, tot, bands, ledger } = r
  const series = ledger.length > 0
  const marked = series ? ledger.reduce((s, n) => s + n.marked, 0) : null
  const big = withoutBiggest(ledger, tot.net)
  const shelf = bands.length > 1 && bands[bands.length - 1].from >= 12 ? bands[bands.length - 1] : null
  const early = r.counted < EARLY_NIGHTS
  return (
    <>
      <p className="vr-rec-gloss">
        {r.since ? `All nights since ${r.since}` : `The last ${r.counted} saved nights`}: one unit on every rung that
        beat its price at odds over 1.33, at the odds of our last look.
        {series && (
          <>
            {' '}
            <span className="num">{r.counted}</span> nights with ladders{r.without ? `, ${r.without} without` : ''}.
          </>
        )}
      </p>
      <div className="vr-rec-top">
        <div className="vr-rec-bal">
          <b className={`num ${tot.net >= 0 ? 'good' : 'bad'}`}>{unitsText(tot.net)}</b>
          <span>units</span>
        </div>
        {tot.perUnit != null && (
          <div className="vr-rec-fig">
            <b className="num">{unitsText(tot.perUnit)}</b>
            <span>a unit, so far</span>
          </div>
        )}
        {marked != null && (
          <div className="vr-rec-fig">
            <b className="num">{unitsText(marked / tot.picks)}</b>
            <span>a unit, as marked</span>
          </div>
        )}
      </div>
      <div className="vr-rec-tiles">
        <div className="vr-rec-tile">
          <div className="sub">Picks</div>
          <div className="big num">{tot.picks}</div>
          <div className="sub">
            {series
              ? `${r.counted} nights · ${ledger.reduce((s, n) => s + n.players, 0)} player-nights`
              : `${rec.nights} nights · all stats`}
          </div>
        </div>
        <div className="vr-rec-tile">
          <div className="sub">Landed</div>
          <div className="big num">{tot.hits}</div>
          <div className="sub">
            {Math.round((tot.hits / tot.picks) * 100)}% · our chances said {Math.round(tot.said)}
          </div>
        </div>
        {big ? (
          <div className="vr-rec-tile">
            <div className="sub">Without the biggest hit</div>
            <div className={`big num ${big.net >= 0 ? 'good' : 'bad'}`}>{unitsText(big.net)}</div>
            <div className="sub">one {big.odds.toFixed(2)} hit swings it</div>
          </div>
        ) : shelf ? (
          <div className="vr-rec-tile">
            <div className="sub">Without the {shelf.name} shelf</div>
            <div className={`big num ${tot.net - shelf.net >= 0 ? 'good' : 'bad'}`}>{unitsText(tot.net - shelf.net)}</div>
            <div className="sub">
              {shelf.picks} long shots carry {unitsText(shelf.net)}
            </div>
          </div>
        ) : null}
      </div>
      {series && <BalanceChart ledger={ledger} phone={phone} />}
      {early && (
        <p className="vr-rec-callout">
          <InfoIcon />
          <span>
            Value picks lose most nights and come back in lumps. <span className="num">{r.counted}</span> nights and{' '}
            <span className="num">{tot.picks}</span> picks are too few to tell a good read from luck. Said vs happened,
            below, is what will show whether our chances are sharp.
          </span>
        </p>
      )}
      <div className="vr-rec-grid">
        {series && <Ledger ledger={ledger} day={day} />}
        <Bands bands={bands} />
        <Calibration rec={rec} wide={series} counted={r.counted} early={early} />
      </div>
    </>
  )
}

function Ledger({ ledger, day }: { ledger: LedgerNight[]; day: number | null }) {
  const [all, setAll] = useState(false)
  const rows = [...ledger].reverse()
  const shown = all ? rows : rows.slice(0, LEDGER_ROWS)
  return (
    <div className="vr-rec-card">
      <h3>
        Ledger<small>newest first</small>
      </h3>
      <table className="vr-rec-table">
        <caption className="sr-only">Night by night: value picks, how many landed, the night's net and the balance</caption>
        <thead>
          <tr>
            <th scope="col">Night</th>
            <th scope="col" className="n">
              <span className="vr-hide-s">Picks</span>
              <span className="vr-ph-in">Landed</span>
            </th>
            <th scope="col" className="n vr-hide-s">
              Landed
            </th>
            <th scope="col" className="n">
              Net
            </th>
            <th scope="col" className="n">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((n) => (
            <tr key={`${n.day}`} className={n.day != null && n.day === day ? 'this' : undefined}>
              <th scope="row">
                {n.label}
                {n.kind === 'none' ? (
                  <small>ladders didn't load</small>
                ) : n.day != null && n.day === day ? (
                  <small>the night above</small>
                ) : null}
              </th>
              {n.kind === 'none' ? (
                <>
                  <td className="n">–</td>
                  <td className="n vr-hide-s">–</td>
                  <td className="n">–</td>
                </>
              ) : (
                <>
                  <td className="n">
                    {n.picks > 0 && <span className="vr-ph-in">{n.hits} of </span>}
                    {n.picks}
                    {n.players > 0 && <small className="vr-hide-s">{n.players} players</small>}
                  </td>
                  <td className="n vr-hide-s">{n.hits}</td>
                  <td className={`n ${n.net > 0 ? 'good' : n.net < 0 ? 'bad' : ''}`}>{n.picks ? unitsText(n.net) : '0'}</td>
                </>
              )}
              <td className="n">
                <b>{unitsText(n.balance)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > LEDGER_ROWS && (
        <button type="button" className="vr-rec-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${rows.length} nights`}
        </button>
      )}
    </div>
  )
}

function Bands({ bands }: { bands: RecordBand[] }) {
  const last = bands[bands.length - 1]
  return (
    <div className="vr-rec-card">
      <h3>
        By odds band<small>how often picks land</small>
      </h3>
      <table className="vr-rec-table">
        <caption className="sr-only">Value picks by odds band: how often our chances said they would land and how often they did</caption>
        <thead>
          <tr>
            <th scope="col">Odds</th>
            <th scope="col" className="n">
              Picks
            </th>
            <th scope="col" className="n">
              Expected
            </th>
            <th scope="col" className="n">
              Happened
            </th>
            <th scope="col" className="n">
              Net
            </th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.name}>
              <th scope="row" className="num">
                {b.name}
              </th>
              <td className="n">{b.picks}</td>
              <td className="n">{b.picks ? oftenText(b.said) : '–'}</td>
              <td className="n">
                <b>{b.picks ? oftenText(b.hits / b.picks) : '–'}</b>
                <small>
                  {b.hits} of {b.picks}
                </small>
              </td>
              <td className={`n ${b.net >= 0 ? 'good' : 'bad'}`}>{unitsText(b.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {last && last.from >= 12 && last.picks > 0 && last.picks < 20 && (
        <p className="vr-rec-foot">
          {last.picks} picks at {last.name} with {last.hits} landed carry {unitsText(last.net)}. A shelf this small swings
          on one result: read it as early, not as a pattern.
        </p>
      )}
    </div>
  )
}

function Calibration({ rec, wide, counted, early }: { rec: BookRecord; wide: boolean; counted: number; early: boolean }) {
  const rows = calRows(rec.calibration)
  const note = calNote(rows)
  const pct = (v: number) => Math.round(v * 100)
  return (
    <div className={`vr-rec-card${wide ? ' wide' : ''}`}>
      <h3>
        Said vs happened
        <small>
          <span className="num">{rec.rungs.toLocaleString('en')}</span> rungs
          {rec.ours_score != null && rec.book_score != null && (
            <>
              {' '}
              · scores ours <span className="num">{rec.ours_score.toFixed(3)}</span> · book{' '}
              <span className="num">{rec.book_score.toFixed(3)}</span>
            </>
          )}
        </small>
      </h3>
      <p className="vr-rec-say">
        Each row is a chance bucket. The tick is what the sides said on average; <ShapeOpen /> is how often ours
        happened, <ShapeSolid /> the book's (margin off). On the tick means honest chances.
      </p>
      {rows.length === 0 ? (
        <p className="vr-rec-say">No settled rungs to bucket yet.</p>
      ) : (
        <div className="vr-cal">
          {rows.map((r) => (
            <CalLine key={r.label} row={r} pct={pct} />
          ))}
        </div>
      )}
      {note && <p className="vr-rec-say">{note}</p>}
      {early && (
        <div className="vr-early">
          <span aria-hidden="true">
            {Array.from({ length: EARLY_NIGHTS }, (_, i) => (
              <i key={i} className={i < counted ? '' : 'off'} />
            ))}
          </span>
          Early read · {counted} of {EARLY_NIGHTS} nights
        </div>
      )}
    </div>
  )
}

function CalLine({ row: r, pct }: { row: CalRow; pct: (v: number) => number }) {
  const at = (v: number) => `${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%`
  const label = `${r.label}: said about ${pct(r.said)}%${r.ours ? `, ours happened ${pct(r.ours.happened)}%` : ''}${
    r.book ? `, book happened ${pct(r.book.happened)}%` : ''
  }`
  return (
    <>
      <span className="b num">{r.label}</span>
      <span className="vr-cal-track" role="img" aria-label={label}>
        <i className="rail" />
        <i className="tick" style={{ left: at(r.said) }} />
        {r.ours && (
          <span className="mk o" style={{ left: at(r.ours.happened) }}>
            <ShapeOpen />
          </span>
        )}
        {r.book && (
          <span className="mk b" style={{ left: at(r.book.happened) }}>
            <ShapeSolid />
          </span>
        )}
      </span>
      <span className="p" aria-hidden="true">
        ours <b className="num">{r.ours ? pct(r.ours.happened) : '–'}</b>
        <br />
        book <b className="num">{r.book ? pct(r.book.happened) : '–'}</b>
      </span>
    </>
  )
}

/** The running balance as a line over each night's net as a bar. Bars clip at ±10 with the number
 *  written; the longest run of three or more losing nights is shaded. Pixel units, redrawn on resize. */
function BalanceChart({ ledger, phone }: { ledger: LedgerNight[]; phone: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const H = phone ? 230 : 280
  const CAP = 10
  const padL = phone ? 26 : 34
  const padR = phone ? 44 : 56
  const padT = 34
  const padB = 36
  const bals = ledger.map((n) => n.balance)
  const hi = Math.ceil((Math.max(CAP, ...bals) + 2) / 10) * 10
  const lo = Math.floor((Math.min(-CAP, ...bals) - 2) / 10) * 10
  const iw = W - padL - padR
  const ih = H - padT - padB
  const N = ledger.length
  const x = (i: number) => padL + (iw * (i + 0.5)) / N
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * ih
  const bw = Math.min((iw / N) * 0.46, 26)
  const run = losingRun(ledger)
  const end = bals[bals.length - 1] ?? 0
  const low = Math.min(...bals)
  const lowAt = bals.indexOf(low)
  const clipped = ledger.filter((n) => Math.abs(n.net) > CAP).length
  const label = `Running balance by night, ending at ${unitsText(end)} units, lowest ${unitsText(low)}. Bars are each night's net${
    clipped ? `; ${clipped} beyond ±10 clipped and labelled` : ''
  }.${run ? ` ${run.to - run.from + 1} nights down in a row cost ${unitsText(run.net)}.` : ''}`
  const grid: number[] = []
  for (let v = hi - (hi % 10); v >= lo; v -= 10) grid.push(v)
  const out: ReactNode[] = []
  if (W > 0) {
    grid.forEach((v) =>
      out.push(
        <g key={`g${v}`}>
          <line className={v === 0 ? 'zero' : 'grid'} x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end">
            {v > 0 ? `+${v}` : v === 0 ? '0' : `−${-v}`}
          </text>
        </g>,
      ),
    )
    if (run) {
      const x0 = x(run.from) - iw / N / 2 + 2
      const x1 = x(run.to) + iw / N / 2 - 2
      const n = run.to - run.from + 1
      out.push(<rect key="run" className="run" x={x0} y={padT - 24} width={x1 - x0} height={ih + 24} rx={8} />)
      if (phone)
        out.push(
          <text key="runl" className="lb bad" x={x0 + 6} y={padT - 10}>
            {n} nights down
          </text>,
          <text key="runl2" className="lb bad" x={x0 + 6} y={padT + 5}>
            {unitsText(run.net)}u
          </text>,
        )
      else
        out.push(
          <text key="runl" className="lb bad" x={x0 + 8} y={padT - 8}>
            {n} nights down · {unitsText(run.net)}u
          </text>,
        )
    }
    ledger.forEach((n, i) => {
      const cx = x(i)
      if (n.kind === 'none')
        out.push(
          phone ? (
            <circle key={`m${i}`} className="none" cx={cx} cy={y(0)} r={3} />
          ) : (
            <text key={`m${i}`} className="dy sm" x={cx} y={y(0) - 6} textAnchor="middle">
              no ladders
            </text>
          ),
        )
      else if (n.kind === 'night') {
        const v = Math.max(Math.min(n.net, CAP), -CAP)
        const y1 = y(Math.max(v, 0))
        const y2 = y(Math.min(v, 0))
        out.push(<rect key={`b${i}`} className={n.net >= 0 ? 'up' : 'down'} x={cx - bw / 2} y={y1} width={bw} height={Math.max(y2 - y1, 1)} rx={3} />)
        if (n.net > CAP)
          out.push(
            <path key={`c${i}`} className="cut" d={`M${cx - bw / 2} ${y1 + 6}l${bw / 2} -5 ${bw / 2} 5`} />,
            <text key={`cl${i}`} className="lb" x={cx} y={y1 - 6} textAnchor="middle">
              {unitsText(n.net)} ↑
            </text>,
          )
        else if (n.net < -CAP)
          out.push(
            <path key={`c${i}`} className="cut" d={`M${cx - bw / 2} ${y2 - 6}l${bw / 2} 5 ${bw / 2} -5`} />,
            <text key={`cl${i}`} className="lb" x={cx} y={y2 + 14} textAnchor="middle">
              {unitsText(n.net)} ↓
            </text>,
          )
      } else if (!phone)
        out.push(
          <text key={`m${i}`} className="dy sm" x={cx} y={y(0) - 6} textAnchor="middle">
            0 picks
          </text>,
        )
      const every = phone ? Math.ceil(N / 7) : Math.ceil(N / 16)
      if ((N - 1 - i) % every === 0)
        out.push(
          <text key={`d${i}`} className="dy" x={cx} y={H - 12} textAnchor="middle">
            {phone ? n.label.split(' ').slice(-1)[0] : n.label}
          </text>,
        )
    })
    const pts = bals.map((b, i) => [x(i), y(b)] as const)
    out.push(<path key="line" className="bal" d={`M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}`} />)
    pts.forEach((p, i) => out.push(<circle key={`p${i}`} className="dot" cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4.5 : 3.2} />))
    const last = pts[pts.length - 1]
    out.push(
      <text key="end" className="lb" x={last[0] + bw / 2 + 5} y={last[1] + 4}>
        {unitsText(end)}
      </text>,
    )
    if (lowAt !== pts.length - 1 && low < 0)
      out.push(
        <text key="low" className="lo" x={pts[lowAt][0] + 8} y={pts[lowAt][1] + 14}>
          {unitsText(low)} low
        </text>,
      )
  }
  return (
    <figure className="vr-rec-chart">
      <div ref={ref} className="vr-rec-plot" style={{ height: H }}>
        {W > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
            {out}
          </svg>
        )}
      </div>
      <figcaption className="vr-rec-keys" aria-hidden="true">
        <span>
          <svg width="18" height="10">
            <path d="M1 8 L8 3 L17 6" />
          </svg>
          Balance
        </span>
        <span>
          <i className="up" />
          <i className="down" />
          Night's net
        </span>
        <span>Bars clip at ±10 with the number written</span>
        {phone && ledger.some((n) => n.kind === 'none') && (
          <span>
            <svg width="10" height="10">
              <circle cx="5" cy="5" r="3" />
            </svg>
            No ladders that night
          </span>
        )}
      </figcaption>
    </figure>
  )
}

function ShapeOpen() {
  return (
    <svg className="vr-cal-s o" width="12" height="11" viewBox="0 0 10 9" aria-hidden="true">
      <path d="M1 1h8L5 8z" />
    </svg>
  )
}

function ShapeSolid() {
  return (
    <svg className="vr-cal-s b" width="12" height="11" viewBox="0 0 10 9" aria-hidden="true">
      <path d="M5 0l5 9H0z" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg className="ic-i vr-hi" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 17.5 9 12l4 4 7.5-8" />
      <path d="M15 8h5.5v5.5" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="ic-i vr-ni" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  )
}
