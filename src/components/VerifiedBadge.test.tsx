import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { VerifiedBadge } from './VerifiedBadge'

afterEach(cleanup)

describe('VerifiedBadge', () => {
  it('says Verified in words beside the seal, with no bubble to find', () => {
    const { container } = render(<VerifiedBadge />)
    const badge = container.querySelector('.verified-badge')!
    expect(badge.textContent).toBe('Verified')
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('[role="tooltip"], [role="img"]')).toBeNull()
  })
})
