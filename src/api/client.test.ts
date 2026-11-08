import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, fetchLeague, fetchMe, fetchScores, SCORES_TIMEOUT_MS } from './client'
import { clearToken, saveToken } from '../lib/session'

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

  it('sends the session token as a bearer header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'))
    saveToken('tok-123')
    await fetchMe()
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123')
    clearToken()
    await fetchMe()
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBeUndefined()
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

  it('asks again when Render answers 503 or the request is dropped', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 })))
    const pending = fetchLeague(1, null, null)
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('gives up on a read after a few drops', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const pending = fetchLeague(1, null, null)
    const outcome = expect(pending).rejects.toMatchObject({ code: 'network' })
    await vi.runAllTimersAsync()
    await outcome
    expect(fetchMock).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('never sends a write twice', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createPost({ leagueId: 1, season: 2027 }, 'hello', null)).rejects.toMatchObject({ code: 'network' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not ask again after a real error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(fetchLeague(1, null, null)).rejects.toMatchObject({ status: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
