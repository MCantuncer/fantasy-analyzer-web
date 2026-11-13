import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Auth } from './Auth'
import { ResetPassword } from './ResetPassword'

type Handler = (path: string, body: unknown) => Response

function mockApi(handler: Handler, passwordReset = true) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/auth/config') {
      return new Response(JSON.stringify({ google_client_id: null, password_reset: passwordReset }))
    }
    return handler(path, init?.body ? JSON.parse(String(init.body)) : null)
  })
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const ME = { id: 1, email: 'can@example.com', has_google: false, leagues: [], notices: [], admin: false }

describe('Forgot password', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('is offered on sign-in only once the server can email the link', async () => {
    mockApi(() => new Response('{}'), false)
    wrap(<Auth theme="dark" onSignedIn={vi.fn()} initialMode="signin" />)
    await screen.findByRole('heading', { name: 'Welcome back' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Forgot password?' })).toBeNull())
  })

  it('asks for the email, then says the link is on its way without saying whether the account exists', async () => {
    const fetch = mockApi(() => new Response(JSON.stringify({ ok: true }), { status: 202 }))
    wrap(<Auth theme="dark" onSignedIn={vi.fn()} initialMode="signin" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Can@Example.com' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('Can@Example.com') // carried over

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText(/If/).textContent).toContain('Can@Example.com has a COURT account')
    const sent = fetch.mock.calls.find(([url]) => String(url).endsWith('/api/auth/forgot'))
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ email: 'Can@Example.com' })

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('shows the server limit when someone asks too often', async () => {
    mockApi(
      () =>
        new Response(JSON.stringify({ detail: { code: 'slow_down', message: 'Too many tries. Wait a while.' } }), {
          status: 429,
        }),
    )
    wrap(<Auth theme="dark" onSignedIn={vi.fn()} initialMode="forgot" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'can@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Too many tries. Wait a while.')
  })
})

describe('ResetPassword', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('sets the new password and signs in', async () => {
    const result = { token: 'session', me: ME }
    const fetch = mockApi(() => new Response(JSON.stringify(result)))
    const onSignedIn = vi.fn()
    wrap(<ResetPassword token={'t'.repeat(43)} theme="dark" onSignedIn={onSignedIn} onLeave={vi.fn()} />)
    const field = screen.getByLabelText('New password')
    expect(field).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    fireEvent.change(field, { target: { value: 'a new password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(onSignedIn.mock.calls[0][0]).toEqual(result)
    const sent = fetch.mock.calls.find(([url]) => String(url).endsWith('/api/auth/reset'))
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ token: 't'.repeat(43), password: 'a new password' })
  })

  it('offers a new link when this one expired or was used', async () => {
    mockApi(
      () =>
        new Response(JSON.stringify({ detail: { code: 'bad_reset_link', message: 'This link has expired.' } }), {
          status: 400,
        }),
    )
    wrap(<ResetPassword token={'t'.repeat(43)} theme="dark" onSignedIn={vi.fn()} onLeave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a new password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
  })
})
