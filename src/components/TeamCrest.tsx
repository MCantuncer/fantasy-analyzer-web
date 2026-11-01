import type { CSSProperties } from 'react'
import { initials } from '../lib/league'

/** A team's two-letter crest in its league colour. Decorative: the name always sits next to it. */
export function TeamCrest({ name, colour, size = 32 }: { name: string; colour: string | undefined; size?: number }) {
  const style = {
    '--team': colour ?? 'var(--muted)',
    '--crest': `${size}px`,
  } as CSSProperties
  return (
    <span className="crest num" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
