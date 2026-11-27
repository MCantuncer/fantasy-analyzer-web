import type { CSSProperties } from 'react'
import { User } from '@phosphor-icons/react'
import { TeamCrest } from './TeamCrest'
import './YourCrest.css'

/**
 * A team crest that carries the "your team" mark as a small gold badge on its top-right corner
 * (the Standings mark), instead of an icon loose beside the name. Without ``mine`` it's a plain crest.
 */
export function YourCrest({
  name,
  colour,
  size = 32,
  mine,
}: {
  name: string
  colour: string | undefined
  size?: number
  mine: boolean
}) {
  if (!mine) return <TeamCrest name={name} colour={colour} size={size} />
  const badge = Math.max(12, Math.round(size * 0.32))
  return (
    <span className="yourcrest" style={{ '--yc': `${badge}px` } as CSSProperties}>
      <TeamCrest name={name} colour={colour} size={size} />
      <span className="yourcrest-me" role="img" aria-label="your team">
        <User weight="fill" aria-hidden="true" />
      </span>
    </span>
  )
}
