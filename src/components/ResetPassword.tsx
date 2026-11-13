import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, resetPassword } from '../api/client'
import type { AuthResult } from '../api/client'
import type { Theme } from '../lib/theme'
import { Auth } from './Auth'
import './Auth.css'

interface Props {
  /** The token from the emailed link (already taken out of the address bar). */
  token: string
  theme: Theme
  onSignedIn: (result: AuthResult) => void
  /** Leaves the reset page for the usual sign-in page. */
  onLeave: () => void
}

/** The page an emailed reset link opens: a new password, then signed in here and out everywhere else. */
export function ResetPassword({ token, theme, onSignedIn, onLeave }: Props) {
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [asking, setAsking] = useState(false)
  const reset = useMutation({ mutationFn: () => resetPassword(token, password), onSuccess: onSignedIn })
  const expired = reset.error instanceof ApiError && reset.error.code === 'bad_reset_link'

  // An old link: ask for a new one right here, on the same card.
  if (asking) return <Auth theme={theme} onSignedIn={onSignedIn} initialMode="forgot" />

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="page-title">{expired ? 'This link has expired' : 'Set a new password'}</h1>
        <p className="lead">
          {expired
            ? 'A reset link works once, for 30 minutes. Ask for a new one and use the newest email.'
            : "Pick a new password for your COURT account. You'll stay signed in here, and every other device signs out."}
        </p>
      </div>
      {expired ? (
        <button type="button" className="block" onClick={() => setAsking(true)}>
          Send a new link
        </button>
      ) : (
        <form
          className="stack auth-form"
          onSubmit={(e) => {
            e.preventDefault()
            reset.mutate()
          }}
        >
          <label className="field">
            <span>New password</span>
            <input
              type={shown ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <div className="auth-aside">
            <button type="button" className="link" aria-pressed={shown} onClick={() => setShown(!shown)}>
              {shown ? 'Hide password' : 'Show password'}
            </button>
          </div>
          <button type="submit" className="block" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Save and sign in'}
          </button>
          {reset.error && !expired && (
            <p className="small bad" role="alert">
              {reset.error.message}
            </p>
          )}
        </form>
      )}
      <p className="small muted auth-switch">
        Remembered it?{' '}
        <button type="button" className="link" onClick={onLeave}>
          Back to sign in
        </button>
      </p>
    </div>
  )
}
