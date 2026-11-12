/*
 * The COURT "span": the mark that opens into Categories, Odds, Upgrades, Rosters, Trades.
 *
 * Built imperatively (DOM + Web Animations) so every move is a transform or an opacity change and React never
 * re-renders mid-animation. States: 'folded' (CT ball, phones), 'closed' (COURT wordmark, desktop) and 'open'
 * (five words, capital then lowercase, each standing on its own floor). Opening: the rail that joins C and T
 * cracks into five pieces, they fall to the floor line, and each one slides under its word and stretches to the
 * word's width.
 *
 * Geometry is on a 32-unit cap box (ink y 2..30). u = px per unit.
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

// {ID} is replaced with a unique id per glyph instance.
const G: Glyph[] = [
  {
    k: 'C',
    rest: 'ategories',
    w: 28,
    svg:
      MASK('{ID}f', FOLDED_SEAMS) +
      MASK('{ID}w', WORD_SEAMS) +
      '<g class="cf" mask="url(#{ID}f)"><path d="M25.87 23.42A14 14 0 1 1 21.42 4.13L18.77 8.37A9 9 0 1 0 21.63 20.77Z"/></g>' +
      '<g class="cw" mask="url(#{ID}w)"><path d="M23 26.72A14 14 0 1 1 24.72 7L20.89 10.21A9 9 0 1 0 19.79 22.89Z"/></g>',
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
      '<g class="tf" mask="url(#{ID})"><path d="M21 3.88A14 14 0 0 1 27.92 14.5L22.87 14.5A9 9 0 0 0 18.5 8.21Z"/><path d="M6.99 10H21.01A9 9 0 0 1 23.17 14.5H4.83A9 9 0 0 1 6.99 10Z"/><path d="M11.5 14.3H16.5V23.5H11.5Z"/></g>' +
      '<g class="tw"><path d="M0 2H20V8H13V30H7V8H0Z"/></g>',
  },
]

export const COURT_WORDS = ['Categories', 'Odds', 'Upgrades', 'Rosters', 'Trades']

const X: Record<'closed' | 'folded', number[]> = { closed: [0, 26.5, 47.5, 68.5, 84.5], folded: [0, 4, 4, 4, 0] }
const SEG = { x0: 14, len: 14.2 } // closed rail: x 14..85, five pieces of 14.2
const INK = [28, 19, 19, 19, 28] // ink height of each drawn capital, glyph units
const CAP = 0.7 // Host Grotesk cap height / font size

/** Timing in ms. Open is done at 520, close takes 200 with no stagger. */
export const T = {
  CRACK: 70,
  DROP_AT: 70,
  DROP: 80,
  SLIDE_AT: 150,
  SLIDE_STEP: 30,
  SLIDE: 210,
  LET_AT: 30,
  LET: 300,
  FOLD_FADE_AT: 120,
  FADE: 160,
  W_LAND: 120,
  W: 130,
  VEIL: 120,
  CLOSE: 200,
  CLOSE_W: 80,
  INTENT: 140,
  HOLD: 900,
}
export const OPEN_TOTAL = T.SLIDE_AT + 4 * T.SLIDE_STEP + T.W_LAND + T.W // 520

const EASE = 'cubic-bezier(.22,.8,.24,1)'
const EASE_IN_OUT = 'cubic-bezier(.4,0,.2,1)'
const EASE_DROP = 'cubic-bezier(.55,0,.85,.45)'

let GID = 0

interface Layout {
  open: { x: number[]; y: number[]; gx: number[]; tx: number[]; segX: number[]; segW: number[]; s: number[] }
  segT: number
  segY: number
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
  const glows = G.map(() => mk('glow'))
  const segs = G.map(() => mk('seg'))
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
    b.textContent = g.k
    s.append(b, g.rest)
    s.style.fontSize = o.fs + 'px'
    s.style.letterSpacing = o.track + 'em'
    return s
  })
  el.appendChild(box)
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
    G: { open: { x: [], y: [], gx: [], tx: [], segX: [], segW: [], s: [] }, segT: 3, segY: 0 },
    size: { open: [0, 0], closed: [104.5 * u, 32 * u], folded: [28 * u, 32 * u] },
    anims: [],
  }
  measureSpan(span)
  setStatic(span, o.state)
  return span
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
  let x = 0
  G.forEach((_, i) => {
    const gx = x
    const right = gx + (tw[i] || 0)
    open.x.push(x)
    open.y.push(oy)
    open.gx.push(gx)
    open.tx.push(gx)
    open.segX.push(gx - ext)
    open.segW.push(right - gx + 2 * ext)
    x = right + o.gap
  })
  span.G = { open, segT, segY }
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

const PIECE = (u: number) => SEG.len * u + 1 // base width of one piece (1px overlap: no seams)
const tf = (x: number, y: number, sx: number, sy: number) =>
  `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`

function segPose(span: Span, state: SpanState, i: number, phase?: 'crack' | 'drop', tx?: number): string {
  const u = span.o.u
  const g = span.G
  const P = PIECE(u)
  if (state === 'open') return tf(g.open.segX[i], g.open.y[i] + g.segY, g.open.segW[i] / P, g.segT / (6 * u))
  let x0: number
  let len: number
  if (state === 'folded') {
    // hidden in the C's top; when cracking they fan out between C and the moving T
    const R = tx !== undefined ? tx + 4 * u : 20 * u
    const L0 = 14 * u
    len = (R - L0) / 5
    x0 = L0 + len * i
    if (!phase) return tf(13.5 * u, 2 * u, u / P, 5 / 6)
  } else {
    len = SEG.len * u
    x0 = (SEG.x0 + SEG.len * i) * u
  }
  if (!phase) return tf(x0 - 0.5, 2 * u, (len + 1) / P, 1)
  const crackL = len * 0.62
  const crackX = x0 + (len - crackL) / 2
  if (phase === 'crack') return tf(crackX, (2 - 0.6) * u, crackL / P, 1)
  return tf(crackX, g.open.y[i] + g.segY, crackL / P, g.segT / (6 * u))
}

function letterPose(span: Span, state: SpanState, i: number): string {
  if (state === 'open') return `translate(${span.G.open.gx[i]}px, ${span.G.open.y[i]}px) scale(${span.G.open.s[i]})`
  return `translate(${X[state][i] * span.o.u}px, 0px) scale(1)`
}

const hiddenInFolded = (state: SpanState, i: number) => state === 'folded' && i > 0 && i < 4

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
    s.style.height = 6 * u + 'px'
    s.style.transform = segPose(span, state, i)
  })
  span.L.forEach((L, i) => {
    L.style.transform = letterPose(span, state, i)
    L.style.opacity = hiddenInFolded(state, i) || open ? '0' : '1'
  })
  const folded = state === 'folded'
  if (span.Tf && span.Tw) {
    span.Tf.style.opacity = folded ? '1' : '0'
    span.Tw.style.opacity = folded ? '0' : '1'
  }
  if (span.Cf && span.Cw) {
    span.Cf.style.opacity = folded ? '1' : '0'
    span.Cw.style.opacity = folded ? '0' : '1'
  }
  span.W.forEach((w, i) => {
    w.style.transform = `translate(${span.G.open.tx[i]}px, ${span.G.open.y[i]}px)`
    w.style.opacity = open ? '1' : '0'
  })
  span.glows.forEach((g) => (g.style.opacity = open ? '1' : '0'))
  if (span.veil) span.veil.style.opacity = open ? '1' : '0'
}

/** Animate from one state to another. With reduced motion it just jumps to the end state. */
export function animateSpan(span: Span, from: SpanState, to: SpanState): Animation[] {
  setStatic(span, to)
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
  const crossfade = (show: 'f' | 'w', at: number, wAt: number) => {
    const f = show === 'f' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }]
    const w = show === 'f' ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }]
    const ease = show === 'f' ? EASE_IN_OUT : EASE
    add(span.Tf, f, o(at, 140, ease))
    add(span.Cf, f, o(at, 140, ease))
    add(span.Tw, w, o(wAt, 140, ease))
    add(span.Cw, w, o(wAt, 140, ease))
  }
  if (to === 'open') {
    add(span.veil, [{ opacity: 0 }, { opacity: 1 }], o(0, T.VEIL, EASE))
    const tAt = from === 'folded' ? X.folded[4] * u + (span.G.open.gx[4] - X.folded[4] * u) * 0.3 : undefined
    span.segs.forEach((s, i) => {
      const start = T.SLIDE_AT + i * T.SLIDE_STEP
      const dur = start + T.SLIDE
      add(
        s,
        [
          { offset: 0, transform: segPose(span, from, i), easing: 'ease-out' },
          { offset: T.CRACK / dur, transform: segPose(span, from, i, 'crack', tAt), easing: EASE_DROP },
          { offset: (T.DROP_AT + T.DROP) / dur, transform: segPose(span, from, i, 'drop', tAt), easing: 'linear' },
          { offset: start / dur, transform: segPose(span, from, i, 'drop', tAt), easing: EASE },
          { offset: 1, transform: segPose(span, 'open', i) },
        ],
        o(0, dur),
      )
    })
    span.L.forEach((L, i) => {
      add(L, [{ transform: letterPose(span, from, i) }, { transform: letterPose(span, 'open', i) }], o(T.LET_AT, T.LET, EASE))
      // One opacity track per letter: (O U R fade in from the folded mark,) stay, then hand over to the typed initial.
      const land = T.SLIDE_AT + i * T.SLIDE_STEP + T.W_LAND
      const end = land + T.W
      const kf: Keyframe[] = hiddenInFolded(from, i)
        ? [
            { offset: 0, opacity: 0 },
            { offset: T.FOLD_FADE_AT / end, opacity: 0, easing: EASE },
            { offset: (T.FOLD_FADE_AT + T.FADE) / end, opacity: 1 },
          ]
        : [{ offset: 0, opacity: 1 }]
      kf.push({ offset: land / end, opacity: 1, easing: EASE }, { offset: 1, opacity: 0 })
      add(L, kf, o(0, end))
    })
    if (from === 'folded') crossfade('w', T.LET_AT, T.LET_AT)
    G.forEach((_, i) => {
      const d = T.SLIDE_AT + i * T.SLIDE_STEP + T.W_LAND
      const w = span.W[i]
      add(
        w,
        [
          { opacity: 0, transform: `translate(${span.G.open.tx[i] - 0.35 * span.o.capH}px, ${span.G.open.y[i]}px)` },
          { opacity: 1, transform: w.style.transform },
        ],
        o(d, T.W, EASE),
      )
      add(span.glows[i], [{ opacity: 0 }, { opacity: 1 }], o(d, T.W + 60, EASE))
    })
  } else {
    ;[...span.W, ...span.glows].forEach((n) => add(n, [{ opacity: 1 }, { opacity: 0 }], o(0, T.CLOSE_W, 'ease-in')))
    const tAt = to === 'folded' ? X.folded[4] * u + (span.G.open.gx[4] - X.folded[4] * u) * 0.12 : undefined
    span.segs.forEach((s, i) =>
      add(
        s,
        [
          { offset: 0, transform: segPose(span, 'open', i), easing: EASE_IN_OUT },
          { offset: 0.42, transform: segPose(span, to, i, 'drop', tAt), easing: 'ease-out' },
          { offset: 0.82, transform: segPose(span, to, i, 'crack', tAt), easing: 'ease-in' },
          { offset: 1, transform: segPose(span, to, i) },
        ],
        o(0, T.CLOSE),
      ),
    )
    span.L.forEach((L, i) => {
      add(L, [{ transform: letterPose(span, from, i) }, { transform: letterPose(span, to, i) }], o(20, 170, EASE_IN_OUT))
      if (!hiddenInFolded(to, i)) add(L, [{ opacity: 0 }, { opacity: 1 }], o(0, 80))
    })
    add(span.veil, [{ opacity: 1 }, { opacity: 0 }], o(60, 140, 'ease-in'))
    if (to === 'folded') crossfade('f', 60, 40)
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
