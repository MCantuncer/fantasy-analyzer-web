import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import './VerifiedBadge.css'

interface Props {
  /** What the badge says on hover, on tap and to screen readers. */
  label?: string
}

/**
 * A small check-seal that marks a verified manager. Hover (or a tap on phones) shows its label in a bubble.
 * The bubble is portalled to <body> so a scrolling menu can't clip it.
 * A tap on the seal shows the bubble only; it never triggers the row it sits in.
 */
export function VerifiedBadge({ label = 'Verified' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setTip({ x: r.left + r.width / 2, y: r.top })
  }
  const hide = () => setTip(null)

  // A tapped bubble fades on its own; any scroll or resize moves the seal, so hide it then too.
  useEffect(() => {
    if (!tip) return
    const t = window.setTimeout(hide, 1800)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [tip])

  const onTap = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (tip) hide()
    else show()
  }

  return (
    <>
      <span
        ref={ref}
        className="verified-badge"
        role="img"
        aria-label={label}
        onClick={onTap}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            className="verified-badge-seal"
            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          />
          <path className="verified-badge-check" d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      </span>
      {tip &&
        createPortal(
          <span className="verified-badge-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
            {label}
          </span>,
          document.body,
        )}
    </>
  )
}
