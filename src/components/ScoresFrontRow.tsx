import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { FR_EASE_CLOSE, FR_EASE_OPEN, FR_MS, holdAt, reducedMotion } from '../lib/frontRow'
import './ScoresFrontRow.css'

/**
 * Front Row (Can, 2026-11-15/16): the game you open comes forward (a little bigger, the rest blur) and
 * becomes the tab of its box score, which opens right under the game's row and pushes the rows below
 * down. The page never moves you. This file holds the box's slot in the grid, the slot an old box
 * leaves behind while it folds, and the small join that ties the tab to the box.
 */

/** What the next layout change should look like, written by the click and read once by the slot. */
export interface FrontRowIntent {
  kind: 'open' | 'hop' | 'close'
  /** The element to keep still on screen, and where it was before the layout changed. */
  anchor: () => Element | null
  y0: number
  /** Where the anchor should end (closing from the pinned bar brings the card back into view). */
  y1?: number
  /** The box's height before a hop, to grow or shrink from. */
  h0?: number
  /** Keyboard opens move focus into the box; arrow hops keep it on the arrow. */
  focus?: 'title' | 'next' | 'prev' | null
}

export function BoxSlot({
  gameId,
  card,
  colours,
  strip,
  closing,
  onClosed,
  intent,
  children,
}: {
  gameId: number
  /** The open game's card (the tab). */
  card: () => HTMLElement | null
  /** Away and home club lights, for the tab's edge. */
  colours: [string, string]
  /** On phones, the swipe strip the tab lives in. */
  strip: RefObject<HTMLElement | null> | null
  closing: boolean
  onClosed: () => void
  intent: RefObject<FrontRowIntent | null>
  children: ReactNode
}) {
  const slot = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  // The title line pins under the site's top bar, whatever its height on this screen.
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar')
    const s = slot.current
    if (!bar || !s) return
    const set = () => s.style.setProperty('--sc-top', `${bar.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  // Opening, hopping to another game: one height movement, the content fades in behind it.
  useLayoutEffect(() => {
    const it = intent.current
    if (!it || it.kind === 'close') return
    intent.current = null
    const p = panel.current!
    const s = slot.current!
    const rm = reducedMotion()
    const H = p.offsetHeight
    const anims: Animation[] = []
    if (!rm) {
      const from = it.kind === 'hop' && it.h0 != null ? it.h0 : 0
      if (Math.abs(from - H) > 1) {
        p.classList.add('moving')
        anims.push(
          p.animate([{ height: `${from}px` }, { height: `${H}px` }], { duration: FR_MS.open, easing: FR_EASE_OPEN }),
        )
      }
      if (it.kind === 'open') {
        const gap = getComputedStyle(s).marginBottom
        anims.push(s.animate([{ marginBottom: '0px' }, { marginBottom: gap }], { duration: FR_MS.open, easing: FR_EASE_OPEN }))
      }
      inner.current?.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], {
        duration: FR_MS.fadeIn,
        delay: FR_MS.fadeDelay,
        easing: FR_EASE_OPEN,
        fill: 'backwards',
      })
    } else {
      inner.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160 })
    }
    holdAt(it.anchor, it.y0, rm ? 0 : FR_MS.open)
    Promise.all(anims.map((a) => a.finished))
      .catch(() => {})
      .finally(() => p.classList.remove('moving'))
    const f = it.focus
    if (f === 'title') document.getElementById('box-title')?.focus({ preventScroll: true })
    else if (f)
      (
        inner.current?.querySelector<HTMLButtonElement>(`[data-hop='${f}']:not(:disabled)`) ??
        document.getElementById('box-title')
      )?.focus({ preventScroll: true })
    // gameId: a new game in this slot is a hop.
  }, [gameId, intent])

  // Closing: the box folds up into its card, then it's gone.
  useLayoutEffect(() => {
    if (!closing) return
    const it = intent.current?.kind === 'close' ? intent.current : null
    intent.current = null
    const p = panel.current!
    const s = slot.current!
    if (reducedMotion()) {
      onClosed()
      if (it) holdAt(it.anchor, it.y1 ?? it.y0, 0)
      return
    }
    const H = p.offsetHeight
    const gap = getComputedStyle(s).marginBottom
    p.classList.add('moving')
    inner.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' })
    s.animate([{ marginBottom: gap }, { marginBottom: '0px' }], {
      duration: FR_MS.close,
      easing: FR_EASE_CLOSE,
      fill: 'forwards',
    })
    const a = p.animate([{ height: `${H}px` }, { height: '0px', borderBottomWidth: '0px' }], {
      duration: FR_MS.close,
      easing: FR_EASE_CLOSE,
      fill: 'forwards',
    })
    if (it) holdAt(it.anchor, it.y0, FR_MS.close, it.y1)
    let live = true
    a.finished.then(() => live && onClosed()).catch(() => {})
    return () => {
      live = false
    }
  }, [closing, intent, onClosed])

  return (
    <section
      ref={slot}
      className={`sc-slot${closing ? ' closing' : ''}`}
      id={closing ? undefined : 'box'}
      aria-labelledby={closing ? undefined : 'box-title'}
      inert={closing || undefined}
    >
      <div ref={panel} className="sc-panel">
        <div ref={inner} className="sc-panel-in" key={gameId}>
          {children}
        </div>
      </div>
      <TabJoin slot={slot} panel={panel} card={card} colours={colours} strip={strip} gameId={gameId} hidden={closing} />
    </section>
  )
}

/** Where an open box was, folding shut while the next one opens under another row (one movement). */
export function BoxGhost({ height, onDone }: { height: number; onDone: () => void }) {
  const slot = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const s = slot.current!
    const gap = getComputedStyle(s).marginBottom
    s.animate([{ marginBottom: gap }, { marginBottom: '0px' }], {
      duration: FR_MS.open,
      easing: FR_EASE_OPEN,
      fill: 'forwards',
    })
    const a = panel.current!.animate([{ height: `${height}px` }, { height: '0px', borderBottomWidth: '0px' }], {
      duration: FR_MS.open,
      easing: FR_EASE_OPEN,
      fill: 'forwards',
    })
    let live = true
    a.finished.then(() => live && onDone()).catch(() => {})
    return () => {
      live = false
    }
  }, [height, onDone])
  return (
    <div ref={slot} className="sc-slot sc-ghost" aria-hidden="true">
      <div ref={panel} className="sc-panel moving" style={{ height }} />
    </div>
  )
}

/**
 * The join between the tab (the open card) and the box: the card's two-club edge runs down a short
 * bridge and curls into the box's top edge, where it fades into the box's own border. A small SVG,
 * drawn when the layout changes (never per frame). On phones it lets go while the strip moves and
 * forms again when the strip stops. A card flush with the box's side gets a square corner there.
 */
function TabJoin({
  slot,
  panel,
  card,
  colours,
  strip,
  gameId,
  hidden,
}: {
  slot: RefObject<HTMLElement | null>
  panel: RefObject<HTMLDivElement | null>
  card: () => HTMLElement | null
  colours: [string, string]
  strip: RefObject<HTMLElement | null> | null
  gameId: number
  hidden: boolean
}) {
  const id = useId().replace(/:/g, '')
  const svg = useRef<SVGSVGElement>(null)
  const move = useRef<SVGGElement>(null)
  const fill = useRef<SVGPathElement>(null)
  const left = useRef<SVGPathElement>(null)
  const right = useRef<SVGPathElement>(null)
  const gl = useRef<SVGLinearGradientElement>(null)
  const gr = useRef<SVGLinearGradientElement>(null)
  const lastX = useRef<number | null>(null)
  const draw = useRef<(slide?: boolean) => void>(() => {})

  draw.current = (slide = false) => {
    const s = slot.current
    const c = card()
    const p = panel.current
    const el = svg.current
    if (!s || !c || !p || !el) return
    const sr = s.getBoundingClientRect()
    const cr = c.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(s).getPropertyValue('--sc-gap')) || 12
    // The tab's final box: the card is scaled around its transform origin and may be mid-transition.
    const cs = getComputedStyle(c)
    const W0 = c.offsetWidth
    const m = /^matrix\(([^,]+)/.exec(cs.transform)
    const now = m ? parseFloat(m[1]) : 1
    const end = c.classList.contains('is-tab') ? parseFloat(cs.getPropertyValue('--sc-tab-scale')) || 1 : 1
    const ox = W0 ? parseFloat(cs.transformOrigin) / W0 || 0 : 0
    const L = cr.left - ox * W0 * (1 - now) - sr.left
    const x0 = L + ox * W0 * (1 - end)
    const x1 = x0 + W0 * end
    const W = sr.width
    if (x0 < -1 || x1 > W + 1 || cr.bottom > sr.top + 4) {
      // Not over the box (a phone strip swiped away): let go, plain rounded top.
      el.classList.add('let-go')
      p.style.setProperty('--rl', 'var(--radius)')
      p.style.setProperty('--rr', 'var(--radius)')
      lastX.current = null
      return
    }
    const f = 10
    const ext = 18
    const yb = gap + 0.5
    const xl = x0 + 0.75
    const xr = x1 - 0.75
    const fl = x0 < 2
    const fr = x1 > W - 2
    let d = `M${x0} -1`
    d += fl ? `V${gap + 2.2}` : `V${yb - f}A${f} ${f} 0 0 1 ${x0 - f} ${yb}V${gap + 2.2}`
    d += fr ? `H${x1}V-1Z` : `H${x1 + f}V${yb}A${f} ${f} 0 0 1 ${x1} ${yb - f}V-1Z`
    const dl = fl ? `M${xl} -1V${gap + 34}` : `M${xl} -1V${yb - f}A${f} ${f} 0 0 1 ${xl - f} ${yb}H${xl - f - ext}`
    const dr = fr ? `M${xr} -1V${gap + 34}` : `M${xr} -1V${yb - f}A${f} ${f} 0 0 0 ${xr + f} ${yb}H${xr + f + ext}`
    fill.current!.setAttribute('d', d)
    left.current!.setAttribute('d', dl)
    right.current!.setAttribute('d', dr)
    const grad = (g: SVGLinearGradientElement, xa: number, xb: number, yB: number) => {
      g.setAttribute('x1', String(xa))
      g.setAttribute('y1', '0')
      g.setAttribute('x2', String(xb))
      g.setAttribute('y2', String(yB))
    }
    grad(gl.current!, xl, fl ? xl : xl - f - ext, fl ? gap + 34 : yb)
    grad(gr.current!, xr, fr ? xr : xr + f + ext, fr ? gap + 34 : yb)
    p.style.setProperty('--rl', fl ? '0px' : 'var(--radius)')
    p.style.setProperty('--rr', fr ? '0px' : 'var(--radius)')
    el.classList.remove('let-go')
    const before = lastX.current
    lastX.current = x0
    if (slide && before != null && Math.abs(before - x0) > 0.5 && !reducedMotion())
      move.current?.animate([{ transform: `translateX(${before - x0}px)` }, { transform: 'none' }], {
        duration: FR_MS.hop,
        easing: FR_EASE_OPEN,
      })
  }

  // A new game: the tab slides along to it (same row) or forms under it.
  const [ca, cb] = colours
  useLayoutEffect(() => {
    draw.current(true)
  }, [gameId, ca, cb])

  // Resizes (the grid changing columns, the box growing) redraw it in place.
  useEffect(() => {
    const s = slot.current
    if (!s || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => draw.current())
    ro.observe(s)
    return () => ro.disconnect()
  }, [slot])

  // Phones: let go while the strip moves, form again when it stops.
  useEffect(() => {
    const st = strip?.current
    if (!st) return
    let t = 0
    const rest = () => {
      window.clearTimeout(t)
      draw.current()
    }
    const onScroll = () => {
      svg.current?.classList.add('let-go')
      window.clearTimeout(t)
      t = window.setTimeout(rest, 140)
    }
    st.addEventListener('scroll', onScroll, { passive: true })
    st.addEventListener('scrollend', rest)
    return () => {
      window.clearTimeout(t)
      st.removeEventListener('scroll', onScroll)
      st.removeEventListener('scrollend', rest)
    }
  }, [strip])

  return (
    <svg ref={svg} className={`sc-join${hidden ? ' let-go' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}l`} ref={gl} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: colours[0] }} />
          <stop offset="0.45" style={{ stopColor: colours[0] }} />
          <stop offset="1" style={{ stopColor: 'var(--border)' }} />
        </linearGradient>
        <linearGradient id={`${id}r`} ref={gr} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: colours[1] }} />
          <stop offset="0.45" style={{ stopColor: colours[1] }} />
          <stop offset="1" style={{ stopColor: 'var(--border)' }} />
        </linearGradient>
      </defs>
      <g ref={move}>
        <path ref={fill} className="sc-join-fill" />
        <path ref={left} className="sc-join-edge" stroke={`url(#${id}l)`} />
        <path ref={right} className="sc-join-edge" stroke={`url(#${id}r)`} />
      </g>
    </svg>
  )
}
