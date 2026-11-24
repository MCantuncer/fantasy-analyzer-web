import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { pos } from '../lib/gameStage'
import './GameStage.css'

// The drawn pieces of a game pick (Can 2026-11-24, "of course 'just text' feeling"): a number line
// with the book's line as a tick, our number as a dot and the result as a diamond, and our chance
// as a ring. Shared by the game's bets and its quarter bets.

export interface Mark {
  at: number
  label?: ReactNode
}

type Anchor = 's' | 'm' | 'e'
const anchor = (p: number): Anchor => (p < 14 ? 's' : p > 86 ? 'e' : 'm')

/** Two labels under the line: near each other they lean apart (the left one ends at its mark, the
 *  right one starts at its own), so they never print over each other. */
function under(a: number, b: number | null): [Anchor, Anchor] {
  if (b == null) return [anchor(a), 'm']
  if (Math.abs(a - b) >= 26) return [anchor(a), anchor(b)]
  return a <= b ? ['e', 's'] : ['s', 'e']
}

const GAP = 10

/** Lays the labels out in pixels once the line has a width: each centred on its mark and kept inside
 *  the line; the two under the line pushed apart when they would touch (the result goes above the
 *  line when there is no room below). Without layout (tests) the anchor classes stand. */
function fit(el: HTMLElement) {
  const W = el.clientWidth
  if (!W) return
  const lbs = [...el.querySelectorAll<HTMLElement>('.lb')]
  const place = (l: HTMLElement, x: number) => {
    l.style.left = `${Math.round(x)}px`
    l.style.transform = 'none'
  }
  const want = (l: HTMLElement) => {
    const w = l.offsetWidth
    const x = (Number(l.dataset.at) / 100) * W - w / 2
    return { l, w, x: Math.min(Math.max(0, x), W - w) }
  }
  const up = lbs.filter((l) => l.classList.contains('up')).map(want)
  const dn = lbs.filter((l) => l.classList.contains('dn')).map(want)
  dn.sort((a, b) => a.x - b.x)
  if (dn.length === 2) {
    const [a, b] = dn
    if (a.x + a.w + GAP > b.x) {
      const mid = (a.x + a.w + b.x) / 2
      a.x = mid - GAP / 2 - a.w
      b.x = mid + GAP / 2
      if (a.x < 0) {
        b.x -= a.x
        a.x = 0
      }
      if (b.x + b.w > W) {
        a.x -= b.x + b.w - W
        b.x = W - b.w
      }
      if (a.x < 0) {
        // no room for both below: the result goes up beside the book's label, if it fits there
        const got = [a, b].find((d) => d.l.classList.contains('got-lb'))
        const other = got === a ? b : a
        const g2 = got ? want(got.l) : null
        const clash = g2 && up.some((u) => g2.x < u.x + u.w + GAP && u.x < g2.x + g2.w + GAP)
        if (got && g2 && !clash) {
          got.l.classList.replace('dn', 'up')
          place(got.l, g2.x)
          const o = want(other.l)
          place(other.l, o.x)
          up.forEach((u) => place(u.l, u.x))
          return
        }
        a.x = 0
      }
    }
  }
  for (const d of [...up, ...dn]) place(d.l, d.x)
}

/** A bet on one number line. `book` is the tick (label above), `ours` the dot and `got` the diamond
 *  once played (labels below, the result's in green or coral). `win` shades the side the bet wins on,
 *  from the book's line to the end, or a span (`from`, `to`) for a chance. `small` draws the grid's
 *  mini line, with no labels. */
export function NumLine({
  lo,
  hi,
  book,
  ours,
  got,
  win,
  tc,
  small = false,
}: {
  lo: number
  hi: number
  book?: Mark | null
  ours: Mark
  got?: (Mark & { ok: boolean }) | null
  win?: { from: number; to: number } | null
  tc?: string | null
  small?: boolean
}) {
  const p = (v: number) => pos(v, lo, hi)
  const po = p(ours.at)
  const pg = got ? p(got.at) : null
  const [ao, ag] = under(po, pg)
  const shade = win ? [p(Math.min(win.from, win.to)), p(Math.max(win.from, win.to))] : null
  const style = (tc ? { '--tc': tc } : {}) as CSSProperties
  const right = win != null && win.to >= win.from
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || small) return
    el.querySelectorAll('.got-lb.up').forEach((l) => l.classList.replace('up', 'dn'))
    fit(el)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      el.querySelectorAll('.got-lb.up').forEach((l) => l.classList.replace('up', 'dn'))
      fit(el)
    })
    ro.observe(el)
    return () => ro.disconnect()
  })
  return (
    <span ref={ref} className={small ? 'ic-gs-qline' : 'ic-gs-line'} style={style} aria-hidden="true">
      <i className="ax" />
      {shade && (
        <i
          className={`side${tc ? ` tc${right ? '' : ' r'}` : ''}`}
          style={{ left: `${shade[0]}%`, width: `${Math.max(0, shade[1] - shade[0])}%` }}
        />
      )}
      {book && <i className="bk" style={{ left: `${p(book.at)}%` }} />}
      {got && (
        <i className="got" style={{ left: `${pg}%`, '--rc': got.ok ? 'var(--good)' : 'var(--bad)' } as CSSProperties} />
      )}
      <i className="ou" style={{ left: `${po}%` }} />
      {!small && book?.label != null && (
        <span className={`lb up a-${anchor(p(book.at))}`} data-at={p(book.at)} style={{ left: `${p(book.at)}%` }}>
          {book.label}
        </span>
      )}
      {!small && ours.label != null && (
        <span className={`lb dn a-${ao}`} data-at={po} style={{ left: `${po}%` }}>
          {ours.label}
        </span>
      )}
      {!small && got?.label != null && (
        <span
          className={`lb dn got-lb a-${ag}`}
          data-at={pg ?? 50}
          style={{ left: `${pg}%`, '--rc': got.ok ? 'var(--good)' : 'var(--bad)' } as CSSProperties}
        >
          {got.label}
        </span>
      )}
    </span>
  )
}

const R = 22
const C = 2 * Math.PI * R

/** Our chance as a ring: the arc is the chance, the number in the middle. With `need` a notch marks
 *  the chance the price needs to break even, so an edge is the arc running past the notch. */
export function Ring({ value, need, mini = false }: { value: number; need?: number | null; mini?: boolean }) {
  const v = Math.min(1, Math.max(0, value))
  const pct = Math.round(v * 100)
  if (mini) {
    const r = 6
    const c = 2 * Math.PI * r
    return (
      <svg className="ic-gs-mring" viewBox="0 0 16 16" aria-hidden="true">
        <circle className="t" cx="8" cy="8" r={r} fill="none" strokeWidth="2.5" />
        <circle
          className="a"
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeDasharray={`${v * c} ${c}`}
          transform="rotate(-90 8 8)"
        />
      </svg>
    )
  }
  const n = need != null ? Math.min(1, Math.max(0, need)) * 2 * Math.PI - Math.PI / 2 : null
  return (
    <span className={`ic-gs-ring${need != null && v > need ? ' edge' : ''}`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="t" cx="26" cy="26" r={R} fill="none" strokeWidth="4" />
        <circle
          className="a"
          cx="26"
          cy="26"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${v * C} ${C}`}
          transform="rotate(-90 26 26)"
        />
        {n != null && (
          <line
            className="n"
            x1={26 + (R - 6) * Math.cos(n)}
            y1={26 + (R - 6) * Math.sin(n)}
            x2={26 + (R + 5) * Math.cos(n)}
            y2={26 + (R + 5) * Math.sin(n)}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="sr-only">Our chance </span>
      <b className="num">
        {pct}
        <small>%</small>
      </b>
    </span>
  )
}
