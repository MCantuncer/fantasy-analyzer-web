import type { CSSProperties } from 'react'
import { initials } from '../lib/league'
import './TeamCrest.css'

// A shield with a soft top edge; drawn in a 40x44 box.
const SHIELD = 'M20 2.5 L36 7.5 Q37.5 8 37.5 9.6 L37.5 21 Q37.5 33.5 20 42 Q2.5 33.5 2.5 21 L2.5 9.6 Q2.5 8 4 7.5 Z'

/**
 * A team's two-letter crest: a die-cut shield in its league colour. Decorative: the name always
 * sits next to it. ``tilt`` gives it a slight sticker angle, for hero cards only (never in lists).
 */
export function TeamCrest({
  name,
  colour,
  size = 32,
  tilt = false,
}: {
  name: string
  colour: string | undefined
  size?: number
  tilt?: boolean
}) {
  const style = {
    '--team': colour ?? 'var(--muted)',
    '--crest': `${size}px`,
  } as CSSProperties
  return (
    <span className={tilt ? 'crest tc-tilt' : 'crest'} style={style} aria-hidden="true">
      <svg viewBox="0 0 40 44" className="tc-shield" focusable="false">
        <path d={SHIELD} strokeWidth={size < 26 ? 2.4 : 3} strokeLinejoin="round" />
      </svg>
      <span className="tc-label">{initials(name)}</span>
    </span>
  )
}
