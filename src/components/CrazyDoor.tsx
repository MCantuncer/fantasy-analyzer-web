import './CrazyDoor.css'

/** The door to Crazy One's World on Our Estimates: a 44px circle with a small moon that orbits slowly
 *  (still under reduced motion). Hover or focus lights it in Crazy One's ink and drops its label. */
export function CrazyDoor({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="cz-door" aria-label="Go to Crazy One's World" onClick={onOpen}>
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <circle className="cz-door-void" cx="13" cy="13" r="11" />
        <circle className="cz-door-ring" cx="13" cy="13" r="11" />
        <circle className="cz-door-moon" cx="18" cy="8.5" r="3" />
      </svg>
      <span className="cz-door-tip" aria-hidden="true">
        Go to Crazy One’s World <span>→</span>
      </span>
    </button>
  )
}
