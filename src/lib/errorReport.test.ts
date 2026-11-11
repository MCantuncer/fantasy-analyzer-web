import { afterEach, beforeEach, describe as group, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { describe, pageOf, reportError, resetReports, watchErrors } from './errorReport'

group('pageOf', () => {
  it('keeps the path and tab, drops league ids and the rest', () => {
    expect(pageOf({ pathname: '/', search: '?league=744636428&season=2027&tab=moves' })).toBe('/?tab=moves')
    expect(pageOf({ pathname: '/', search: '?league=1&view=verify' })).toBe('/')
  })
})

group('describe', () => {
  it('reads an Error', () => {
    const r = describe('crash', new TypeError('x is undefined'), '/?tab=team')
    expect(r).toMatchObject({ kind: 'crash', name: 'TypeError', message: 'x is undefined', page: '/?tab=team' })
    expect(r?.stack).toContain('TypeError')
    expect(r?.build).toBe('dev')
  })

  it('reads strings and other thrown values', () => {
    expect(describe('rejection', 'nope', '/')?.message).toBe('nope')
    expect(describe('rejection', { code: 1 }, '/')?.message).toBe('{"code":1}')
  })

  it('skips API errors and browser noise', () => {
    expect(describe('rejection', new ApiError(0, 'network', 'Could not reach the analyzer server.'), '/')).toBeNull()
    expect(describe('error', 'ResizeObserver loop completed with undelivered notifications.', '/')).toBeNull()
    expect(describe('error', 'Script error.', '/')).toBeNull()
    const ext = new Error('boom')
    ext.stack = 'Error: boom\n    at chrome-extension://abc/content.js:1:1'
    expect(describe('error', ext, '/')).toBeNull()
  })
})

group('reportError', () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })))

  beforeEach(() => {
    resetReports()
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(null, '', '/?league=744636428&tab=scores')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts once per problem, without a token', () => {
    reportError('crash', new Error('boom'), '\n    at Scores')
    reportError('crash', new Error('boom'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/errors')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ kind: 'crash', name: 'Error', message: 'boom', page: '/?tab=scores' })
    expect(body.stack).toContain('at Scores')
  })

  it('sends at most ten a page load', () => {
    for (let i = 0; i < 15; i++) reportError('error', new Error(`boom ${i}`))
    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('never throws when sending fails', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('offline')
    })
    expect(() => reportError('error', new Error('boom'))).not.toThrow()
  })

  it('hears uncaught errors and rejections, not failed image loads', () => {
    const target = new EventTarget() as unknown as Window
    watchErrors(target)
    target.dispatchEvent(new ErrorEvent('error', { error: new RangeError('bad'), message: 'bad' }))
    target.dispatchEvent(new Event('error'))
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown }
    rejection.reason = new Error('lost promise')
    target.dispatchEvent(rejection)
    const kinds = fetchMock.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)).kind)
    expect(kinds).toEqual(['error', 'rejection'])
  })
})
