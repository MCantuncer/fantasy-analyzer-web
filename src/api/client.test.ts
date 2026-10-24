import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchLeague, fetchScores, SCORES_TIMEOUT_MS } from './client'

describe('api client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends cookies in headers, never in the URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 1 })))
    await fetchLeague(1, null, { espnS2: 'secret-s2', swid: '{SWID}' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('secret-s2')
    expect((init?.headers as Record<string, string>)['X-ESPN-S2']).toBe('secret-s2')
    expect((init?.headers as Record<string, string>)['X-ESPN-SWID']).toBe('{SWID}')
  })

  it('turns API errors into ApiError with the server code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: 'private_league', message: 'private' } }), { status: 401 }),
    )
    await expect(fetchLeague(1, null, null)).rejects.toMatchObject({ status: 401, code: 'private_league' })
    await expect(fetchLeague(1, null, null)).rejects.toBeInstanceOf(ApiError)
  })

  it('gives up on a scores request that never answers', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = fetchScores(1, 2027, null, null, null)
    const outcome = expect(pending).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(SCORES_TIMEOUT_MS)
    await outcome
    vi.useRealTimers()
  })
})
