import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerBadge, PlayerRef } from '../api/client'
import './PlayerBadges.css'

const LABELS: Record<PlayerBadge['kind'], string> = {
  jewel: 'Jewel',
  keystone: 'Keystone',
  fresh_signing: 'Fresh signing',
  hot: 'Hot',
  not_for_sale: 'Not for sale',
  on_the_block: 'On the block',
}

function badgeLabel(b: PlayerBadge): string {
  return b.kind === 'keystone' && b.category ? `${LABELS.keystone} · ${b.category}` : LABELS[b.kind]
}

/** One 16px mark per badge, drawn on a 24px grid. */
const ICONS: Record<PlayerBadge['kind'], ReactNode> = {
  jewel: (
    <>
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M2 9h20M12 22 8 9l3-6M12 22l4-13-3-6" />
    </>
  ),
  keystone: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5V21M5 13a7 7 0 0 0 14 0M8 11H5v2M16 11h3v2" />
    </>
  ),
  hot: (
    <path
      className="pb-fill"
      d="M12 2c.6 3.2 2.6 5 4.4 7 1.6 1.8 2.6 3.7 2.6 6a7 7 0 0 1-14 0c0-1.9.7-3.4 1.7-4.6.3 1.5 1.2 2.6 2.5 2.6C9 10 10 6.5 12 2z"
    />
  ),
  fresh_signing: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  not_for_sale: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  on_the_block: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle className="pb-fill" cx="8" cy="8" r="1.5" />
    </>
  ),
}

function BadgeIcon({ kind }: { kind: PlayerBadge['kind'] }) {
  return (
    <svg className="pb-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  )
}

/**
 * A badge as a small icon after the name. Hover (or a tap on phones) shows its name and reason in a bubble;
 * a tap never reaches the row it sits in. Screen readers hear the name and reason.
 */
function BadgeMark({ badge }: { badge: PlayerBadge }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const label = badgeLabel(badge)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setTip({ x: r.left + r.width / 2, y: r.top })
  }
  const hide = () => setTip(null)

  useEffect(() => {
    if (!tip) return
    const t = window.setTimeout(hide, 2600)
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

  // Keep the bubble inside the screen on phones.
  const left = tip ? Math.min(Math.max(tip.x, 130), window.innerWidth - 130) : 0

  return (
    <>
      <span
        ref={ref}
        className={`pb-mark pb-${badge.kind}`}
        role="img"
        aria-label={`${label}: ${badge.reason}`}
        onClick={onTap}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <BadgeIcon kind={badge.kind} />
        {badge.kind === 'keystone' && badge.category && <span className="pb-cat">{badge.category}</span>}
      </span>
      {tip &&
        createPortal(
          <span className="pb-tip" role="tooltip" style={{ left, top: tip.y }}>
            <strong>{label}</strong>
            <span>{badge.reason}</span>
          </span>,
          document.body,
        )}
    </>
  )
}

/** Why an owner holds on to a player, as icons after his name. */
export function PlayerBadges({ badges }: { badges: PlayerBadge[] | undefined }) {
  if (!badges?.length) return null
  return (
    <span className="pb-marks">
      {badges.map((b) => (
        <BadgeMark key={b.kind} badge={b} />
      ))}
    </span>
  )
}

/** Badged players in a list, with the reason spelled out (for trade details, where there's room). */
export function BadgeNotes({ players }: { players: PlayerRef[] }) {
  const badged = players.filter((p) => p.badges?.length)
  if (!badged.length) return null
  return (
    <ul className="reasons badge-notes">
      {badged.flatMap((p) =>
        (p.badges ?? []).map((b) => (
          <li key={`${p.id}-${b.kind}`}>
            <span className={`pb-note pb-${b.kind}`}>
              <BadgeIcon kind={b.kind} />
              {badgeLabel(b)}
            </span>{' '}
            {p.name}: {b.reason}
          </li>
        )),
      )}
    </ul>
  )
}

/** Injury status as short red caps after the name (OUT, DTD, IR). */
const STATUS: Record<string, string> = {
  OUT: 'OUT',
  DAY_TO_DAY: 'DTD',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'SUSP',
}

export function InjuryTag({ status }: { status: string }) {
  if (status === 'ACTIVE' || status === 'NORMAL') return null
  const short = STATUS[status] ?? status.replace(/_/g, ' ')
  return (
    <span className="pb-injury" title={status.replace(/_/g, ' ').toLowerCase()}>
      {short}
    </span>
  )
}
