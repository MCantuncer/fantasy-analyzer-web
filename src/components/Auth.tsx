import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { fetchAuthConfig, forgotPassword, signIn, signInWithGoogle, signUp } from '../api/client'
import type { AuthResult } from '../api/client'
import { loadGoogle } from '../lib/google'
import type { Theme } from '../lib/theme'
import './Auth.css'

export type AuthMode = 'signup' | 'signin' | 'forgot'

interface Props {
  theme: Theme
  onSignedIn: (result: AuthResult) => void
  /** Open on sign-in (the top bar's Sign in) or on asking for a reset link, instead of sign-up. */
  initialMode?: AuthMode
  /** The sign-up page's second line, when the next step is already known (a league pasted first). */
  lead?: string
}

export function Auth({ theme, onSignedIn, initialMode = 'signup', lead }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const config = useQuery({ queryKey: ['auth-config'], queryFn: fetchAuthConfig, staleTime: Infinity, retry: false })
  const clientId = config.data?.google_client_id ?? null
  // Shown only once the server can email the link (RESEND_API_KEY set).
  const canReset = config.data?.password_reset ?? false
  const forgot = useMutation({ mutationFn: (address: string) => forgotPassword(address) })

  const submit = useMutation({
    mutationFn: () => (mode === 'signup' ? signUp(email.trim(), password) : signIn(email.trim(), password)),
    onSuccess: onSignedIn,
  })
  const google = useMutation({ mutationFn: signInWithGoogle, onSuccess: onSignedIn })
  const error = submit.error ?? google.error
  const signup = mode === 'signup'

  function backToSignIn() {
    forgot.reset()
    submit.reset()
    setMode('signin')
  }

  if (mode === 'forgot') {
    const sentTo = forgot.isSuccess ? forgot.variables : null
    return (
      <div className="auth">
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="page-title">{sentTo ? 'Check your email' : 'Reset your password'}</h1>
          <p className="lead" aria-live="polite">
            {sentTo ? (
              <>
                If <b className="auth-sent-to">{sentTo}</b> has a COURT account, a link to set a new password is on
                its way. It works once, for 30 minutes.
              </>
            ) : (
              "Enter your account's email and we'll send you a link to set a new password."
            )}
          </p>
        </div>
        {sentTo ? (
          <p className="small muted auth-resend">
            Nothing after a few minutes? Check your spam folder, or{' '}
            <button type="button" className="link" onClick={() => forgot.reset()}>
              try another email
            </button>
            .
          </p>
        ) : (
          <form
            className="stack auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              forgot.mutate(email.trim())
            }}
          >
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" className="block" disabled={forgot.isPending}>
              {forgot.isPending ? 'Sending…' : 'Send reset link'}
            </button>
            {forgot.error && (
              <p className="small bad" role="alert">
                {forgot.error.message}
              </p>
            )}
          </form>
        )}
        <p className="small muted auth-switch">
          Remembered it?{' '}
          <button type="button" className="link" onClick={backToSignIn}>
            Back to sign in
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="page-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="lead">
          {signup
            ? (lead ?? 'Then add your ESPN leagues and verify the teams you manage.')
            : 'Sign in to see your leagues and teams.'}
        </p>
      </div>
      <form
        className="stack auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit.mutate()
        }}
      >
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={signup ? 'At least 8 characters' : undefined}
          />
        </label>
        {!signup && canReset && (
          <div className="auth-aside">
            <button
              type="button"
              className="link"
              onClick={() => {
                submit.reset()
                setMode('forgot')
              }}
            >
              Forgot password?
            </button>
          </div>
        )}
        <button type="submit" className="block" disabled={submit.isPending}>
          {submit.isPending ? (signup ? 'Creating…' : 'Signing in…') : signup ? 'Create account' : 'Sign in'}
        </button>
        {error && (
          <p className="small bad" role="alert">
            {error.message}
          </p>
        )}
      </form>
      {clientId && (
        <>
          <div className="or" aria-hidden="true">
            or
          </div>
          <GoogleButton clientId={clientId} theme={theme} onCredential={(c) => google.mutate(c)} />
        </>
      )}
      <p className="small muted auth-switch">
        {signup ? 'Have an account? ' : 'New here? '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(signup ? 'signin' : 'signup')
            submit.reset()
          }}
        >
          {signup ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  )
}

function GoogleButton({
  clientId,
  theme,
  onCredential,
}: {
  clientId: string
  theme: Theme
  onCredential: (credential: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    callback.current = onCredential
  })
  useEffect(() => {
    let live = true
    loadGoogle()
      .then((id) => {
        if (!live || !el.current) return
        id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential) })
        id.renderButton(el.current, {
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(el.current.offsetWidth || 340, 400),
        })
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [clientId, theme])
  if (failed) return <p className="small muted">Google sign-in couldn't load. Use your email instead.</p>
  return <div ref={el} className="google-button" />
}
