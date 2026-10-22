import { beforeEach, describe, expect, it } from 'vitest'
import { clearCredentials, isRemembered, loadCredentials, normalizeSwid, saveCredentials } from './credentials'

describe('credentials', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('keeps cookies for this tab only by default', () => {
    saveCredentials({ espnS2: ' s2 ', swid: 'ABC' }, false)
    expect(loadCredentials()).toEqual({ espnS2: 's2', swid: '{ABC}' })
    expect(isRemembered()).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it('remembers on this device only when asked', () => {
    saveCredentials({ espnS2: 's2', swid: '{ABC}' }, true)
    sessionStorage.clear()
    expect(loadCredentials()).toEqual({ espnS2: 's2', swid: '{ABC}' })
    clearCredentials()
    expect(loadCredentials()).toBeNull()
  })

  it('adds braces to a bare SWID', () => {
    expect(normalizeSwid('1234-ab')).toBe('{1234-ab}')
    expect(normalizeSwid('{1234-ab}')).toBe('{1234-ab}')
  })
})
