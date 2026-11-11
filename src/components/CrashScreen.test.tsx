import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetReports } from '../lib/errorReport'
import { CrashScreen } from './CrashScreen'

function Broken(): never {
  throw new Error('render failed')
}

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })))

beforeEach(() => {
  resetReports()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('shows the page when nothing breaks', () => {
  render(
    <CrashScreen>
      <p>All good</p>
    </CrashScreen>,
  )
  expect(screen.getByText('All good')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('shows a way back and reports a screen that fails to draw', () => {
  render(
    <CrashScreen>
      <Broken />
    </CrashScreen>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Something broke on this page')
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
  expect(body).toMatchObject({ kind: 'crash', message: 'render failed' })
  expect(body.stack).toContain('Broken')
})
