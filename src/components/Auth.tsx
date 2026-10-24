import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { fetchAuthConfig, signIn, signInWithGoogle, signUp } from '../api/client'
import type { AuthResult } from '../api/client'
import { loadGoogle } from '../lib/google'
import type { Theme } from '../lib/theme'

interface Props {
  theme: Theme
  onSignedIn: (result: AuthResult) => void
}

export function Auth({ theme, onSignedIn }: Props) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const config = useQuery({ queryKey: ['auth-config'], queryFn: fetchAuthConfig, staleTime: Infinity, retry: false })
  const clientId = config.data?.google_client_id ?? null

  const submit = useMutation({
    mutationFn: () => (mode === 'signup' ? signUp(email.trim(), password) : signIn(email.trim(), password)),
    onSuccess: onSignedIn,
  })
  const google = useMutation({ mutationFn: signInWithGoogle, onSuccess: onSignedIn })
  const error = submit.error ?? google.error
  const signup = mode === 'signup'

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="page-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="lead">
          {signup
            ? 'Then add your ESPN leagues and verify the teams you manage.'
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
