import { IdentificationBadge } from '@phosphor-icons/react'
import './VerifyBanner.css'

/** A quiet invite above a league page: a question, what picking a team gives, and one button. */
export function VerifyBanner({
  detail,
  action,
  onClick,
}: {
  detail: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="vb">
      <IdentificationBadge className="vb-icon" size={22} aria-hidden="true" />
      <p className="vb-text">
        <span className="vb-lead">Manage a team here?</span> <span className="vb-detail">{detail}</span>
      </p>
      <button type="button" className="vb-action" onClick={onClick}>
        {action}
      </button>
    </div>
  )
}
