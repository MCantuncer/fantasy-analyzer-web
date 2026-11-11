import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pageName, usePageView } from './pageView'
import type { Where } from './pageView'

const base: Where = {
  signedIn: true,
  hasLeague: true,
  leagueReady: true,
  verifying: false,
  tab: 'moves',
  filmOpen: false,
}

describe('pageName', () => {
  it('names each screen', () => {
    expect(pageName({ ...base, signedIn: false })).toBe('sign-in')
    expect(pageName({ ...base, hasLeague: false })).toBe('my-leagues')
    expect(pageName({ ...base, verifying: true })).toBe('verify')
    expect(pageName(base)).toBe('moves')
    expect(pageName({ ...base, tab: 'league', filmOpen: true })).toBe('film')
    expect(pageName({ ...base, tab: 'overview', filmOpen: true })).toBe('film')
    expect(pageName({ ...base, tab: 'scores', filmOpen: true })).toBe('scores')
  })

  it('waits for the league so the default tab is not counted first', () => {
    expect(pageName({ ...base, leagueReady: false })).toBeNull()
  })
})

describe('usePageView', () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 202 })))
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('counts a page once when it opens, nothing while unsettled', () => {
    const { rerender } = renderHook(({ page }) => usePageView(page), { initialProps: { page: null as string | null } })
    expect(fetchMock).not.toHaveBeenCalled()
    rerender({ page: 'moves' })
    rerender({ page: 'moves' })
    rerender({ page: 'scores' })
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)))
    expect(bodies).toEqual([{ page: 'moves' }, { page: 'scores' }])
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/usage')
  })

  it('never throws when the server says no', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 404 })))
    expect(() => renderHook(() => usePageView('news'))).not.toThrow()
  })
})
