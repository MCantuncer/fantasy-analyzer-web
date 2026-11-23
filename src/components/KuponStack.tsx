import { CaretRight } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { fmtOdds } from '../lib/coupons'
import type { CouponKind, CouponSlot } from '../lib/coupons'
import './KuponStack.css'

/** Tonight's Kupons on phones and small tablets (The Slip Rail, under 900px): the same slips as the
 *  desktop rail, as a stack. The front slip is whole; every other Kupon sits tucked under it as an
 *  edge you tap to bring forward. Kupons.tsx draws the slips and marks; this only orders them. */

/** Which Kupon is in front, remembered per viewer. */
export const FRONT_KEY = 'ic-ku-open'

function remembered(): string | null {
  try {
    return localStorage.getItem(FRONT_KEY)
  } catch {
    return null
  }
}

function remember(kind: CouponKind) {
  try {
    localStorage.setItem(FRONT_KEY, kind)
  } catch {
    // private window or blocked storage: the stack still works, it just forgets
  }
}

const pctOf = (v: number) => Math.round(v * 100)

/** Runs a swap as a View Transition (250ms, KuponStack.css) where the browser has one and motion is
 *  welcome; under reduced motion, or without the API, it happens at once. */
function swap(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (still || typeof doc.startViewTransition !== 'function') {
    update()
    return
  }
  doc.startViewTransition(update)
}

export function KuponStack({
  slots,
  twin = null,
  slip,
  icon,
}: {
  /** The slips in Can's fixed order (Matches Only already folded into Highest Confidence while the same). */
  slots: CouponSlot[]
  /** Matches Only while it has Highest Confidence's picks: it rides on that slip, edge included. */
  twin?: CouponSlot | null
  /** Draws one slip as an `<li id="ic-ku-{kind}">`, hidden unless it is the front one. */
  slip: (slot: CouponSlot, hidden: boolean) => ReactNode
  icon: (kind: CouponKind) => ReactNode
}) {
  const [picked, setPicked] = useState<string | null>(remembered)
  const [moved, setMoved] = useState(false)
  // A remembered Matches Only that is riding on Highest Confidence tonight opens that slip.
  const want = twin && picked === twin.spec.kind ? 'safe' : picked
  const front = slots.find((s) => s.spec.kind === want) ?? slots[0]
  if (!front) return null
  const edges = slots.filter((s) => s !== front)

  const bring = (kind: CouponKind) => {
    remember(kind)
    swap(() => {
      flushSync(() => {
        setPicked(kind)
        setMoved(true)
      })
      // Focus follows the slip to the front: its heading, so the next Tab walks its picks.
      const h = document.getElementById(`ic-ku-${kind}`)?.querySelector<HTMLElement>('h3')
      if (!h) return
      h.tabIndex = -1
      h.focus()
    })
  }

  return (
    <div className={`ic-ks${moved ? ' moved' : ''}`}>
      <ol className="ic-ks-slips">{slots.map((s) => slip(s, s !== front))}</ol>
      {edges.length > 0 && (
        <ul className="ic-ks-edges" aria-label="Other Kupons">
          {edges.map((s, i) => (
            <li key={s.spec.kind} className={`ic-ks-at${Math.min(i + 1, 3)}`} style={{ zIndex: edges.length - i }}>
              <Edge slot={s} also={s.spec.kind === 'safe' && twin ? twin : null} icon={icon} onPick={bring} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One tucked Kupon: its name, and its total odds and probability (or why it isn't on tonight). */
function Edge({
  slot,
  also,
  icon,
  onPick,
}: {
  slot: CouponSlot
  also: CouponSlot | null
  icon: (kind: CouponKind) => ReactNode
  onPick: (kind: CouponKind) => void
}) {
  const { spec, coupon: c } = slot
  const name = also ? `${spec.title} and ${also.spec.title}` : spec.title
  const wait = !c && slot.why === 'waiting'
  let value: ReactNode
  let words: string
  if (!c) {
    value = wait ? (
      <>
        At <b className="num">19:00</b>
      </>
    ) : (
      'Not tonight'
    )
    words = wait ? 'player bets at 19:00' : 'not tonight'
  } else if (c.result) {
    const won = c.result === 'won'
    value = (
      <>
        <b className="num">{fmtOdds(won ? c.odds : c.listed)}</b> odds ·{' '}
        <b className={won ? 'ok' : 'no'}>{won ? 'Won' : 'Lost'}</b>
      </>
    )
    words = `${fmtOdds(won ? c.odds : c.listed)} odds, ${won ? 'won' : 'lost'}`
  } else {
    value = (
      <>
        <b className="num">{fmtOdds(c.listed)}</b> odds · <b className="num">~{pctOf(c.chance)}%</b>
      </>
    )
    words = `${fmtOdds(c.listed)} odds, about ${pctOf(c.chance)}%`
  }
  return (
    <button
      type="button"
      className="ic-ks-edge"
      aria-controls={`ic-ku-${spec.kind}`}
      aria-expanded={false}
      aria-label={`${name}, ${words}. Bring to the front`}
      onClick={() => onPick(spec.kind)}
    >
      <span className="ico">{icon(spec.kind)}</span>
      <span className="en">
        {spec.title}
        {also && <small>+ {also.spec.title}</small>}
      </span>
      <span className="ev">{value}</span>
      <CaretRight className="cv" size={16} aria-hidden="true" />
    </button>
  )
}
