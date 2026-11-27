import { useMoonLook } from '../lib/useMoonLook'
import './CrazyDoor.css'

/** The door to Crazy 1's World on Our Estimates: a 44px circle with a small moon that orbits slowly
 *  (still under reduced motion, where it only turns to look). When a mouse or pen comes in, the moon turns to look at where the hover
 *  started, then keeps orbiting from there. Hover or focus lights it in Crazy 1's ink and hangs its
 *  name under it. */
export function CrazyDoor({ onOpen }: { onOpen: () => void }) {
  const { moon, onPointerEnter, start } = useMoonLook(13)

  return (
    <button
      type="button"
      className="cz-door"
      aria-label="Go to Crazy 1's World"
      onClick={onOpen}
      onPointerEnter={onPointerEnter}
    >
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <circle className="cz-door-void" cx="13" cy="13" r="11" />
        <circle className="cz-door-ring" cx="13" cy="13" r="11" />
        <g ref={moon} transform={start}>
          <circle className="cz-door-moon" cx="19.7" cy="13" r="3" />
        </g>
      </svg>
      <span className="cz-door-tip" aria-hidden="true">
        Crazy 1<span>Heat Check</span>
      </span>
    </button>
  )
}
