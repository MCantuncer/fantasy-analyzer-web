import { useDetailsMenu } from '../lib/detailsMenu'
import { useFeature } from '../lib/pro'
import { ProMark } from './Pro'
import { ProPlan } from './ProPlan'
import './AccountMenu.css'

interface Props {
  email: string | null | undefined
  admin: boolean
  onHealth: () => void
  onEstimates: () => void
  onSignOut: () => void
}

/** Your initial in a circle at the top right (an avatar: who is signed in), opening your plan, the admin pages and sign out. */
export function AccountMenu({ email, admin, onHealth, onEstimates, onSignOut }: Props) {
  const menu = useDetailsMenu()
  // The first letter or digit of the email; an account without one keeps the person outline.
  const initial = email?.match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? null
  const estimates = useFeature('estimates')
  const pick = (then: () => void) => () => {
    menu.close()
    then()
  }

  return (
    <details className="account-menu" {...menu.menuProps}>
      <summary className="icon" aria-label="Account" title={email ?? 'Account'}>
        {initial ? (
          <span className="account-initial" aria-hidden="true">
            {initial}
          </span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
            <path
              d="M3.5 15.5c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
            />
          </svg>
        )}
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
          {!estimates && <ProMark />}
        </button>
        <button type="button" className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </details>
  )
}
