import { CaretDown, ChartLineUp } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { couponsOf, fmtOdds } from '../lib/coupons'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { nothingYet, recordCounts, scoredRungs, unitsSigned } from '../lib/ourRecord'
import type { RecordCounts } from '../lib/ourRecord'
import { unitsText } from '../lib/rungRecord'
import { RunningRecord, useRunningRecord } from './RungRecord'
import type { RunningRead } from './RungRecord'
import { RungScorecard } from './RungScorecard'
import './OurRecord.css'

const NO_LINES: Line[] = []

/** Our record (The Slip Rail, Can 2026-11-23): three counts on the bare page. Before the results they
 *  say what is open (bets, Kupons, rungs); as games go final the same three fill in with what
 *  happened. The night's rung scores by stat and the running record (balance, ledger, odds bands,
 *  said vs happened) sit behind one "Running record" row, shown once there is something settled.
 *  Without a night (`data` null) only that row shows, when the record has one. */
export function OurRecord({ data, lines = NO_LINES }: { data: BookCompare | null; lines?: Line[] }) {
  const { q, r, gone } = useRunningRecord(data?.nights)
  const counts = useMemo(() => {
    if (!data || !data.games.length) return null
    const c = recordCounts(data.games, lines, couponsOf(lines))
    return nothingYet(c) ? null : c
  }, [data, lines])
  const scored = useMemo(() => !!data && scoredRungs(data.tally, lines) > 0, [data, lines])
  const [open, setOpen] = useState(false)
  const record = r && r.tot.picks > 0 ? r : null
  const detail = !!record || scored
  const failed = q.isError && !gone
  if (!counts && !detail && !failed) return null
  const games = data?.games ?? []
  const finals = games.filter((g) => g.status === 'final').length
  const settled = games.length > 0 && finals === games.length
  const night = data && r && r.rec.series ? nightNo(r, data.day) : null
  return (
    <section className="ic-rec" aria-labelledby="ic-h-rec">
      <div className="ic-rec-head">
        <h2 id="ic-h-rec">
          <ChartLineUp size={22} aria-hidden="true" />
          Our record
        </h2>
        {counts && (
          <span className="ic-rec-sm">
            {night != null && (
              <>
                Night <b className="num">{night}</b> ·{' '}
              </>
            )}
            {finals === 0 ? (
              'fills in as games go final'
            ) : settled ? (
              'all games final'
            ) : (
              <>
                <b className="num">{finals}</b> of <b className="num">{games.length}</b> games final
              </>
            )}
          </span>
        )}
      </div>
      {counts && <Counts c={counts} />}
      {failed && (
        <p className="ic-rec-err" role="alert">
          Couldn't load the running record.
          <button type="button" onClick={() => void q.refetch()}>
            Try again
          </button>
        </p>
      )}
      {detail && (
        <div className="ic-rec-fold">
          <button
            type="button"
            className="ic-rec-more"
            aria-expanded={open}
            aria-controls="ic-rec-detail"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="ic-rec-mt">
              <b>Running record</b>
              <span>{moreLine(record, scored)}</span>
            </span>
            <CaretDown size={20} aria-hidden="true" />
          </button>
          {open && (
            <div className="ic-rec-detail" id="ic-rec-detail">
              {data && scored && <RungScorecard data={data} lines={lines} settled={settled} />}
              {record && <RunningRecord r={record} day={data?.day ?? null} />}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Which night of the record this is: the nights with ladders before it, plus this one. Null for a
 *  night older than the record reaches. */
function nightNo(r: RunningRead, day: number | null): number | null {
  if (day == null) return null
  const first = r.ledger.find((n) => n.day != null)?.day
  if (first != null && day < first) return null
  return r.ledger.filter((n) => n.kind !== 'none' && n.day != null && n.day < day).length + 1
}

/** The line under "Running record": the balance and the hit count, or the night's scores alone. */
function moreLine(record: RunningRead | null, scored: boolean): string {
  if (record) {
    const { tot } = record
    const since = record.since ? ` since ${record.since}` : ''
    return `${unitsText(tot.net)} units${since} · ${tot.hits} of ${tot.picks} value picks landed`
  }
  return scored ? 'Rung scores by stat, ours against the book' : ''
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function Counts({ c }: { c: RecordCounts }) {
  const { bets, kupons, rungs } = c
  const betsOpen = bets.n - bets.settled
  const kuponsOpen = kupons.n - kupons.settled
  const waiting = rungs.open
  const net = (v: number) => <b className={`num ${v > 0 ? 'good' : v < 0 ? 'bad' : ''}`}>{unitsSigned(v)}</b>
  const picks = `${kupons.picksOpen} ${plural(kupons.picksOpen, 'pick', 'picks')} to settle`
  return (
    <ul className="ic-rec-counts">
      {bets.settled === 0 ? (
        <Count n={bets.n} label={plural(bets.n, 'bet open', 'bets open')}>
          <span className="num">{bets.game}</span> game · <span className="num">{bets.player}</span> player
        </Count>
      ) : (
        <Count n={bets.won} of={bets.settled} label={plural(bets.won, 'bet won', 'bets won')}>
          {net(bets.net)} at 1 a bet
          {betsOpen > 0 && (
            <>
              {' '}
              · <span className="num">{betsOpen}</span> open
            </>
          )}
        </Count>
      )}
      {kupons.settled === 0 ? (
        <Count
          n={kupons.n}
          label={
            <>
              <i>{plural(kupons.n, 'Kupon', 'Kupons')}</i> {kupons.n === 0 ? 'tonight' : 'open'}
            </>
          }
        >
          {kupons.n === 0 ? 'The night couldn’t fill one' : picks}
        </Count>
      ) : (
        <Count
          n={kupons.won}
          of={kupons.n}
          label={
            <>
              <i>{plural(kupons.won, 'Kupon', 'Kupons')}</i> won
            </>
          }
        >
          {kuponsOpen > 0 ? (
            <>
              <span className="num">{kuponsOpen}</span> open · {picks}
            </>
          ) : kupons.paid.length > 0 ? (
            <>
              Paid at <span className="num">{kupons.paid.map(fmtOdds).join(' · ')}</span>
            </>
          ) : (
            'None landed'
          )}
        </Count>
      )}
      {rungs.judged === 0 ? (
        <Count n={rungs.n} label={plural(rungs.n, 'rung waiting', 'rungs waiting')}>
          Ours vs the book, every rung
        </Count>
      ) : (
        <Count n={rungs.ours} of={rungs.judged} label="rungs ours read closer">
          Book <span className="num">{rungs.book.toLocaleString('en')}</span>
          {rungs.level > 0 && (
            <>
              {' '}
              · level <span className="num">{rungs.level.toLocaleString('en')}</span>
            </>
          )}
          {waiting > 0 && (
            <>
              {' '}
              · <span className="num">{waiting.toLocaleString('en')}</span> waiting
            </>
          )}
        </Count>
      )}
    </ul>
  )
}

function Count({ n, of, label, children }: { n: number; of?: number; label: ReactNode; children: ReactNode }) {
  return (
    <li className="ic-rec-count">
      <span className="ic-rec-n">
        <b className="num">{n.toLocaleString('en')}</b>
        {of != null && (
          <span>
            of <span className="num">{of.toLocaleString('en')}</span>
          </span>
        )}
      </span>
      <span className="ic-rec-l">{label}</span>
      <small className="ic-rec-s">{children}</small>
    </li>
  )
}
