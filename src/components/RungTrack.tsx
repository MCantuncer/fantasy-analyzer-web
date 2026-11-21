import type { CSSProperties, ReactNode } from 'react'
import { MIN_ODD, STAT_NAME, STAT_UNIT, odds } from '../lib/iddaaCompare'
import type { Line } from '../lib/iddaaCompare'
import {
  brier,
  closerCount,
  hadAt,
  ladderNote,
  price,
  rungLabel,
  rungWinner,
  signed2,
} from '../lib/valueRungs'
import './RungTrack.css'

const at = (p: number) => `${(Math.max(0, Math.min(1, p)) * 100).toFixed(2)}%`

/** Ours, the site's open ▽ (Ours is open on this page). */
export function ShapeOurs({ size = 10 }: { size?: number }) {
  return (
    <svg className="vr-so" width={size} height={size * 0.9} viewBox="0 0 10 9" aria-hidden="true">
      <path d="M1 1h8L5 8z" />
    </svg>
  )
}

/** The book, the site's solid ▲. */
export function ShapeBook({ size = 10 }: { size?: number }) {
  return (
    <svg className="vr-sb" width={size} height={size * 0.9} viewBox="0 0 10 9" aria-hidden="true">
      <path d="M5 0l5 9H0z" />
    </svg>
  )
}

/** The price notch track. Our chance is an open bar; the notch marks the price (1 ÷ odds), the chance
 *  the odds need; only the part of our bar past the notch is filled: that sliver is the value. The
 *  book's chance (margin off) is a solid ▲ under the track. */
export function RungTrack({
  ours,
  book,
  odd,
  label,
  small = false,
}: {
  ours: number | null
  book: number
  odd: number
  label?: string
  small?: boolean
}) {
  const p = price(odd)
  const lit = ours == null ? 0 : ours - p
  return (
    <span
      className={`vr-track${small ? ' sm' : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="vr-tk-rail" />
      {ours != null && <span className="vr-tk-ours" style={{ width: `max(${at(ours)}, 6px)` }} />}
      {lit > 0 && <span className="vr-tk-val" style={{ left: at(p), width: `max(${at(lit)}, 4px)` }} />}
      <span className="vr-tk-notch" style={{ left: at(p) } as CSSProperties} />
      <span className="vr-tk-book" style={{ left: at(book) }}>
        <ShapeBook size={small ? 9 : 10} />
      </span>
    </span>
  )
}

/** The opened row's ladder: each rung at its odds on the notch track, ✓/✗ once settled, the value
 *  and whose chance was nearer, with a "Had N" rule where his total fell. */
export function RungLadder({ line: l }: { line: Line }) {
  const rungs = l.rungs.filter((r) => r.odd > MIN_ODD).sort((a, b) => b.n - a.n)
  const settled = rungs.some((r) => r.hit != null)
  const had = settled && l.actual != null ? hadAt(rungs, l.actual) : -1
  const unit = STAT_UNIT[l.stat]
  const rule = (up: boolean) => (
    <tr className="vr-had">
      <td colSpan={settled ? 6 : 4}>
        <span>
          Had {l.actual}
          {up ? ' ↑' : had === rungs.length ? ' ↓' : ''}
        </span>
      </td>
    </tr>
  )
  return (
    <table className="vr-ladder">
      <caption className="sr-only">
        {`${l.name}, ${STAT_NAME[l.stat].toLowerCase()}: the book's rungs with our chance, the book's chance and the price`}
      </caption>
      <thead>
        <tr>
          <th scope="col" className="n">
            Rung
          </th>
          <th scope="col" className="o">
            Odds
          </th>
          <th scope="col" className="t">
            Ours · book <ShapeBook size={8} /> · price |
          </th>
          {settled && (
            <th scope="col" className="mk">
              <span className="sr-only">Landed</span>
            </th>
          )}
          <th scope="col" className="v">
            Value
          </th>
          {settled && (
            <th scope="col" className="cl">
              Nearer
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {had === 0 && rule(true)}
        {rungs.map((r, i) => {
          const w = rungWinner(r)
          return (
            <FragmentRow key={r.n} before={had === i && i > 0 ? rule(false) : null}>
              <tr aria-label={rungLabel(r, unit)}>
                <th scope="row" className="n">
                  {r.n}+
                </th>
                <td className="o">{odds(r.odd)}</td>
                <td className="t">
                  <RungTrack ours={r.ours} book={r.book} odd={r.odd} small />
                </td>
                {settled && (
                  <td className={`mk ${r.hit ? 'ok' : r.hit === false ? 'no' : ''}`}>
                    {r.hit == null ? '' : r.hit ? <Tick /> : <Cross />}
                    <span className="sr-only">{r.hit == null ? '' : r.hit ? 'Landed' : 'Missed'}</span>
                  </td>
                )}
                <td className={`v${(r.value ?? 0) > 0 ? ' up' : ''}`}>{r.value == null ? '–' : signed2(r.value)}</td>
                {settled && (
                  <td className="cl">
                    {w === 'ours' ? <ShapeOurs /> : w === 'book' ? <ShapeBook /> : w === 'tie' ? '=' : ''}
                    <span className="sr-only">{w === 'ours' ? 'Ours nearer' : w === 'book' ? 'Book nearer' : w ? 'Level' : ''}</span>
                  </td>
                )}
              </tr>
            </FragmentRow>
          )
        })}
        {had === rungs.length && rungs.length > 0 && rule(false)}
      </tbody>
    </table>
  )
}

function FragmentRow({ before, children }: { before: ReactNode; children: ReactNode }) {
  return (
    <>
      {before}
      {children}
    </>
  )
}

/** The note beside an opened ladder, written from the row's rungs, with both scores once settled. */
export function RungNote({ line: l }: { line: Line }) {
  const rungs = l.rungs
  const who = l.rungCloser
  const note = ladderNote(rungs, l.game.status === 'final' ? l.actual : null, who)
  const o = brier(rungs, 'ours')
  const b = brier(rungs, 'book')
  const settled = o != null && b != null
  return (
    <div className="vr-note">
      {note.lead && (
        <p>
          <b>{note.lead}</b>
          {note.rest}
        </p>
      )}
      {note.value && <p>{note.value}</p>}
      {!settled && <p>Result, ✓/✗ and who read it better fill in after the game.</p>}
      {settled && (
        <div className="vr-note-figs">
          <div>
            <small>Ours, score</small>
            <b className="num">{o.toFixed(3)}</b>
          </div>
          <div>
            <small>Book, score</small>
            <b className="num">{b.toFixed(3)}</b>
          </div>
          {who && (
            <div>
              <small>Nearer on</small>
              <b>
                {who === 'tie' ? 'Level' : who === 'ours' ? 'Ours' : 'Book'} {closerCount(rungs, who)}
              </b>
            </div>
          )}
        </div>
      )}
      <p className="vr-note-src">
        Written from the row's rungs.{settled ? ' A score is (chance − result)², averaged: lower is better.' : ''}
      </p>
    </div>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 8.6 6.4 11.6 12.8 4.6" />
    </svg>
  )
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 4.2 11.8 11.8" />
      <path d="M11.8 4.2 4.2 11.8" />
    </svg>
  )
}
