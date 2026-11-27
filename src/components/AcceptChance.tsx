import { Handshake } from '@phosphor-icons/react'
import { oneIn } from '../lib/chance'
import './AcceptChance.css'

/**
 * The chance they accept a trade: the handshake, its one word "Accept", and the chance as a
 * frequency, "Accept · 1 in 9". No word for the chance and no colour: the number says it.
 * The page's own class sets the size and placement.
 */
export function AcceptChance({ p, className, icon = 16 }: { p: number; className?: string; icon?: number }) {
  const n = oneIn(p)
  return (
    <span
      className={className ? `acn-chance ${className}` : 'acn-chance'}
      title="How offers like this one went in real leagues"
    >
      <span className="sr-only">chance they accept: {n}</span>
      <span className="acn-chance-k" aria-hidden="true">
        <Handshake size={icon} />
        Accept
      </span>
      <span className="acn-chance-dot" aria-hidden="true">
        ·
      </span>
      <b className="acn-chance-v num" aria-hidden="true">
        {n}
      </b>
    </span>
  )
}
