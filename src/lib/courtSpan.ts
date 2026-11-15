/*
 * The COURT "span": the mark that opens into Categories, Odds, Upgrades, Rosters, Trades.
 *
 * Final direction, "Pass & Reel". The ball's C is cut by its seams into six pieces. A short squeeze, a crack, and
 * the five big pieces are thrown like passes under one gravity: the short passes land first, so the floors come
 * down left to right, Categories to Trades. Each piece holds its curve most of the way, turns level, flattens and
 * hands over to a straight bar at the same pixels; the bar lands a hair low, skids out to its word's width and
 * settles while the house light blooms under it. The small piece and the ball T's arm have no word: they fall.
 * The T leaves on a lower lane, small, and stands up into Trades' capital as Trades' floor lands. Categories
 * gets a new plain C (the typed C of the words) faded in left to right behind a soft edge.
 * Close is a tape measure snapping back: every floor reels along the floor line into the C, where it becomes its
 * arc again and clicks home.
 *
 * Imperative DOM + Web Animations: every move is a transform or an opacity on an HTML element (the pieces are
 * small SVGs inside spans). Geometry is on a 32-unit cap box (ink y 2..30). u = px per unit.
 */

export type SpanState = 'folded' | 'closed' | 'open'

export interface SpanOptions {
  u: number // px per glyph unit
  capH: number // cap height of the open words, px
  gap: number // px between open words
  state: SpanState
  sizeAs?: SpanState // box size to keep (the top bar keeps its closed size while open)
  veil?: boolean // cover what sits to the right while open (top bar)
}

interface Glyph {
  k: string
  rest: string
  w: number
  svg: string
}

const SEAM = (d: string) => `<path d="${d}" fill="none" stroke="#000" stroke-width="1.3"/>`
const MASK = (id: string, seams: string[]) =>
  `<mask id="${id}" maskUnits="userSpaceOnUse" x="-4" y="-2" width="40" height="38"><rect x="-4" y="-2" width="40" height="38" fill="#fff"/>${seams.map(SEAM).join('')}</mask>`
const FOLDED_SEAMS = [
  'M-1 12.25H6.5',
  'M2.6 4.8A17 17 0 0 1 2.6 27.2',
  'M25.4 4.8A17 17 0 0 0 21.46 19',
  'M14 0V7.2',
  'M14 24.6V32.5',
]
const WORD_SEAMS = [FOLDED_SEAMS[0], FOLDED_SEAMS[1], FOLDED_SEAMS[4]]
const BALL_C = 'M25.87 23.42A14 14 0 1 1 21.42 4.13L18.77 8.37A9 9 0 1 0 21.63 20.77Z'
const WORD_C = 'M23 26.72A14 14 0 1 1 14 2H18.12V8A9 9 0 1 0 19.79 22.89Z'
const T_ARM = 'M21 3.88A14 14 0 0 1 27.92 14.5L22.87 14.5A9 9 0 0 0 18.5 8.21Z'

// {ID} is replaced with a unique id per glyph instance.
const G: Glyph[] = [
  {
    k: 'C',
    rest: 'ategories',
    w: 28,
    svg:
      MASK('{ID}f', FOLDED_SEAMS) +
      MASK('{ID}w', WORD_SEAMS) +
      `<g class="cf" mask="url(#{ID}f)"><path d="${BALL_C}"/></g>` +
      `<g class="cw" mask="url(#{ID}w)"><path d="${WORD_C}"/></g>`,
  },
  {
    k: 'O',
    rest: 'dds',
    w: 18,
    svg: '<rect x="2.75" y="13.75" width="12.5" height="13.5" rx="6.25" fill="none" stroke="currentColor" stroke-width="5.5"/>',
  },
  {
    k: 'U',
    rest: 'pgrades',
    w: 18,
    svg: '<path d="M2.75 11V21A6.25 6.25 0 0 0 15.25 21V11" fill="none" stroke="currentColor" stroke-width="5.5"/>',
  },
  {
    k: 'R',
    rest: 'osters',
    w: 17.4,
    svg: '<path d="M0 11H5.5V30H0Z"/><path d="M2.75 13.75H8.5A4.75 4.75 0 0 1 8.5 23.25H2.75" fill="none" stroke="currentColor" stroke-width="5.5"/><path d="M6.6 23H13L17.4 30H11Z"/>',
  },
  {
    k: 'T',
    rest: 'rades',
    w: 28,
    svg:
      MASK('{ID}', FOLDED_SEAMS) +
      `<g class="tf" mask="url(#{ID})"><path class="arm" d="${T_ARM}"/><path d="M6.99 10H21.01A9 9 0 0 1 23.17 14.5H4.83A9 9 0 0 1 6.99 10Z"/><path d="M11.5 14.3H16.5V23.5H11.5Z"/></g>` +
      '<g class="tw"><path d="M0 2H20V8H13V30H7V8H0Z"/></g>',
  },
]

export const COURT_WORDS = ['Categories', 'Odds', 'Upgrades', 'Rosters', 'Trades']

const X: Record<'closed' | 'folded', number[]> = { closed: [0, 26.5, 47.5, 68.5, 84.5], folded: [0, 4, 4, 4, 0] }
const SEG = { x0: 14, len: 14.2 } // closed rail: x 14..85, five pieces of 14.2
const INK = [28, 19, 19, 19, 28] // ink height of each drawn capital, glyph units
const CAP = 0.7 // Host Grotesk cap height / font size

/*
 * The C's six pieces, cut by the seams. Each is the C clipped by a polygon whose edges run along the seam
 * centrelines pushed out by half the seam width (0.65), so the pieces side by side are exactly the masked C.
 * a0..a1: the piece's angular run on the ring (deg, y down), used for its throw and its flattening.
 */
const SEAM_CX = -10.189 // the left seam arc: centre (-10.189, 16), radius 17
const seamPts = (rho: number, y0: number, y1: number, n = 12): number[][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const y = y0 + ((y1 - y0) * k) / n
    return [SEAM_CX + Math.sqrt(Math.max(0, rho * rho - (y - 16) * (y - 16))), y]
  })
const SEAM_CX_R = 38.189 // the right seam arc: centre (38.189, 16), radius 17
const seamPtsR = (rho: number, y0: number, y1: number, n = 6): number[][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const y = y0 + ((y1 - y0) * k) / n
    return [SEAM_CX_R - Math.sqrt(Math.max(0, rho * rho - (y - 16) * (y - 16))), y]
  })
const polyPts = (poly: number[][]) => poly.map((q) => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ')
/*
 * The ball T is its bar and stem between the two side seams, plus ball-only bits the typed T doesn't have: the
 * arm (top right) and two nubs, the bar's ends outside the seams. The clean T runs to Trades; the left nub falls
 * with the small piece next to it, the right nub with the arm.
 */
const T_BAR = 'M6.99 10H21.01A9 9 0 0 1 23.17 14.5H4.83A9 9 0 0 1 6.99 10Z'
const T_STEM = 'M11.5 14.3H16.5V23.5H11.5Z'
const NUB_L = [[-3, 9], ...seamPts(16.35, 9, 15, 6), [-3, 15]]
const NUB_R = [[31, 9], ...seamPtsR(16.35, 9, 15), [31, 15]]
const T_CLEAN = [...seamPts(17, 9, 15, 6), [6.8, 32], [21.2, 32], ...seamPtsR(17, 15, 9)]
/** The clean T's visible box (glyph units): bar x 7.04..20.96 at mid height, top 10, stem foot 23.5. */
const TB = { l: 7.04, r: 20.96, top: 10, foot: 23.5 }
interface PieceDef {
  a0: number
  a1: number
  poly: number[][]
}
const PIECES: PieceDef[] = [
  { a0: 217, a1: 270, poly: [[13.35, -3], [13.35, 16], ...seamPts(17.65, 16, -1), [-6, -3]] }, // 1 top-left
  { a0: 270, a1: 302, poly: [[14.65, -3], [31, -3], [31, 16], [14.65, 16]] }, // 2 top-right
  { a0: 200, a1: 217, poly: [[-3, 3], ...seamPts(16.35, 3, 11.6), [-3, 11.6]] }, // 3 small, falls
  { a0: 143, a1: 200, poly: [[-3, 12.9], ...seamPts(16.35, 12.9, 29), [-3, 29]] }, // 4 left
  { a0: 90, a1: 143, poly: [[13.35, 35], [13.35, 16], ...seamPts(17.65, 16, 33), [-6, 35]] }, // 5 bottom-left
  { a0: 32, a1: 90, poly: [[14.65, 16], [31, 16], [31, 35], [14.65, 35]] }, // 6 the tail
]
/** Which piece floors which word: left arc tips over under Categories, the tail lobs furthest, to Trades. */
const WORD_PIECE = [3, 4, 0, 1, 5]
const SMALL = 2
/** Extra half turns in the air, per piece (the tail is flung, so it tumbles). */
const SPIN = [0, 0, 0, 0, 0, 180]

/** Timing in ms. */
export const T = {
  SQUASH: 50, // wind-up: the ball gives a little
  LAUNCH: 75, // crack (50..75): pieces jump apart and are released, all at once
  FLIGHT: [225, 275, 325, 375, 425], // per word; one gravity, so the short passes land first (300..500)
  XF: [0.74, 0.88] as const, // arc -> bar hand-over, as a fraction of the flight (the curve holds till then)
  SETTLE: 240, // landed bar skids out to the word width and settles
  BLOOM: 380, // house light blooms under a floor as it lands
  FALL: 320, // the small piece and the T's arm fall away
  T_GO: 115, // the T leaves 40ms after the pieces, on a lower lane
  T_STAND: 470, // ...and stands up into Trades' capital as Trades' floor lands
  T_STAND_DUR: 100,
  T_SWAP: 590, // drawn T -> typed T, once it stands
  T_SWAP_DUR: 70,
  W: 240,
  TAIL: 300, // the lowercase rest fades in slower than its capital, so it doesn't pop in
  C_AT: 385, // the new plain C fades in left to right once "ategories" is mostly up
  C_DUR: 425,
  VEIL: 100,
  CLOSE: 240, // the close's choreography; it plays CLOSE_PACE times slower
  CLOSE_W: 75,
  INTENT: 140,
  HOLD: 700,
}
const LAND = T.FLIGHT.map((f) => T.LAUNCH + f)
export const OPEN_TOTAL = Math.max(LAND[4] + 10 + T.TAIL, T.C_AT + T.C_DUR, T.T_SWAP + T.T_SWAP_DUR) // 810
// The fold back starts the moment the mouse leaves but plays slowly, so it never feels like it snaps shut.
const CLOSE_PACE = 3
export const CLOSE_TOTAL = Math.round(T.CLOSE * CLOSE_PACE) // 720

/** Close: when each floor has reeled into the C (Categories first), and how long its arc takes to click home. */
const REEL = [128, 138, 148, 156, 164]
const CLICK = 62

const GRAV = 67 // gravity, cap heights per s^2
const SQUASH_K = 0.95
const WIND = -4 // deg: the wind-up turns the ball back against the throw

const EASE = 'cubic-bezier(.22,.8,.24,1)'
const EASE_IN_OUT = 'cubic-bezier(.4,0,.2,1)'

let GID = 0

interface Layout {
  open: { x: number[]; y: number[]; gx: number[]; tx: number[]; segX: number[]; segW: number[]; s: number[] }
  segT: number
  segY: number
  cw: number // width of the typed C of Categories, px
  soft: number // width of the soft edge that reveals it, px
  tInk: [number, number, number, number] // the typed T of Trades: ink left, right, cap top, baseline (px)
}

/** Everything a built span holds. Kept on a plain object, not on the element. */
export interface Span {
  el: HTMLElement
  o: SpanOptions & { fs: number; weight: number; track: number }
  box: HTMLElement
  segs: HTMLElement[]
  L: HTMLElement[]
  W: HTMLElement[]
  glows: HTMLElement[]
  veil: HTMLElement | null
  Tf: SVGGElement | null
  Tw: SVGGElement | null
  Cf: SVGGElement | null
  Cw: SVGGElement | null
  pieces: HTMLElement[]
  arm: HTMLElement
  armPath: SVGElement | null
  runner: HTMLElement // the T that runs to Trades (and back): the clean ball T, and a word T to stand up into
  rb: SVGGElement | null
  rw: SVGGElement | null
  newC: HTMLElement // Categories' typed capital (<b>), carries the soft reveal mask
  newCInk: HTMLElement // the C inside it, counter-moved so it stays put while the mask slides
  G: Layout
  size: Record<SpanState, [number, number]>
  anims: Animation[]
  ws?: WordState[]
}

/** Loading screen: each word waits (faint), runs (pulses) or has landed. */
export type WordState = 'pending' | 'running' | 'landed'

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function baselineOf(el: HTMLElement, fs: number, weight: number): number {
  const p = document.createElement('span')
  p.style.cssText = `position:absolute;visibility:hidden;font-family:inherit;font-size:${fs}px;font-weight:${weight};line-height:1;white-space:nowrap`
  p.innerHTML = 'Hx<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>'
  el.appendChild(p)
  const b = (p.lastChild as HTMLElement).offsetTop
  p.remove()
  return b || fs * 0.8
}

const FREE = 'position:absolute;left:0;top:0;pointer-events:none;line-height:0;opacity:0'
const svgBox = (u: number, inner: string) =>
  `<svg width="${28 * u}" height="${32 * u}" viewBox="0 0 28 32" fill="currentColor" focusable="false" style="display:block;overflow:visible">${inner}</svg>`

export function buildSpan(el: HTMLElement, opts: SpanOptions): Span {
  const o = { ...opts, fs: +(opts.capH / CAP).toFixed(2), weight: 470, track: 0.01 }
  const u = o.u
  el.innerHTML = ''
  el.setAttribute('aria-hidden', 'true')
  const box = document.createElement('span')
  box.className = 'span-box'
  const mk = (cls: string, html = '') => {
    const s = document.createElement('span')
    s.className = cls
    s.innerHTML = html
    box.appendChild(s)
    return s
  }
  const veil = o.veil ? mk('veil') : null
  const glows = G.map(() => {
    const gl = mk('glow')
    gl.style.transformOrigin = '50% 100%' // it blooms up from the floor
    return gl
  })
  const L = G.map((g) => {
    const s = mk(
      'L',
      `<svg width="${g.w * u}" height="${32 * u}" viewBox="0 0 ${g.w} 32" focusable="false">${g.svg.replace(/\{ID\}/g, 'court-g' + ++GID)}</svg>`,
    )
    s.style.transformOrigin = `0 ${30 * u}px`
    return s
  })
  const W = G.map((g) => {
    const s = mk('w')
    const b = document.createElement('b')
    const ink = document.createElement('span')
    ink.textContent = g.k
    ink.style.display = 'inline-block'
    b.appendChild(ink)
    const tail = document.createElement('span')
    tail.className = 'tail'
    tail.textContent = g.rest
    s.append(b, tail)
    s.style.fontSize = o.fs + 'px'
    s.style.letterSpacing = o.track + 'em'
    return s
  })
  // The C's pieces (each holds both C shapes, the ball's and the wordmark's; the animation shows the one at rest).
  const pieces = PIECES.map((p, i) => {
    const id = 'court-p' + ++GID
    const nub = i === SMALL ? `<clipPath id="${id}n"><polygon points="${polyPts(NUB_L)}"/></clipPath><path class="pf" clip-path="url(#${id}n)" d="${T_BAR}"/>` : ''
    const s = mk(
      'pc',
      svgBox(u, `<clipPath id="${id}"><polygon points="${polyPts(p.poly)}"/></clipPath><g clip-path="url(#${id})"><path class="pf" d="${BALL_C}"/><path class="pw" d="${WORD_C}"/></g>${nub}`),
    )
    s.style.cssText = FREE
    const m = (p.a0 + p.a1) / 2
    s.style.transformOrigin = `${(14 + 11.5 * Math.cos(rad(m))) * u}px ${(16 + 11.5 * Math.sin(rad(m))) * u}px`
    return s
  })
  // The floors sit above the pieces' flight so a bar is never under its own arc.
  const segs = G.map(() => mk('seg'))
  const armId = 'court-a' + ++GID
  const arm = mk(
    'pc',
    svgBox(
      u,
      MASK(armId, FOLDED_SEAMS) +
        `<clipPath id="${armId}n"><polygon points="${polyPts(NUB_R)}"/></clipPath><g mask="url(#${armId})"><path d="${T_ARM}"/></g><path clip-path="url(#${armId}n)" d="${T_BAR}"/>`,
    ),
  )
  arm.style.cssText = FREE
  arm.style.transformOrigin = `${24 * u}px ${9 * u}px`
  // The running T. rb: the clean ball T (seams masked, nubs clipped off), pixel for pixel the ball's at rest.
  // rw: the word T squeezed into rb's box, so the T can stand up into Trades' capital with its proportions.
  const runId = 'court-r' + ++GID
  const wFit = `matrix(${n4((TB.r - TB.l) / 20)} 0 0 ${n4((TB.foot - TB.top) / 28)} ${n4(TB.l)} ${n4(TB.top - (2 * (TB.foot - TB.top)) / 28)})`
  const runner = mk(
    'pc',
    svgBox(
      u,
      MASK(runId, FOLDED_SEAMS) +
        `<clipPath id="${runId}c"><polygon points="${polyPts(T_CLEAN)}"/></clipPath>` +
        `<g class="rb" mask="url(#${runId})"><g clip-path="url(#${runId}c)"><path d="${T_BAR}"/><path d="${T_STEM}"/></g></g>` +
        `<g class="rw" transform="${wFit}"><path d="M0 2H20V8H13V30H7V8H0Z"/></g>`,
    ),
  )
  runner.style.cssText = FREE
  runner.style.transformOrigin = `0 ${30 * u}px`
  el.appendChild(box)
  const newC = W[0].querySelector('b') as HTMLElement
  const span: Span = {
    el,
    o,
    box,
    segs,
    L,
    W,
    glows,
    veil,
    Tf: L[4].querySelector('.tf'),
    Tw: L[4].querySelector('.tw'),
    Cf: L[0].querySelector('.cf'),
    Cw: L[0].querySelector('.cw'),
    pieces,
    arm,
    armPath: L[4].querySelector('.arm'),
    runner,
    rb: runner.querySelector('.rb'),
    rw: runner.querySelector('.rw'),
    newC,
    newCInk: newC.firstChild as HTMLElement,
    G: { open: { x: [], y: [], gx: [], tx: [], segX: [], segW: [], s: [] }, segT: 3, segY: 0, cw: 0, soft: 0, tInk: [0, 0, 0, 0] },
    size: { open: [0, 0], closed: [104.5 * u, 32 * u], folded: [28 * u, 32 * u] },
    anims: [],
  }
  newC.style.display = 'inline-block' // so the new C can be revealed on its own
  measureSpan(span)
  setStatic(span, o.state)
  return span
}

/** Where each typed capital's ink starts inside its advance, px (so a drawn capital hands over in place). */
function leftBearings(span: Span): number[] {
  const c = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (!c) return G.map(() => 0)
  c.font = `760 ${span.o.fs}px ${getComputedStyle(span.el).fontFamily || 'sans-serif'}`
  return G.map((g) => {
    const b = -c.measureText(g.k).actualBoundingBoxLeft
    return isFinite(b) ? Math.max(0, Math.min(b, span.o.fs * 0.15)) : 0
  })
}

/** The typed T of Trades as an ink box (left, right, cap top, baseline), px, from the font's own metrics. */
function typedTInk(span: Span, x: number, base: number, s: number): [number, number, number, number] {
  const u = span.o.u
  const fb: [number, number, number, number] = [x, x + 20 * s * u, base - span.o.capH, base]
  const c = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (!c) return fb
  c.font = `760 ${span.o.fs}px ${getComputedStyle(span.el).fontFamily || 'sans-serif'}`
  const m = c.measureText('T')
  const l = -m.actualBoundingBoxLeft
  const r = m.actualBoundingBoxRight
  const a = m.actualBoundingBoxAscent
  if (!isFinite(l) || !isFinite(r) || !isFinite(a) || r - l <= 0 || a <= 0) return fb
  return [x + l, x + r, base - a, base]
}

/** Lay out the open row from the real word widths. Call again after fonts load or the size changes. */
export function measureSpan(span: Span) {
  const { o, W } = span
  const u = o.u
  // offsetWidth: layout width, not affected by a scale on the host. Trailing tracking is not part of the word.
  const tw = W.map((w) => w.offsetWidth - o.track * o.fs)
  const base = baselineOf(span.el, o.fs, o.weight)
  const scale = G.map((_, i) => o.capH / (INK[i] * u)) // capital drawn at exactly capH
  const open: Layout['open'] = { x: [], y: [], gx: [], tx: [], segX: [], segW: [], s: scale }
  const segT = Math.max(3, Math.round(u * 3.4))
  const segY = 30 * u + Math.max(4, Math.round(o.capH * 0.42))
  const ext = Math.max(2, Math.round(o.capH * 0.22))
  const oy = o.veil ? -Math.round((30 * u - o.capH + (segY + segT)) / 2 - 16 * u) : 0
  const lsb = leftBearings(span)
  let x = 0
  G.forEach((_, i) => {
    const gx = x + lsb[i]
    const right = x + (tw[i] || 0)
    open.x.push(x)
    open.y.push(oy)
    open.gx.push(gx)
    open.tx.push(x)
    open.segX.push(x - ext)
    open.segW.push(right - x + 2 * ext)
    x = right + o.gap
  })
  // The new C's reveal: the <b> gets room on its right for a soft edge (padding, cancelled by a negative margin,
  // so the layout does not move) and a mask that is solid over the C and fades out across that room.
  const cw = span.newCInk.offsetWidth
  const soft = Math.max(4, Math.round(cw * 1.1))
  span.newC.style.paddingRight = soft + 'px'
  span.newC.style.marginRight = -soft + 'px'
  span.G = { open, segT, segY, cw, soft, tInk: typedTInk(span, open.x[4], oy + 30 * u, scale[4]) }
  const openW = Math.max(...open.segX.map((sx, i) => sx + open.segW[i]))
  span.size.open = [openW, segY + segT]
  W.forEach((w) => {
    w.style.top = 30 * u - base + 'px'
  })
  span.glows.forEach((gl, i) => {
    const h = Math.round(o.capH * 2.6)
    const w = open.segW[i] + 20
    gl.style.width = w + 'px'
    gl.style.height = h + 'px'
    gl.style.transform = `translate(${open.segX[i] - 10}px, ${open.y[i] + segY - h + 1}px)`
  })
  if (span.veil) {
    const bar = 64
    span.veil.style.left = '-14px'
    span.veil.style.top = 16 * u - bar / 2 + 'px'
    span.veil.style.height = bar - 1 + 'px'
    span.veil.style.width = openW + 14 + 96 + 'px'
  }
}

const PIECE = (u: number) => SEG.len * u + 1 // base width of one bar (1px overlap: no seams)
const BAR_H = (u: number) => 6 * u // base height of one bar
const n2 = (v: number) => v.toFixed(2)
const n4 = (v: number) => v.toFixed(4)
const tf = (x: number, y: number, sx: number, sy: number) => `translate(${n2(x)}px, ${n2(y)}px) scale(${n4(sx)}, ${n4(sy)})`
const rad = (d: number) => (d * Math.PI) / 180
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** A CSS cubic-bezier easing as a function (for motion sampled into keyframes). */
function bez(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t
  const Y = (t: number) => ((ay * t + by) * t + cy) * t
  return (x: number) => {
    x = clamp01(x)
    let lo = 0
    let hi = 1
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2
      if (X(m) < x) lo = m
      else hi = m
    }
    return Y((lo + hi) / 2)
  }
}

/** A bar centred on (cx, cy), turned by a deg, len x th px. The bar's transform origin is its top-left corner. */
function barTf(u: number, cx: number, cy: number, a: number, len: number, th: number): string {
  const c = Math.cos(rad(a))
  const s = Math.sin(rad(a))
  const hx = len / 2
  const hy = th / 2
  return `translate(${n2(cx - (c * hx - s * hy))}px, ${n2(cy - (s * hx + c * hy))}px) rotate(${n2(a)}deg) scale(${n4(len / PIECE(u))}, ${n4(th / BAR_H(u))})`
}

/** Piece pose: moved by (dx, dy), its chord turned to A deg, squashed sx along the chord and sy across it. */
const pieceTf = (dx: number, dy: number, A: number, sx: number, sy: number, base: number) =>
  `translate(${n2(dx)}px, ${n2(dy)}px) rotate(${n2(A)}deg) scale(${n4(sx)}, ${n4(sy)}) rotate(${n2(-base)}deg)`

interface PieceGeo {
  m: number // mid angle, deg
  base: number // the chord's angle at rest
  Afin: number // the chord's angle once level in the throw (a multiple of 180, with the tail's tumble)
  Alevel: number // the chord's angle once level the short way (the close)
  pc: [number, number] // body centre at rest, px
  chord: number // outer chord, px
  burst: [number, number] // crack: how far it jumps out, px
}
function geo(span: Span, i: number): PieceGeo {
  const u = span.o.u
  const p = PIECES[i]
  const m = (p.a0 + p.a1) / 2
  const base = m - 90
  let r = ((-base % 180) + 180) % 180
  if (r > 90) r -= 180 // level it the short way...
  const half = rad((p.a1 - p.a0) / 2)
  const b = 1.5 * u
  return {
    m,
    base,
    Afin: base + r + SPIN[i], // ...plus a flip for the long throw
    Alevel: base + r,
    pc: [(14 + 11.5 * Math.cos(rad(m))) * u, (16 + 11.5 * Math.sin(rad(m))) * u],
    chord: 2 * 14 * Math.sin(half) * u,
    burst: [b * Math.cos(rad(m)), b * Math.sin(rad(m))],
  }
}

function segPose(span: Span, state: SpanState, i: number): string {
  const u = span.o.u
  const g = span.G
  const P = PIECE(u)
  if (state === 'open') return tf(g.open.segX[i], g.open.y[i] + g.segY, g.open.segW[i] / P, g.segT / BAR_H(u))
  if (state === 'folded') return tf(14 * u, 2 * u, 0.0001, 1)
  const len = SEG.len * u
  return tf((SEG.x0 + SEG.len * i) * u - 0.5, 2 * u, (len + 1) / P, 1)
}
/** The closed rail as a turnable bar pose; k = 1 laid out, k = 0 pulled back into the C. */
function railTf(span: Span, i: number, k: number): string {
  const u = span.o.u
  const len = SEG.len * u + 1
  const cx = (SEG.x0 + SEG.len * i) * u - 0.5 + len / 2
  return barTf(u, 14 * u + (cx - 14 * u) * k, 5 * u, 0, Math.max(len * k, 0.01), 6 * u)
}

function letterPose(span: Span, state: SpanState, i: number): string {
  if (state === 'open') return `translate(${span.G.open.gx[i]}px, ${span.G.open.y[i]}px) scale(${span.G.open.s[i]})`
  return `translate(${X[state][i] * span.o.u}px, 0px) scale(1)`
}

const hiddenInFolded = (state: SpanState, i: number) => state === 'folded' && i > 0 && i < 4

/*
 * The running T's pose (origin: left end of the baseline, y 30). go: 0 in the ball .. 1 at Trades; shrink: 0
 * ball size .. 1 word size (its bar as wide as the typed T's); stand: 0 squat, the ball T's own proportions ..
 * 1 stretched onto the typed T's ink box. Squat, it rides with its stem's foot on the line from the ball's T to
 * Trades' baseline: a lower lane than the pieces' lobs.
 */
function tPose(span: Span, go: number, shrink: number, stand: number, sq?: { rot: number; d: [number, number]; k: number }): string {
  const u = span.o.u
  const [iL, iR, top, base] = span.G.tInk
  const k1 = (iR - iL) / ((TB.r - TB.l) * u)
  const k = lerp(1, k1, shrink) * (sq ? sq.k : 1)
  const syW = (base - top) / ((TB.foot - TB.top) * u)
  // squat: bar centre (unit 14) on cx, stem foot (unit 23.5) on foot
  const cx = lerp(14 * u, (iL + iR) / 2, go)
  const foot = lerp(TB.foot * u, base, go)
  const sx = lerp(k, k1, stand)
  const sy = lerp(k, syW, stand)
  const tx = cx - sx * 14 * u + (sq ? sq.d[0] : 0)
  const ty = foot - 30 * u - sy * (TB.foot - 30) * u + (sq ? sq.d[1] : 0)
  return `translate(${n2(tx)}px, ${n2(ty)}px) rotate(${n2(sq ? sq.rot : 0)}deg) scale(${n4(sx)}, ${n4(sy)})`
}

function cancel(span: Span) {
  span.anims.forEach((a) => a.cancel())
  span.anims = []
}

export function setStatic(span: Span, state: SpanState) {
  cancel(span)
  span.el.dataset.state = state
  const u = span.o.u
  const sz = span.size[span.o.sizeAs || state]
  span.box.style.width = Math.ceil(sz[0]) + 'px'
  span.box.style.height = Math.ceil(sz[1]) + 'px'
  const open = state === 'open'
  span.segs.forEach((s, i) => {
    s.style.width = PIECE(u) + 'px'
    s.style.height = BAR_H(u) + 'px'
    s.style.transform = segPose(span, state, i)
    s.style.opacity = state === 'folded' ? '0' : '1'
  })
  span.L.forEach((L, i) => {
    L.style.transform = letterPose(span, state, i)
    L.style.opacity = hiddenInFolded(state, i) || open ? '0' : '1'
  })
  setCLayer(span, state)
  setTLayer(span, state)
  span.pieces.forEach((p) => (p.style.opacity = '0'))
  span.arm.style.opacity = '0'
  span.runner.style.opacity = '0'
  setCMask(span, false)
  span.W.forEach((w, i) => {
    w.style.transform = `translate(${span.G.open.tx[i]}px, ${span.G.open.y[i]}px)`
    w.style.opacity = open ? '1' : '0'
  })
  span.glows.forEach((g) => (g.style.opacity = open ? '1' : '0'))
  if (span.veil) span.veil.style.opacity = open ? '1' : '0'
}

/** Folded shows the ball's C, closed the upright wordmark C. Open shows neither: Categories has a typed C. */
function setCLayer(span: Span, rest: SpanState) {
  if (!span.Cf || !span.Cw) return
  const word = rest === 'closed'
  span.Cf.style.opacity = word ? '0' : '1'
  span.Cw.style.opacity = word ? '1' : '0'
}
/** The drawn T is the ball's (with its arm only while folded), or the wordmark's T. No SVG transforms. */
function setTLayer(span: Span, rest: SpanState) {
  if (!span.Tf || !span.Tw) return
  const word = rest === 'closed'
  span.Tf.style.opacity = word ? '0' : '1'
  span.Tw.style.opacity = word ? '1' : '0'
  if (span.armPath) span.armPath.style.opacity = rest === 'folded' ? '1' : '0'
}

/*
 * The soft mask on the new C: solid over the C, fading to nothing across the room to its right. With the mask
 * on the <b> and the C counter-moved inside it, a transform slides the soft edge over a C that stays put.
 */
function setCMask(span: Span, on: boolean) {
  const st = span.newC.style
  const { cw, soft } = span.G
  const m = on ? `linear-gradient(90deg, #000 0px, #000 ${cw}px, transparent ${cw + soft}px)` : ''
  st.setProperty('-webkit-mask-image', m)
  st.setProperty('mask-image', m)
  st.setProperty('-webkit-mask-repeat', on ? 'no-repeat' : '')
  st.setProperty('mask-repeat', on ? 'no-repeat' : '')
}

/** The pieces show the C of the state at rest (the ball's, or the wordmark's). */
function setPieceShape(span: Span, rest: SpanState) {
  const word = rest === 'closed'
  span.pieces.forEach((p) => {
    ;(p.querySelector('.pf') as SVGElement).style.display = word ? 'none' : ''
    ;(p.querySelector('.pw') as SVGElement).style.display = word ? '' : 'none'
  })
}

/** Animate from one state to another. With reduced motion it just jumps to the end state. */
export function animateSpan(span: Span, from: SpanState, to: SpanState): Animation[] {
  setStatic(span, to)
  const rest = to === 'open' ? from : to
  setCLayer(span, rest)
  setTLayer(span, rest)
  // opening, the ball T's arm is not part of the T that runs: it falls on its own (span.arm)
  if (to === 'open' && span.armPath) span.armPath.style.opacity = '0'
  if (reducedMotion() || typeof span.box.animate !== 'function') return []
  const A: Animation[] = []
  const o = (delay: number, duration: number, easing = 'linear'): KeyframeAnimationOptions => ({
    delay,
    duration,
    easing,
    fill: 'backwards',
  })
  const add = (node: Element | null, kf: Keyframe[], opt: KeyframeAnimationOptions) => {
    if (node) A.push(node.animate(kf, opt))
  }
  const u = span.o.u
  const capH = span.o.capH
  const g = span.G
  const grav = GRAV * capH // px / s^2
  const ball: [number, number] = [14 * u, 16 * u]
  setPieceShape(span, rest)
  /** Keyframe offset of absolute time t (ms) inside one animation of length `dur`. */
  const at = (dur: number, t: number) => clamp01(t / dur)
  // Wind-up about the ball's centre (squash k, turn th), as the move for an element whose origin is `org`.
  const squashD = (org: [number, number], k: number, th = 0): [number, number] => {
    const c = Math.cos(rad(th))
    const sn = Math.sin(rad(th))
    const dx = org[0] - ball[0]
    const dy = org[1] - ball[1]
    return [ball[0] + k * (c * dx - sn * dy) - org[0], ball[1] + k * (sn * dx + c * dy) - org[1]]
  }

  if (to === 'open') {
    add(span.veil, [{ opacity: 0 }, { opacity: 1 }], o(0, T.VEIL, EASE))
    // The rest C is gone from the first frame: its pieces stand in, pixel for pixel.
    add(span.L[0], [{ opacity: 0 }, { opacity: 0 }], o(0, T.LAUNCH + 40))

    // --- the five big pieces: wind up, crack, pass, flatten, hand over to a bar, land, skid out ---
    WORD_PIECE.forEach((pi, w) => {
      const P = geo(span, pi)
      const el = span.pieces[pi]
      const bar = span.segs[w]
      const F = T.FLIGHT[w]
      const land = LAND[w]
      const h = (grav * (F / 1000) ** 2) / 8 // apex above the straight line: same gravity for every throw
      const Lland = P.chord * 1.15
      const dip = Math.max(1, 0.12 * capH)
      const floorY = g.open.y[w] + g.segY
      const start: [number, number] = [P.pc[0] + P.burst[0], P.pc[1] + P.burst[1]]
      const end: [number, number] = [g.open.segX[w] + Lland / 2, floorY + g.segT / 2 + dip]
      const body = (s: number): [number, number] => [
        start[0] + (end[0] - start[0]) * s,
        start[1] + (end[1] - start[1]) * s - 4 * h * s * (1 - s),
      ]
      const turn = (s: number) => {
        const x = Math.min(1, s / 0.85)
        return P.base + (P.Afin - P.base) * (1 - (1 - x) * (1 - x))
      }
      const [XF0, XF1] = T.XF
      const XB = XF0 + 0.05 // the bar is fully there before the arc starts to go: no see-through moment
      const flat = (s: number) => smooth(0.45, XF1, s) // 0..1: the arc keeps its curve, then is pressed flat
      const sxA = (s: number) => 1 + 0.1 * flat(s)
      const syA = (s: number) => 1 - 0.4 * flat(s)
      const pDur = T.LAUNCH + F * XF1
      const sq = squashD(P.pc, SQUASH_K, WIND)
      const pk: Keyframe[] = [
        { offset: 0, opacity: 1, transform: pieceTf(0, 0, P.base, 1, 1, P.base), easing: 'cubic-bezier(.4,0,.8,.6)' },
        { offset: at(pDur, T.SQUASH), opacity: 1, transform: pieceTf(sq[0], sq[1], P.base + WIND, SQUASH_K, SQUASH_K, P.base), easing: 'cubic-bezier(.2,.9,.3,1)' },
      ]
      const N = 12
      for (let k = 0; k <= N; k++) {
        const s = (XF1 * k) / N
        const b = body(s)
        pk.push({
          offset: at(pDur, T.LAUNCH + s * F),
          opacity: 1 - smooth(XB, XF1, s),
          transform: pieceTf(b[0] - P.pc[0], b[1] - P.pc[1], turn(s), sxA(s), syA(s), P.base),
          easing: 'linear',
        })
      }
      add(el, pk, o(0, pDur))

      // The bar: born inside the flattened arc with its pose, then lands and skids out under the word.
      const bDur = land + T.SETTLE
      const thA = 5 * u * syA(XF0)
      const len0 = P.chord * sxA(XF0) * 0.9
      const barAt = (s: number) => {
        const b = body(s)
        const k = (s - XF0) / (1 - XF0)
        return barTf(u, b[0], b[1], turn(s) - P.Afin, len0 + (Lland - len0) * k, thA + (g.segT - thA) * k)
      }
      const bk: Keyframe[] = []
      const t0 = T.LAUNCH + XF0 * F
      if (from === 'closed') {
        // the rail retracts into the C before it cracks
        bk.push({ offset: 0, opacity: 1, transform: railTf(span, w, 1), easing: 'cubic-bezier(.5,0,.8,.4)' })
        bk.push({ offset: at(bDur, T.SQUASH), opacity: 0, transform: railTf(span, w, 0) })
      } else bk.push({ offset: 0, opacity: 0, transform: barAt(XF0) })
      bk.push({ offset: at(bDur, t0), opacity: 0, transform: barAt(XF0), easing: 'linear' })
      const NB = 6
      for (let k = 1; k <= NB; k++) {
        const s = XF0 + ((1 - XF0) * k) / NB
        bk.push({ offset: at(bDur, T.LAUNCH + s * F), opacity: smooth(XF0, XB, s), transform: barAt(s), easing: 'linear' })
      }
      // impact: the bar is down, a hair below the floor and pressed thin; then its leading end skids out, settles
      const left = g.open.segX[w]
      const W0 = g.open.segW[w]
      const L2 = (len: number, y: number, th: number) => barTf(u, left + len / 2, y + th / 2, 0, len, th)
      bk[bk.length - 1].transform = L2(Lland, floorY + dip, g.segT * 0.75)
      bk[bk.length - 1].easing = 'cubic-bezier(.12,.6,.3,1)'
      bk.push({ offset: at(bDur, land + 130), opacity: 1, transform: L2(W0 * 1.035, floorY - dip * 0.3, g.segT), easing: 'cubic-bezier(.45,0,.35,1)' })
      bk.push({ offset: 1, opacity: 1, transform: L2(W0, floorY, g.segT) })
      add(bar, bk, o(0, bDur))
    })

    // --- the small piece and the T's arm: no word for them, they just fall ---
    const fall = (el: HTMLElement, org: [number, number], vx: number, vy: number, spin: number) => {
      const sq = squashD(org, SQUASH_K, WIND)
      const dur = T.LAUNCH + T.FALL
      const kf: Keyframe[] = [
        { offset: 0, opacity: 1, transform: pieceTf(0, 0, 0, 1, 1, 0), easing: 'cubic-bezier(.4,0,.8,.6)' },
        { offset: at(dur, T.SQUASH), opacity: 1, transform: pieceTf(sq[0], sq[1], WIND, SQUASH_K, SQUASH_K, 0), easing: 'cubic-bezier(.2,.9,.3,1)' },
      ]
      const N = 8
      for (let k = 0; k <= N; k++) {
        const t = (T.FALL * k) / N / 1000
        const x = vx * capH * t
        const y = vy * capH * t + 0.5 * grav * t * t
        const kx = k / N
        kf.push({
          offset: at(dur, T.LAUNCH + T.FALL * kx),
          opacity: 1 - smooth(0.1, 0.75, kx),
          transform: pieceTf(x, y, spin * t, 1, 1, 0),
          easing: 'linear',
        })
      }
      add(el, kf, o(0, dur))
    }
    const small = geo(span, SMALL)
    fall(span.pieces[SMALL], small.pc, -4, 1, -300)
    if (from === 'folded') fall(span.arm, [24 * u, 9 * u], 3, 1, 260)

    // --- letters ---
    if (from === 'folded') {
      // The ball T: gives with the squeeze, sheds its arm and nubs, leaves 40ms after the pieces, small and low,
      // and stands up into Trades' capital as Trades' floor lands. One shape at a time: never a ghost.
      const R = span.runner
      const st0 = T.T_STAND + 20
      const dur = T.T_SWAP + T.T_SWAP_DUR // the pose holds until the typed T has taken over
      const sqT = squashD([0, 30 * u], SQUASH_K, WIND)
      const goE = bez(0.4, 0, 0.2, 1)
      const shrinkE = bez(0.2, 0.6, 0.3, 1)
      const kf: Keyframe[] = [
        { offset: 0, transform: tPose(span, 0, 0, 0), easing: 'cubic-bezier(.4,0,.8,.6)' },
        { offset: at(dur, T.SQUASH), transform: tPose(span, 0, 0, 0, { rot: WIND, d: sqT, k: SQUASH_K }), easing: 'cubic-bezier(.2,.9,.3,1)' },
        { offset: at(dur, T.LAUNCH), transform: tPose(span, 0, 0, 0) },
      ]
      const N = 8
      const run = T.T_STAND - T.T_GO
      for (let k = 0; k <= N; k++) {
        const q = k / N
        kf.push({ offset: at(dur, T.T_GO + q * run), transform: tPose(span, goE(q), shrinkE(Math.min(1, q * 1.6)), 0), easing: 'linear' })
      }
      kf.push({ offset: at(dur, st0), transform: tPose(span, 1, 1, 0), easing: 'cubic-bezier(.3,1.45,.5,1)' }) // stands up with a little give
      kf.push({ offset: at(dur, st0 + T.T_STAND_DUR), transform: tPose(span, 1, 1, 1) })
      kf.push({ offset: 1, transform: tPose(span, 1, 1, 1) })
      add(R, kf, o(0, dur))
      // squat at word size, the ball T becomes the word T's shape (same box), then stands up
      // hand over to the typed T in place
      const sw = T.T_SWAP + T.T_SWAP_DUR
      add(span.rb, [{ opacity: 1 }, { offset: at(sw, T.T_STAND), opacity: 1 }, { offset: at(sw, T.T_STAND + 30), opacity: 0 }, { opacity: 0 }], o(0, sw))
      add(span.rw, [{ opacity: 0 }, { offset: at(sw, T.T_STAND - 5), opacity: 0 }, { offset: at(sw, T.T_STAND + 25), opacity: 1 }, { opacity: 1 }], o(0, sw))
      add(R, [{ opacity: 1 }, { offset: at(sw, T.T_SWAP), opacity: 1 }, { opacity: 0 }], o(0, sw))
      add(span.W[4].querySelector('b'), [{ opacity: 0 }, { offset: at(sw, T.T_SWAP), opacity: 0 }, { opacity: 1 }], o(0, sw))
    } else {
      span.L.forEach((L, i) => {
        if (i === 0) return
        add(L, [{ transform: letterPose(span, from, i) }, { transform: letterPose(span, 'open', i) }], o(T.LAUNCH, 400, EASE))
        const end = LAND[i] + 140
        add(L, [{ offset: 0, opacity: 1 }, { offset: LAND[i] / end, opacity: 1, easing: EASE }, { offset: 1, opacity: 0 }], o(0, end))
      })
    }

    // --- words stand up on their floors as they land, the light blooms under them; the new C comes last ---
    G.forEach((_, i) => {
      const d = LAND[i] + 10
      const w = span.W[i]
      const rise = i === 0 || i === 4 || !hiddenInFolded(from, i) ? 0 : 0.22 * capH
      add(
        w,
        [
          { opacity: 0, transform: `translate(${g.open.tx[i]}px, ${n2(g.open.y[i] + rise)}px)` },
          { opacity: 1, transform: w.style.transform },
        ],
        o(d, T.W, EASE),
      )
      add(
        w.querySelector('.tail'),
        [
          { opacity: 0, transform: `translateX(${n2(-0.22 * capH)}px)` },
          { opacity: 1, transform: 'none' },
        ],
        o(d, T.TAIL, 'cubic-bezier(.33,0,.2,1)'),
      )
      // The house light comes up only as the floor lands, as wide as the floor is at that moment, and blooms.
      const W0 = g.open.segW[i]
      const Lland = geo(span, WORD_PIECE[i]).chord * 1.15
      const gh = Math.round(capH * 2.6)
      const gy = g.open.y[i] + g.segY - gh + 1
      const glowTf = (len: number, sy: number) => `translate(${n2(g.open.segX[i] - 10 - (W0 - len) / 2)}px, ${n2(gy)}px) scale(${n4((len + 20) / (W0 + 20))}, ${n4(sy)})`
      add(
        span.glows[i],
        [
          { offset: 0, opacity: 0, transform: glowTf(Lland, 0.45), easing: 'cubic-bezier(.12,.6,.3,1)' },
          { offset: 130 / T.BLOOM, opacity: 1, transform: glowTf(W0 * 1.035, 1.25), easing: 'cubic-bezier(.45,0,.35,1)' },
          { offset: 1, opacity: 1, transform: glowTf(W0, 1) },
        ],
        o(LAND[i], T.BLOOM),
      )
    })
    // The new plain C: a soft edge slides left to right over it while it fades up. The mask rides on the <b>,
    // the C inside moves back by the same amount, so the C stays put and only the edge travels.
    setCMask(span, true)
    const run = g.cw + g.soft * 0.5 // the edge's faint tail already lies over the C's left side as it starts
    const cEase = 'cubic-bezier(.3,.1,.3,1)'
    add(span.newC, [{ transform: `translateX(${n2(-run)}px)` }, { transform: 'translateX(0px)' }], o(T.C_AT, T.C_DUR, cEase))
    add(span.newCInk, [{ transform: `translateX(${n2(run)}px)` }, { transform: 'translateX(0px)' }], o(T.C_AT, T.C_DUR, cEase))
    add(span.newC, [{ opacity: 0 }, { opacity: 1 }], o(T.C_AT, T.C_DUR * 0.6, 'cubic-bezier(.3,0,.4,1)'))
  } else {
    // ------------- close: the tape snaps back. Floors reel along the floor line into the C, arcs click home -------------
    const C = T.CLOSE
    ;[...span.W, ...span.glows].forEach((n) => add(n, [{ opacity: 1 }, { opacity: 0 }], o(0, T.CLOSE_W, 'cubic-bezier(.3,0,.5,1)')))
    add(span.L[0], [{ opacity: 0 }, { opacity: 0 }], o(0, C))
    if (to === 'folded') {
      WORD_PIECE.forEach((pi, w) => {
        const P = geo(span, pi)
        const floorY = g.open.y[w] + g.segY
        const cy = floorY + g.segT / 2
        const Lp = P.chord
        const arr = REEL[w]
        const left = g.open.segX[w]
        const W0 = g.open.segW[w]
        // the floor: its right end races in, the whole tape reels left along the floor line, into the C
        add(
          span.segs[w],
          [
            { offset: 0, opacity: 1, transform: barTf(u, left + W0 / 2, cy, 0, W0, g.segT), easing: 'cubic-bezier(.5,0,.75,.45)' },
            { offset: at(C, arr), opacity: 1, transform: barTf(u, P.pc[0], cy, 0, Lp, g.segT) },
            { offset: at(C, arr + 22), opacity: 0, transform: barTf(u, P.pc[0], cy, 0, Lp, g.segT) },
            { offset: 1, opacity: 0, transform: barTf(u, P.pc[0], cy, 0, Lp, g.segT) },
          ],
          o(0, C),
        )
        // the arc takes over at the same spot, level and pressed flat, and clicks back into its place
        const flat = pieceTf(0, cy - P.pc[1], P.Alevel, 1.02, 0.8, P.base)
        add(
          span.pieces[pi],
          [
            { offset: 0, opacity: 0, transform: flat },
            { offset: at(C, arr), opacity: 0, transform: flat },
            { offset: at(C, arr + 14), opacity: 1, transform: flat, easing: 'cubic-bezier(.3,.7,.35,1.12)' },
            { offset: at(C, arr + CLICK), opacity: 1, transform: pieceTf(0, 0, P.base, 1, 1, P.base) },
            { offset: 1, opacity: 1, transform: pieceTf(0, 0, P.base, 1, 1, P.base) },
          ],
          o(0, C),
        )
      })
      // the fallen bits come back up (the fall, rewound) and click in with the rest
      const rise = (el: HTMLElement, dx: number) => {
        add(
          el,
          [
            { offset: 0, opacity: 0, transform: pieceTf(dx * capH, 1.2 * capH, 0, 1, 1, 0) },
            { offset: 0.5, opacity: 0, transform: pieceTf(dx * capH, 1.2 * capH, 0, 1, 1, 0), easing: 'cubic-bezier(.2,.7,.3,1)' },
            { offset: 0.92, opacity: 1, transform: pieceTf(0, 0, 0, 1, 1, 0) },
            { offset: 1, opacity: 1, transform: pieceTf(0, 0, 0, 1, 1, 0) },
          ],
          o(0, C),
        )
      }
      rise(span.pieces[SMALL], -0.4)
      rise(span.arm, 0.3)
      add(span.armPath, [{ opacity: 0 }, { opacity: 0 }], o(0, C))
      // The T: the drawn one takes over from the typed one in place, sits down into the ball T's shape and runs
      // home along the low lane, growing back to ball size as it arrives.
      const R = span.runner
      const goE = bez(0.45, 0, 0.15, 1)
      const kf: Keyframe[] = []
      for (let t = 0; t <= C; t += 15) {
        const go = 1 - goE((t - 45) / 150)
        kf.push({ offset: at(C, t), transform: tPose(span, go, 1 - smooth(100, 200, t), 1 - smooth(25, 85, t)) })
      }
      kf.push({ offset: 1, transform: tPose(span, 0, 0, 0) })
      add(R, kf, o(0, C))
      add(R, [{ opacity: 0 }, { offset: at(C, 25), opacity: 1 }, { opacity: 1 }], o(0, C))
      add(span.rw, [{ opacity: 1 }, { offset: at(C, 70), opacity: 1 }, { offset: at(C, 95), opacity: 0 }, { opacity: 0 }], o(0, C))
      add(span.rb, [{ opacity: 0 }, { offset: at(C, 70), opacity: 0 }, { offset: at(C, 95), opacity: 1 }, { opacity: 1 }], o(0, C))
      add(span.L[4], [{ opacity: 0 }, { opacity: 0 }], o(0, C))
      add(span.W[4].querySelector('b'), [{ opacity: 1 }, { offset: 0.15, opacity: 1 }, { offset: 0.55, opacity: 0 }, { opacity: 0 }], o(0, T.CLOSE_W))
      // the switcher comes back only once everything has passed back over it
      add(span.veil, [{ opacity: 1 }, { opacity: 0 }], o(150, C - 150, 'ease-in'))
    } else {
      // To the wordmark (fallback): floors pull back to a piece and fly home as the rail; letters slide home.
      WORD_PIECE.forEach((_, w) => {
        const left = g.open.segX[w]
        const W0 = g.open.segW[w]
        const cy = g.open.y[w] + g.segY + g.segT / 2
        add(
          span.segs[w],
          [
            { opacity: 1, transform: barTf(u, left + W0 / 2, cy, 0, W0, g.segT), easing: EASE_IN_OUT },
            { offset: 0.6, opacity: 0, transform: railTf(span, w, 0), easing: 'cubic-bezier(.2,.6,.3,1)' },
            { opacity: 1, transform: railTf(span, w, 1) },
          ],
          o(0, C),
        )
      })
      span.L.forEach((L, i) => {
        if (i === 0) return
        add(L, [{ transform: letterPose(span, from, i) }, { transform: letterPose(span, to, i) }], o(40, C - 60, EASE_IN_OUT))
        add(L, [{ opacity: 0 }, { opacity: 1 }], o(0, 30))
        add(span.W[i].querySelector('b'), [{ opacity: 1 }, { offset: 0.15, opacity: 1 }, { offset: 0.55, opacity: 0 }, { opacity: 0 }], o(0, T.CLOSE_W))
      })
      add(span.L[0], [{ opacity: 0 }, { offset: 0.5, opacity: 0 }, { opacity: 1 }], o(0, C))
      add(span.veil, [{ opacity: 1 }, { opacity: 0 }], o(110, C - 110, 'ease-in'))
    }
    // The choreography above is drawn on a 240ms clock; play all of it CLOSE_PACE times slower.
    A.forEach((a) => {
      const fx = a.effect
      if (!fx) return
      const t = fx.getTiming()
      fx.updateTiming({ delay: (Number(t.delay) || 0) * CLOSE_PACE, duration: (Number(t.duration) || 0) * CLOSE_PACE })
    })
  }
  span.anims = A
  return A
}

/**
 * Mark each open word as pending, running or landed. A word that newly lands gets its floor grown in and its
 * word faded up (unless motion is reduced). Order of landing is up to the caller.
 */
export function setWordStates(span: Span, states: WordState[], animate = true) {
  const prev = span.ws
  span.ws = states
  states.forEach((st, i) => {
    for (const n of [span.W[i], span.segs[i], span.glows[i], span.L[i]]) {
      n.classList.toggle('pending', st === 'pending')
      n.classList.toggle('running', st === 'running')
    }
    // The piece that becomes this word's floor (and the T running to Trades) wears the floor's faint ink while
    // its word waits, so nothing drops in ink when it lands.
    const faint = st === 'landed' ? '' : 'var(--faint)'
    span.pieces[WORD_PIECE[i]].style.color = faint
    if (i === 4) span.L[4].style.color = span.runner.style.color = faint
    const landedNow = st === 'landed' && prev && prev[i] !== 'landed'
    if (!landedNow || !animate || reducedMotion() || typeof span.box.animate !== 'function') return
    const seg = span.segs[i]
    const pose = seg.style.transform
    span.anims.push(
      seg.animate([{ transform: pose.replace(/scale\(([^,]+),/, 'scale(0,') }, { transform: pose }], {
        duration: 260,
        easing: EASE,
      }),
      span.W[i].animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: T.W + 60, easing: EASE }),
      span.glows[i].animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.W + 120, easing: EASE }),
    )
  })
  // The bits that fall away belong to no word: they stay faint while anything is still waiting.
  const waiting = states.some((s) => s !== 'landed') ? 'var(--faint)' : ''
  span.pieces[SMALL].style.color = waiting
  span.arm.style.color = waiting
}

/**
 * Resolves once the open words' font is loaded, so word widths can be measured. document.fonts.ready alone can
 * resolve before the browser has even started loading a face that no text has used yet.
 */
export function whenFontsReady(span: Span): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (!fonts) return Promise.resolve()
  const family = getComputedStyle(span.el).fontFamily || 'sans-serif'
  const size = span.o.fs + 'px '
  return Promise.all([fonts.load('470 ' + size + family), fonts.load('760 ' + size + family)])
    .catch(() => undefined)
    .then(() => fonts.ready)
    .then(() => undefined)
}
