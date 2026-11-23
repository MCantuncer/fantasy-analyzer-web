import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  createPost,
  fetchLeague,
  fetchMe,
  fetchSample,
  fetchSampleTeam,
  fetchShop,
  fetchTarget,
  fetchScores,
  SCORES_TIMEOUT_MS,
  signIn,
  signUp,
} from './client'
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

  it('asks again when a sign-in is dropped', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 't' })))
    const pending = signIn('me@example.com', 'secret')
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toEqual({ token: 't' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('never sends a sign-up twice', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(signUp('me@example.com', 'secret')).rejects.toMatchObject({ code: 'network' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

  it('reads the sample league as a plain GET, without the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'))
    saveToken('tok-123')
    await fetchSample()
    await fetchSampleTeam(3, '2026-11-12')
    clearToken()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/sample$/)
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/sample\/teams\/3\?day=2026-11-12$/)
    for (const call of fetchMock.mock.calls) expect(call[1]).toBeUndefined()
  })

  it('says sample_off when there is no sample league', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: 'sample_off', message: 'none' } }), { status: 404 }),
    )
    await expect(fetchSample()).rejects.toMatchObject({ status: 404, code: 'sample_off' })
  })

  it('asks for the sample again when Render drops it', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_team_id: 3 })))
    const sample = fetchSample()
    await vi.runAllTimersAsync()
    await expect(sample).resolves.toMatchObject({ default_team_id: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('sends shop ids sorted, so the same picks in another order hit the same cached report', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'))
    const offer = [30, 4, 12]
    await fetchShop(1, 3, 2027, offer, [9, 2], null)
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.offer_player_ids).toEqual([4, 12, 30])
    expect(body.keep_player_ids).toEqual([2, 9])
    expect(offer).toEqual([30, 4, 12])
  })

  it('cancels a stale shop search through the caller signal, without asking again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const controller = new AbortController()
    const pending = fetchShop(1, 3, 2027, [4], [], null, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts a Trade For search in flight when the caller gives up', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const controller = new AbortController()
    const pending = fetchTarget(1, 3, 2027, 77, [], null, controller.signal)
    const signal = fetchMock.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
    expect(signal?.aborted).toBe(true)
  })

  it('stops waiting to ask again once the caller gives up', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const controller = new AbortController()
    const pending = fetchShop(1, 3, 2027, [4], [], null, controller.signal)
    const outcome = expect(pending).rejects.toMatchObject({ code: 'aborted' })
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await outcome
    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
