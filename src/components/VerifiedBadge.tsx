import './VerifiedBadge.css'

interface Props {
  /** The word beside the seal. */
  label?: string
}

/**
 * A verified manager's mark: a small green check-seal and the word, so it reads on sight. It's a
 * label, not a control, so a tap goes to the row it sits in.
 */
export function VerifiedBadge({ label = 'Verified' }: Props) {
  return (
    <span className="verified-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          className="verified-badge-seal"
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        />
        <path className="verified-badge-check" d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
      {label}
    </span>
  )
}
