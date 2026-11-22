import { useDetailsMenu } from '../lib/detailsMenu'
import { ProPlan } from './ProPlan'

interface Props {
  email: string | null | undefined
  admin: boolean
  onHealth: () => void
  onEstimates: () => void
  onSignOut: () => void
}

/** The person icon at the top right: who is signed in, their plan, the admin pages and sign out. */
export function AccountMenu({ email, admin, onHealth, onEstimates, onSignOut }: Props) {
  const menu = useDetailsMenu()
  const pick = (then: () => void) => () => {
    menu.close()
    then()
  }

  return (
    <details className="account-menu" {...menu.menuProps}>
      <summary className="icon" aria-label="Account" title={email ?? 'Account'}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path
            d="M3.5 15.5c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      </summary>
      <div className="account-pop card stack">
        <span className="small muted">Signed in as</span>
        <strong className="account-email">{email ?? 'Google account'}</strong>
        <ProPlan onPick={menu.close} />
        {admin && (
          <button type="button" className="secondary" onClick={pick(onHealth)}>
            Site health
          </button>
        )}
        <button type="button" className="secondary" onClick={pick(onEstimates)}>
          Our Estimates
        </button>
        <button type="button" className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </details>
  )
}
