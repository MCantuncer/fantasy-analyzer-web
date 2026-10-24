import type { PlayerBadge, PlayerRef } from '../api/client'

const LABELS: Record<PlayerBadge['kind'], string> = {
  jewel: 'Jewel',
  keystone: 'Keystone',
  fresh_signing: 'Fresh signing',
  not_for_sale: 'Not for sale',
  on_the_block: 'On the block',
}

function badgeLabel(b: PlayerBadge): string {
  return b.kind === 'keystone' && b.category ? `${LABELS.keystone} · ${b.category}` : LABELS[b.kind]
}

/** Why an owner holds on to a player. The reason shows on hover and is read by screen readers. */
export function PlayerBadges({ badges }: { badges: PlayerBadge[] | undefined }) {
  if (!badges?.length) return null
  return (
    <>
      {badges.map((b) => (
        <span key={b.kind} className={`badge owner-${b.kind}`} title={b.reason}>
          {badgeLabel(b)}
          <span className="sr-only">: {b.reason}</span>
        </span>
      ))}
    </>
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
            <span className={`badge owner-${b.kind}`}>{badgeLabel(b)}</span> {p.name}: {b.reason}
          </li>
        )),
      )}
    </ul>
  )
}
