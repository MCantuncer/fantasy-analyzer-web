import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchAnalysis, isTransient } from './client'

const running = { status: 'running', progress: 0.4, stage: 'Screening trades' }
const done = { status: 'done', progress: 1, stage: 'Done', report: { team_id: 3 } }

function reply(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body)))
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('analysis polling', () => {
  afterEach(() => {
    setHidden(false)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the same run going after a dropped poll', async () => {
    vi.useFakeTimers()
    const answers = [
      () => reply(running),
      () => Promise.reject(new TypeError('Load failed')), // the phone left the page mid-request
      () => reply(running),
      () => reply(done),
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => answers.shift()!())
    const progress = vi.fn()
    const result = fetchAnalysis(1, 3, 2027, [], null, progress)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(result).resolves.toMatchObject({ team_id: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(progress).toHaveBeenCalledWith({ progress: 0.4, stage: 'Screening trades' })
  })

  it('hands on the preview of free agents while trades are still screened', async () => {
    vi.useFakeTimers()
    const preview = { team_id: 3, pending: ['trades', 'edge_trades', 'vision_trades'], trades: [] }
    const answers = [() => reply(running), () => reply({ ...running, preview }), () => reply(done)]
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => answers.shift()!())
    const progress = vi.fn()
    const result = fetchAnalysis(1, 3, 2027, [], null, progress)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(result).resolves.toMatchObject({ team_id: 3 })
    expect(progress).toHaveBeenNthCalledWith(1, { progress: 0.4, stage: 'Screening trades' })
    expect(progress).toHaveBeenNthCalledWith(2, { progress: 0.4, stage: 'Screening trades', preview })
  })

  it('hands on the saved report and what changed since it was built', async () => {
    vi.useFakeTimers()
    const saved = { team_id: 3, pending: [], trades: [] }
    const changes = [{ kind: 'status', text: 'Jayson Tatum is out', player_id: 1, team_id: 3, mine: true }]
    const answers = [
      () => reply({ ...running, saved, changes }),
      () => reply({ ...running, changes: [] }),
      () => reply(done),
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => answers.shift()!())
    const progress = vi.fn()
    const result = fetchAnalysis(1, 3, 2027, [], null, progress)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(result).resolves.toMatchObject({ team_id: 3 })
    expect(progress).toHaveBeenNthCalledWith(1, { progress: 0.4, stage: 'Screening trades', saved, changes })
    expect(progress).toHaveBeenNthCalledWith(2, { progress: 0.4, stage: 'Screening trades' })
  })

  it('gives up only after several misses in a row with the page open', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    const result = fetchAnalysis(1, 3, 2027, [], null)
    const outcome = expect(result).rejects.toMatchObject({ code: 'network' })
    await vi.advanceTimersByTimeAsync(60_000)
    await outcome
  })

  it('stops polling while the page is hidden and asks again as soon as it is back', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply(running))
    const result = fetchAnalysis(1, 3, 2027, [], null)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    setHidden(true)
    await vi.advanceTimersByTimeAsync(1500) // the poll that was already waiting goes out
    const before = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(before)
    fetchMock.mockImplementation(() => reply(done))
    setHidden(false)
    await expect(result).resolves.toMatchObject({ team_id: 3 })
  })

  it('treats a real analysis failure as final', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      reply({ status: 'failed', progress: 0.2, stage: 'x', error: { code: 'unsupported_league', message: 'No.' } }),
    )
    await expect(fetchAnalysis(1, 3, 2027, [], null)).rejects.toMatchObject({ code: 'unsupported_league' })
  })

  it('knows which errors are worth retrying', () => {
    expect(isTransient(new ApiError(0, 'network', ''))).toBe(true)
    expect(isTransient(new ApiError(0, 'timeout', ''))).toBe(true)
    expect(isTransient(new ApiError(503, 'http_error', ''))).toBe(true)
    expect(isTransient(new ApiError(0, 'aborted', ''))).toBe(false)
    expect(isTransient(new ApiError(401, 'not_signed_in', ''))).toBe(false)
    expect(isTransient(new ApiError(403, 'not_your_team', ''))).toBe(false)
  })
})
