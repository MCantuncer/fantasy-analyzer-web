import { useLayoutEffect, useRef, useState } from 'react'
import {
  animateSpan,
  buildSpan,
  measureSpan,
  setStatic,
  whenFontsReady,
  setWordStates,
  type Span,
  type WordState,
} from '../lib/courtSpan'
import './CourtMark.css'

/*
 * The loading screen's progress: COURT itself. While the server wakes, the closed wordmark breathes in a faint
 * ink. When the league arrives the rail breaks and the words drop onto their floors, still faint; each word
 * turns solid when the part of the analysis it names is done. The running word pulses.
 */

// Largest first; the first that fits the card is used (512, 479, 325 and 285px wide).
const SIZES = [
  { u: 1.15, capH: 13, gap: 22 },
  { u: 0.875, capH: 12, gap: 22 },
  { u: 0.75, capH: 8.5, gap: 12 },
  { u: 0.65, capH: 7.4, gap: 10 },
]

export function CourtLoading({ waking, states }: { waking: boolean; states: WordState[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLSpanElement>(null)
  const span = useRef<Span | null>(null)
  const [sizeIx, setSizeIx] = useState(0)
  const opened = useRef(false)
  const latest = useRef({ waking, states })
  latest.current = { waking, states }

  // Build at the current size; step down a size if the open row is wider than the card.
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const s = buildSpan(el, { ...SIZES[sizeIx], state: latest.current.waking ? 'closed' : 'open', sizeAs: 'open' })
    span.current = s
    opened.current = !latest.current.waking
    if (opened.current) setWordStates(s, latest.current.states, false)
    const fit = () => {
      const avail = wrap.current?.clientWidth ?? 0
      const need = s.size.open[0] + 2
      el.style.transform = ''
      if (avail <= 0 || need <= avail) return
      if (sizeIx < SIZES.length - 1) setSizeIx(sizeIx + 1)
      else el.style.transform = `scale(${(avail / need).toFixed(4)})` // narrowest phones: shrink the smallest size to fit
    }
    fit()
    let alive = true
    whenFontsReady(s).then(() => {
      if (!alive) return
      measureSpan(s)
      setStatic(s, opened.current ? 'open' : 'closed')
      if (opened.current) setWordStates(s, latest.current.states, false)
      fit()
    })
    return () => {
      alive = false
      s.anims.forEach((a) => a.cancel())
      span.current = null
    }
  }, [sizeIx])

  // The league arrived: break the rail and drop the words.
  useLayoutEffect(() => {
    const s = span.current
    if (!s || waking || opened.current) return
    opened.current = true
    animateSpan(s, 'closed', 'open')
    setWordStates(s, latest.current.states, false)
  }, [waking])

  useLayoutEffect(() => {
    const s = span.current
    if (s && opened.current) setWordStates(s, states)
  }, [states])

  return (
    <div ref={wrap} className={`court-loading${waking ? ' breathing' : ''}`}>
      <span ref={host} className="court-mark" aria-hidden="true" />
    </div>
  )
}
