import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { PregameBox } from '../api/client'
import { teamLight } from '../lib/nbaTeams'
import { place, type Side } from '../lib/pregame'
import {
  HALF_WITHIN,
  LEAN_WORDS,
  MOST_WITHIN,
  PILL,
  QUARTERS,
  habitLine,
  habitSource,
  leanLabel,
  leanOf,
  leanSize,
  leaningSide,
  pieces,
  plain,
  quarterHeadline,
  quarterSentence,
  r1,
  roleLine,
  signed,
  sum,
} from '../lib/quarters'
import './QuarterStave.css'

// "Stave" (Can, 2026-11-23): the game written out in four bars. Each team has a lane; in each bar its
// quarter number sits in the call's outline type at its true height, joined by one thread, over one flat
// club shade of our number ±4 points (half of quarters land there). Same scale for every game, so a flat
// night looks flat. The pieces sit behind "How we got the quarters".

const SIDES = ['away', 'home'] as const
const DRAWN = 'qtr-drawn'

function firstDraw(gameId: number): boolean {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const seen = new Set<number>(JSON.parse(sessionStorage.getItem(DRAWN) || '[]'))
    if (seen.has(gameId)) return false
    seen.add(gameId)
    sessionStorage.setItem(DRAWN, JSON.stringify([...seen].slice(-40)))
  } catch {
    // Storage blocked: draw anyway, nothing to remember.
  }
  return true
}

/** A Catmull-Rom curve through the points, as cubic Béziers. */
function smooth(pts: [number, number][]): string {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

const mean = (xs: number[]) => sum(xs) / xs.length

export function QuarterStave({ b }: { b: PregameBox }) {
  const ref = useRef<HTMLElement>(null)
  const [draw] = useState(() => firstDraw(b.game_id))
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<Side>(() => leaningSide(b))

  // The shade and the thread come from the laid-out cells: each lane's svg reads its four cells' centres.
  useLayoutEffect(() => {
    const sec = ref.current
    if (!sec) return
    const paint = () => {
      const cs = getComputedStyle(sec)
      const s = parseFloat(cs.getPropertyValue('--s')) || 6
      const nH = parseFloat(cs.getPropertyValue('--n')) || 40
      const minLane = parseFloat(cs.getPropertyValue('--lane')) || 108
      SIDES.forEach((key, li) => {
        const q = b[key].quarters!
        const m = mean(q.raw)
        // A lane is as tall as its numbers and its shade need, never shorter than --lane.
        const ext = Math.max(...q.raw.map((r) => Math.max(Math.abs(r - m) * s + HALF_WITHIN * s, Math.abs(r - m) * s + nH / 2)))
        sec.style.setProperty(li ? '--lane-b' : '--lane-a', `${Math.max(minLane, Math.ceil(2 * ext + 12))}px`)
      })
      SIDES.forEach((key) => {
        const lane = key === 'away' ? 'a' : 'b'
        const svg = sec.querySelector<SVGSVGElement>(`.qtr-svg[data-lane='${lane}']`)
        if (!svg) return
        const q = b[key].quarters!
        const m = mean(q.raw)
        const R = svg.getBoundingClientRect()
        const W = R.width
        const H = R.height
        if (!W || !H) return
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
        const cells = [0, 1, 2, 3].map((i) =>
          sec.querySelector<HTMLElement>(`.qtr-cell[data-lane='${lane}'][data-q='${i}']`)!.getBoundingClientRect(),
        )
        const xs = cells.map((c) => c.left - R.left + c.width / 2)
        const cy = H / 2
        const ys = q.raw.map((r) => cy - (r - m) * s)
        const x0 = cells[0].left - R.left + 2
        const x3 = cells[3].right - R.left - 2
        const band = HALF_WITHIN * s
        const top: [number, number][] = [[x0, ys[0] - band], ...xs.map((x, i): [number, number] => [x, ys[i] - band]), [x3, ys[3] - band]]
        const bot: [number, number][] = [[x3, ys[3] + band], ...xs.map((x, i): [number, number] => [x, ys[i] + band]).reverse(), [x0, ys[0] + band]]
        const shade = `${smooth(top)} L${smooth(bot).slice(1)} Z`
        // Holes around every number, so the thread never crosses a digit (layout boxes: the rise is a transform).
        const holes = [...sec.querySelectorAll<HTMLElement>(`.qtr-cell[data-lane='${lane}'] .qtr-n`)]
          .map((el) => {
            const cell = el.parentElement!.getBoundingClientRect()
            const w = el.offsetWidth + 12
            const h = el.offsetHeight + 4
            const cx = cell.left - R.left + cell.width / 2
            const y = cell.top - R.top + el.offsetTop - el.offsetHeight / 2 - 2
            return `<rect x="${(cx - w / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="#000"/>`
          })
          .join('')
        const thread = smooth(xs.map((x, i): [number, number] => [x, ys[i]]))
        const id = `qtr-${b.game_id}-${lane}`
        svg.innerHTML =
          `<defs><linearGradient id="${id}-g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>` +
          `<stop offset=".035" stop-color="#fff"/><stop offset=".965" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
          `<mask id="${id}-f" maskUnits="userSpaceOnUse" x="0" y="${-H}" width="${W}" height="${3 * H}"><rect x="0" y="${-H}" width="${W}" height="${3 * H}" fill="url(#${id}-g)"/></mask>` +
          `<mask id="${id}-h" maskUnits="userSpaceOnUse" x="0" y="${-H}" width="${W}" height="${3 * H}"><rect x="0" y="${-H}" width="${W}" height="${3 * H}" fill="#fff"/>${holes}</mask></defs>` +
          `<g mask="url(#${id}-f)"><path class="qtr-shade" d="${shade}"/><g mask="url(#${id}-h)"><path class="qtr-thread" pathLength="1" d="${thread}"/></g></g>`
      })
    }
    paint()
    const ro = new ResizeObserver(() => paint())
    ro.observe(sec)
    let gone = false
    document.fonts?.ready.then(() => {
      if (!gone) paint()
    })
    return () => {
      gone = true
      ro.disconnect()
    }
  }, [b])

  if (!b.away.quarters || !b.home.quarters) return null
  const other: Side = side === 'away' ? 'home' : 'away'
  const shown = b[side]
  const pc = pieces(shown.quarters!)
  const club = (s: Side) => ({ '--c': teamLight(b[s].abbrev) ?? 'var(--text-2)' }) as CSSProperties

  return (
    <section ref={ref} className={`qtr${draw ? ' draw' : ''}`} aria-labelledby={`qtr-title-${b.game_id}`}>
      <div className="qtr-head">
        <h3 id={`qtr-title-${b.game_id}`}>Quarter by quarter</h3>
        <p className="qtr-hl">{quarterHeadline(b)}</p>
      </div>
      <p className="sr-only">{quarterSentence(b)}</p>
      <div className="qtr-grid" aria-hidden="true">
        {QUARTERS.map((_, i) => (
          <span key={`s${i}`} className="qtr-stall full" data-q={i} />
        ))}
        {QUARTERS.map((_, i) => (
          <span key={`a${i}`} className="qtr-stall pa" data-q={i} />
        ))}
        {QUARTERS.map((_, i) => (
          <span key={`b${i}`} className="qtr-stall pb" data-q={i} />
        ))}
        <span className="qtr-stall full g" data-q="g" />
        {QUARTERS.map((q, i) => (
          <span key={q} className="qtr-qh" data-q={i}>
            {q}
          </span>
        ))}
        <span className="qtr-qh" data-q="g">
          Game
        </span>
        {SIDES.map((s) => {
          const lane = s === 'away' ? 'a' : 'b'
          const q = b[s].quarters!
          const l = leanOf(q)
          const size = leanSize(l)
          const m = mean(q.raw)
          const total = sum(q.points)
          return [
            <div key={`lab-${s}`} className="qtr-lab" data-lane={lane} style={club(s)}>
              <span className="qtr-city">{place(b[s])}</span>
              <span className={`qtr-lean${l.even ? ' even' : ''}`}>{leanLabel(l)}</span>
              <span className="qtr-size">
                {size.lead}
                {size.num && <span className="num">{size.num}</span>}
                {size.tail}
              </span>
            </div>,
            <svg key={`svg-${s}`} className="qtr-svg" data-lane={lane} style={club(s)} />,
            ...q.points.map((p, i) => (
              <div key={`${s}${i}`} className="qtr-cell" data-lane={lane} data-q={i} style={club(s)}>
                <span
                  className={`qtr-n${r1(l.quarters[i]) >= LEAN_WORDS ? ' fill' : ''}`}
                  style={{ '--i': i, '--y': `calc(${(-(q.raw[i] - m)).toFixed(2)}px * var(--s))` } as CSSProperties}
                >
                  {p}
                </span>
              </div>
            )),
            <div key={`g-${s}`} className="qtr-cell qtr-game" data-lane={lane} data-q="g">
              <span className="n num">{b[s].call}</span>
              <span className="s">
                {total < b[s].call ? (
                  <>
                    <span className="num">{total}</span> + <span className="num">{b[s].call - total}</span> for overtime
                  </>
                ) : (
                  'Quarters add up'
                )}
              </span>
            </div>,
          ]
        })}
      </div>
      <SumLine b={b} />
      <p className="qtr-honest">
        <span className="qtr-key" aria-hidden="true" />
        <span>
          Half of quarters land in the shade, within <span className="num">{HALF_WITHIN}</span> points of our number;{' '}
          <span className="num">8</span> in <span className="num">10</span> within{' '}
          <span className="num">{MOST_WITHIN}</span>. Who wins a quarter is close to a coin toss: our numbers get it{' '}
          <span className="num">57</span> times in 100 (first half <span className="num">62</span>, game{' '}
          <span className="num">66</span>).
        </span>
      </p>
      <div className="qtr-how">
        <button
          type="button"
          className="qtr-how-btn"
          aria-expanded={open}
          aria-controls={`qtr-pieces-${b.game_id}`}
          onClick={() => setOpen((o) => !o)}
        >
          How we got the quarters
          <svg className="qtr-chev" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hint">League split, favourite or underdog, own habit</span>
        </button>
        <div className={`qtr-disc${open ? ' open' : ''}`} id={`qtr-pieces-${b.game_id}`}>
          <div>
            <div className="qtr-disc-in">
              <div className="qtr-teams" role="group" aria-label="Team">
                {SIDES.map((s) => (
                  <button key={s} type="button" aria-pressed={s === side} onClick={() => setSide(s)} style={club(s)}>
                    {place(b[s])}
                  </button>
                ))}
              </div>
              <div
                className="qtr-pt"
                role="table"
                style={club(side)}
                aria-label={`How ${place(shown)}'s quarters are built`}
              >
                <div className="qtr-pr hd" role="row">
                  <div className="qtr-pl" role="columnheader">
                    <span className="sr-only">Piece</span>
                  </div>
                  {QUARTERS.map((q) => (
                    <div key={q} className="qtr-pv" role="columnheader">
                      {q}
                    </div>
                  ))}
                  <div className="qtr-pv gm" role="columnheader">
                    Game
                  </div>
                </div>
                <PieceRow
                  label="League split"
                  note={`Our ${shown.call} for ${place(shown)}, split the way the league scores.`}
                  values={pc.map((p) => p.league)}
                  show={plain}
                />
                <PieceRow
                  label="Favourite or underdog"
                  note={roleLine(b, side)}
                  values={pc.map((p) => p.favourite)}
                  show={signed}
                  pills
                />
                <PieceRow
                  label="Own habit"
                  note={habitLine(shown, b[other])}
                  values={pc.map((p) => p.habit)}
                  show={signed}
                  pills
                />
                <div className="qtr-pr tot" role="row">
                  <div className="qtr-pl" role="rowheader">
                    <b>Our number</b>
                  </div>
                  {pc.map((p, i) => (
                    <div key={i} className="qtr-pv" role="cell">
                      <span>{p.raw.toFixed(1)}</span>
                      <span className="to" aria-hidden="true">
                        →
                      </span>
                      <span className="sr-only"> rounds to </span>
                      <b>{p.points}</b>
                    </div>
                  ))}
                  <div className="qtr-pv gm" role="cell">
                    <b>{sum(pc.map((p) => p.points))}</b>
                  </div>
                </div>
              </div>
              <p className="qtr-pnote">
                Habits carry over only a little, so we use them lightly. {habitSource(shown.quarters!.games)} Every
                team scores about a point less in the 4th, and the last point or so of a call is overtime’s share.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PieceRow({
  label,
  note,
  values,
  show,
  pills = false,
}: {
  label: string
  note: string
  values: number[]
  show: (x: number) => string
  pills?: boolean
}) {
  return (
    <div className="qtr-pr" role="row">
      <div className="qtr-pl" role="rowheader">
        <b>{label}</b>
        <span>{note}</span>
      </div>
      {values.map((v, i) => (
        <div key={i} className={`qtr-pv${Math.abs(v) < 0.05 ? ' z' : ''}`} role="cell">
          {pills && Math.abs(v) >= PILL ? <span className={`qtr-pill ${v > 0 ? 'up' : 'dn'}`}>{show(v)}</span> : show(v)}
        </div>
      ))}
      <div className="qtr-pv gm" role="cell">
        {show(r1(sum(values)))}
      </div>
    </div>
  )
}

/** Phones have no Game column: say what the quarters add up to under the lanes. */
function SumLine({ b }: { b: PregameBox }) {
  const [a, h] = SIDES.map((s) => sum(b[s].quarters!.points))
  if (a === b.away.call && h === b.home.call)
    return (
      <p className="qtr-sum">
        Quarters add up to our <span className="num">{b.away.call}</span> and{' '}
        <span className="num">{b.home.call}</span>.
      </p>
    )
  return (
    <p className="qtr-sum">
      Quarters make <span className="num">{a}</span> and <span className="num">{h}</span> of our{' '}
      <span className="num">{b.away.call}</span> and <span className="num">{b.home.call}</span>; the rest is
      overtime’s share.
    </p>
  )
}
