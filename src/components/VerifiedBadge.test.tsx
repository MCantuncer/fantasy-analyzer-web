import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VerifiedBadge } from './VerifiedBadge'

afterEach(cleanup)

describe('VerifiedBadge', () => {
  it('is announced as Verified', () => {
    render(<VerifiedBadge />)
    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument()
  })

  it('shows its label on hover and hides it on leave', () => {
    render(<VerifiedBadge />)
    const seal = screen.getByRole('img', { name: 'Verified' })
    fireEvent.mouseEnter(seal)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Verified')
    fireEvent.mouseLeave(seal)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows its label on tap without triggering the row it sits in', () => {
    const onRow = vi.fn()
    render(
      <button type="button" onClick={onRow}>
        League <VerifiedBadge />
      </button>,
    )
    fireEvent.click(screen.getByRole('img', { name: 'Verified' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Verified')
    expect(onRow).not.toHaveBeenCalled()
  })
})
