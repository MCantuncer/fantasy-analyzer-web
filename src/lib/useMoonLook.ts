import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { START_DEG, angleAt, idle, lookAngle, nearest } from './doorLook'
import type { Look } from './doorLook'

const REDUCED = '(prefers-reduced-motion: reduce)'
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches

/** Crazy 1's moon, shared by the door and the World's face: it orbits slowly round ``pivot`` (the SVG's
 *  centre, in its own units) and, when a mouse or pen comes in, turns to look at where the hover started,
 *  then keeps orbiting from there. Under reduced motion it stays still and only turns to look; a finger's
 *  touch is ignored. Put ``moon`` on the <g> that holds the moon, drawn at 3 o'clock, and ``onPointerEnter``
 *  on the element the hover lands on. */
export function useMoonLook(pivot: number) {
  const moon = useRef<SVGGElement>(null)
  // the turn under way (or the plain orbit); null under reduced motion, where nothing moves by itself
  const look = useRef<Look | null>(null)
  const still = useRef(START_DEG)

  useEffect(() => {
    const draw = (deg: number) => moon.current?.setAttribute('transform', `rotate(${deg.toFixed(2)} ${pivot} ${pivot})`)
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
  }, [pivot])

  const onPointerEnter = (e: PointerEvent<Element>) => {
    // a finger's tap goes straight through; only a hovering pointer gets looked at
    if (e.pointerType === 'touch') return
    const box = e.currentTarget.getBoundingClientRect()
    const target = lookAngle(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2))
    if (!look.current) {
      // reduced motion: no turning, no orbit; the moon is simply looking there
      still.current = nearest(still.current, target)
      moon.current?.setAttribute('transform', `rotate(${still.current.toFixed(2)} ${pivot} ${pivot})`)
      return
    }
    const now = performance.now()
    const from = angleAt(look.current, now)
    look.current = { from, to: nearest(from, target), at: now }
  }

  return { moon, onPointerEnter, start: `rotate(${START_DEG} ${pivot} ${pivot})` }
}
