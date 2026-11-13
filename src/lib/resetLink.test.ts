import { afterEach, describe, expect, it } from 'vitest'
import { readResetToken } from './resetLink'

describe('readResetToken', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('takes the token from the link and out of the address bar', () => {
    const token = 'Ab_-'.repeat(11)
    window.history.replaceState(null, '', `/?tab=moves#reset=${token}`)
    expect(readResetToken()).toBe(token)
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?tab=moves')
  })

  it('ignores other links and a mangled token', () => {
    window.history.replaceState(null, '', '/#top')
    expect(readResetToken()).toBeNull()
    expect(window.location.hash).toBe('#top')
    window.history.replaceState(null, '', '/#reset=short')
    expect(readResetToken()).toBeNull()
    expect(window.location.hash).toBe('')
  })
})
