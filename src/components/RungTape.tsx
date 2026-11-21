import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { loadChoice, rungName, saveChoice, signed2, tapeBands, typical } from '../lib/valueRungs'
import type { TapeItem } from '../lib/valueRungs'

const TOP = 0.5 // the Tape's value scale: +0.5 at the top, −1 (our chance 0) at the bottom
const BOTTOM = -1
const SEEN = 'vr-tape-seen'
const CHOICE = 'vr-tape'

/** Whether this viewer saw the Tape on an earlier visit: read once per page load, so switching
 *  nights in this visit keeps it open. */
let seen: boolean | null = null
function seenBefore(): boolean {
  if (seen == null) seen = loadChoice(SEEN, ['1'] as const) != null
  return seen
}

/** The Tape: every rung the night priced, in odds order, hanging below the break-even seam, each
 *  band's average drawn across it. The few that beat their price rise into the warm light above,
 *  each capped with a notch. One SVG in pixel units, redrawn when its width changes, so ticks stay
 *  crisp. After a viewer's first visit it folds to one line (remembered in this browser). */
export function RungTape({ items, phone }: { items: TapeItem[]; phone: boolean }) {
  const [open, setOpen] = useState(() => {
    const c = loadChoice(CHOICE, ['open', 'shut'] as const)
    return c ? c === 'open' : !seenBefore()
  })
  useEffect(() => {
    seenBefore()
    saveChoice(SEEN, '1')
  }, [])
  const picks = items.filter((i) => i.pick).length
  const typ = typical(items) ?? 0
  const total = items.length.toLocaleString('en')
  const toggle = () => {
    saveChoice(CHOICE, open ? 'shut' : 'open')
    setOpen(!open)
  }
  if (!open)
    return (
      <div className="vr-tape-line">
        <span>
          <b>The tape</b> · <span className="num">{picks}</span> of <span className="num">{total}</span> beat their
          price · typical <span className="num">{signed2(typ)}</span>
        </span>
        <button type="button" className="vr-link" aria-expanded={false} onClick={toggle}>
          Show the tape
        </button>
      </div>
    )
  return (
    <figure className="vr-tape">
      <figcaption className="vr-tape-h">
        <b>
          The tape · <span className="vr-hide-s">all </span>
          <span className="num">{total}</span> rungs<span className="vr-hide-s">, shortest odds on the left</span>
          <span className="vr-ph-in"> by odds</span>
        </b>
        <span className="vr-hide-s vr-tape-say">Above the line the odds pay more than our chance needs</span>
        <button type="button" className="vr-link" aria-expanded onClick={toggle}>
          Fold
        </button>
      </figcaption>
      <TapePlot items={items} phone={phone} />
      <div className="vr-keys" aria-hidden="true">
        <span>
          <i className="k-val" />
          Beat its price
        </span>
        <span>
          <i className="k-tick" />
          Every other rung
        </span>
        <span>
          <i className="k-avg" />
          Band average
        </span>
        <span>
          <i className="k-house" />
          Above break-even
        </span>
      </div>
    </figure>
  )
}

function TapePlot({ items, phone }: { items: TapeItem[]; phone: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const H = phone ? 70 : 150
  const y = (v: number) => ((TOP - Math.max(BOTTOM, Math.min(TOP, v))) / (TOP - BOTTOM)) * H
  const y0 = y(0)
  const bands = tapeBands(items)
  const picks = items.filter((i) => i.pick)
  const label = `${items.length.toLocaleString('en')} rungs ordered by odds. ${picks.length} rise above break-even${
    bands.length
      ? `; band averages run from ${signed2(bands[0].avg)} at the shortest odds to ${signed2(bands[bands.length - 1].avg)} at the longest`
      : ''
  }.`

  const ticks: ReactNode[] = []
  const finds: { cx: number; it: TapeItem }[] = []
  const marks: ReactNode[] = []
  let x = 0
  if (w > 0) {
    for (const b of bands) {
      const bw = w * b.share
      const step = bw / b.items.length
      const tw = Math.max(Math.min(step * 0.62, 2.2), 0.45)
      b.items.forEach((it, i) => {
        const cx = x + i * step + step / 2
        if (it.pick) finds.push({ cx, it })
        else
          ticks.push(
            <rect key={`t${b.name}${i}`} className="t" x={cx - tw / 2} y={y0} width={tw} height={Math.max(0.5, y(it.value) - y0)} />,
          )
      })
      marks.push(<rect key={`a${b.name}`} className="avg" x={x + 3} y={y(b.avg) - 1} width={Math.max(0, bw - 6)} height={2.2} rx={1} />)
      if (x > 0) marks.push(<line key={`s${b.name}`} className="seam" x1={x} x2={x} y1={y0} y2={H} />)
      x += bw
    }
  }
  const fw = phone ? 2.4 : 3
  const top = [...finds].sort((a, b) => (b.it.pick?.value ?? 0) - (a.it.pick?.value ?? 0)).slice(0, phone ? 1 : 2)
  return (
    <div className="vr-tape-wrap">
      <div className="vr-tape-plot" ref={ref} style={{ height: H }}>
        {w > 0 && (
          <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-label={label}>
            <rect className="house" x={0} y={0} width={w} height={y0} />
            {ticks}
            {marks}
            {finds.map(({ cx, it }, i) => (
              <g key={`f${i}`} className="val">
                <rect x={cx - fw / 2} y={y(it.value)} width={fw} height={y0 - y(it.value)} />
                <rect x={cx - 4} y={y(it.value) - 1} width={8} height={2} />
              </g>
            ))}
            <rect className="zero" x={0} y={y0 - 1} width={w} height={2} />
          </svg>
        )}
        {w > 0 && (
          <span className="vr-tape-zero" style={{ top: y0 + 3 }} aria-hidden="true">
            0 · break-even
          </span>
        )}
        {w > 0 &&
          top.map(({ cx, it }) => {
            const p = it.pick
            if (!p) return null
            const side = cx > w * 0.8 ? ' r' : cx < w * 0.2 ? ' l' : ''
            return (
              <span
                key={`${p.line.id}-${p.rung.n}`}
                className={`vr-tape-lab${side}`}
                style={{ left: cx, top: Math.max(y(it.value) - 22, -6) }}
                aria-hidden="true"
              >
                {p.line.name.split(' ').slice(-1)[0]} {rungName(p.line.stat, p.rung.n)} · {signed2(p.value)}
              </span>
            )
          })}
      </div>
      <div className="vr-bands" aria-hidden="true">
        {(() => {
          let at = 0
          return bands.map((b, i) => {
            const left = at
            at += b.share
            return (
              <div
                key={b.name}
                className="vr-band"
                style={{ left: `${(left * 100).toFixed(2)}%`, width: `${(b.share * 100).toFixed(2)}%` }}
              >
                <b>{b.name}</b>
                <span>
                  {phone || i > 0 ? '' : 'avg '}
                  {signed2(b.avg)}
                </span>
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
