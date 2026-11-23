import { Ticket } from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { couponsOf, kuponPicksOf } from '../lib/coupons'
import type { Line } from '../lib/iddaaCompare'
import './EstimateBits.css'

// Small pieces of Our Estimates that the Kupon slips, the game picks and the gap list share, so
// each section reads "how sure" and "on a Kupon" the same way.

/** "How sure", number first: "60%" in the row's type, then a short ink bar of the same value. The
 *  bar is decoration (aria-hidden): the printed % carries the number. */
export function Chance({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <span className={`ic-ch${className ? ` ${className}` : ''}`}>
      <b className="num">
        {pct}
        <small>%</small>
      </b>
      <i className="ic-ch-bar" aria-hidden="true">
        <i style={{ '--ic-ch': `${pct}%` } as CSSProperties} />
      </i>
    </span>
  )
}

/** The ticket tag on a bet that is also a leg on tonight's Kupons. It says "Kupon" by default; with
 *  `named` it names the slip ("Players Only"). Screen readers always hear which Kupon. */
export function KuponTag({ kupons, named = false }: { kupons: string[]; named?: boolean }) {
  if (!kupons.length) return null
  const all = kupons.join(' and ')
  return (
    <span className="ic-kt" title={`On ${all}`}>
      <Ticket size={14} weight="fill" aria-hidden="true" />
      {named ? <span aria-hidden="true">{kupons.join(' · ')}</span> : <i aria-hidden="true">Kupon</i>}
      <span className="sr-only">{`On the ${all} Kupon${kupons.length > 1 ? 's' : ''}`}</span>
    </span>
  )
}

/** Tonight's Kupon legs for a night's lines, by kuponKey (lib/coupons), each with the titles of the
 *  Kupons that carry it. Worked out once per night: couponsOf is a search. */
// eslint-disable-next-line react-refresh/only-export-components -- the sections share this hook with the tags
export function useKuponPicks(lines: Line[]): Map<string, string[]> {
  return useMemo(() => kuponPicksOf(couponsOf(lines)), [lines])
}
