import { describe, expect, it } from 'vitest'
import { ApiError, retryDropped, retryDroppedDelay } from './client'

describe('league load retry', () => {
  it('asks again after a request the phone dropped', () => {
    expect(retryDropped(0, new ApiError(0, 'network', 'Could not reach the analyzer server.'))).toBe(true)
    expect(retryDropped(1, new TypeError('Load failed'))).toBe(true)
  })

  it('asks again while the server answers 502/503 on wake-up', () => {
    expect(retryDropped(0, new ApiError(503, 'http_error', 'Request failed (HTTP 503).'))).toBe(true)
  })

  it('does not retry real answers', () => {
    expect(retryDropped(0, new ApiError(401, 'unauthorized', 'Sign in again.'))).toBe(false)
    expect(retryDropped(0, new ApiError(403, 'private_league', 'Private league.'))).toBe(false)
    expect(retryDropped(0, new ApiError(404, 'not_found', 'No such league.'))).toBe(false)
  })

  it('gives up after a few misses with the page open', () => {
    const dropped = new ApiError(0, 'network', 'Could not reach the analyzer server.')
    expect(retryDropped(3, dropped)).toBe(true)
    expect(retryDropped(4, dropped)).toBe(false)
  })

  it('backs off between tries', () => {
    expect(retryDroppedDelay(0)).toBe(1000)
    expect(retryDroppedDelay(3)).toBe(8000)
    expect(retryDroppedDelay(99)).toBe(15000)
  })
})

describe('league load after switching apps', () => {
  it('waits for the page to come back, then loads instead of failing', async () => {
    const { QueryClient, focusManager } = await import('@tanstack/react-query')
    const client = new QueryClient()
    client.mount() // listens for the page coming back, as the app's provider does
    let calls = 0
    const queryFn = () => {
      calls += 1
      // The first request is cut when the phone leaves the page.
      if (calls === 1) {
        focusManager.setFocused(false)
        return Promise.reject(new ApiError(0, 'network', 'Could not reach the analyzer server.'))
      }
      return Promise.resolve({ name: 'Chill Primera Division' })
    }
    const result = client.fetchQuery({ queryKey: ['overview'], queryFn, retry: retryDropped, retryDelay: 10 })
    await new Promise((r) => setTimeout(r, 100))
    expect(calls).toBe(1) // no retry while the page is away
    focusManager.setFocused(true)
    await expect(result).resolves.toEqual({ name: 'Chill Primera Division' })
    expect(calls).toBe(2)
    focusManager.setFocused(undefined)
    client.unmount()
  })
})
