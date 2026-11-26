import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { START_DEG, angleAt, idle, lookAngle, nearest } from '../lib/doorLook'
import type { Look } from '../lib/doorLook'
import './CrazyDoor.css'

const REDUCED = '(prefers-reduced-motion: reduce)'
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches

/** The door to Crazy One's World on Our Estimates: a 44px circle with a small moon that orbits slowly
 *  (still under reduced motion, where it only turns to look). When a mouse or pen comes in, the moon turns to look at where the hover
 *  started, then keeps orbiting from there. Hover or focus lights it in Crazy One's ink and drops its
 *  label. */
export function CrazyDoor({ onOpen }: { onOpen: () => void }) {
  const moon = useRef<SVGGElement>(null)
  // the turn under way (or the plain orbit); null under reduced motion, where nothing moves by itself
  const look = useRef<Look | null>(null)
  const still = useRef(START_DEG)

  const draw = (deg: number) => moon.current?.setAttribute('transform', `rotate(${deg.toFixed(2)} 13 13)`)

  useEffect(() => {
    if (reduced()) {
      draw(START_DEG)
      return
    }
    look.current = idle(performance.now())
    let frame = 0
    const tick = (now: number) => {
      if (look.current) draw(angleAt(look.current, now))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const onEnter = (e: PointerEvent<HTMLButtonElement>) => {
    // a finger's tap opens the World straight away; only a hovering pointer gets looked at
    if (e.pointerType === 'touch') return
    const box = e.currentTarget.getBoundingClientRect()
    const target = lookAngle(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2))
    if (!look.current) {
      // reduced motion: no turning, no orbit; the moon is simply looking there
      still.current = nearest(still.current, target)
      draw(still.current)
      return
    }
    const now = performance.now()
    const from = angleAt(look.current, now)
    look.current = { from, to: nearest(from, target), at: now }
  }

  return (
    <button
      type="button"
      className="cz-door"
      aria-label="Go to Crazy One's World"
      onClick={onOpen}
      onPointerEnter={onEnter}
    >
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <circle className="cz-door-void" cx="13" cy="13" r="11" />
        <circle className="cz-door-ring" cx="13" cy="13" r="11" />
        <g ref={moon} transform={`rotate(${START_DEG} 13 13)`}>
          <circle className="cz-door-moon" cx="19.7" cy="13" r="3" />
        </g>
      </svg>
      <span className="cz-door-tip" aria-hidden="true">
        Go to Crazy One’s World <span>→</span>
      </span>
    </button>
  )
}
