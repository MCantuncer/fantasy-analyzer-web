import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeLayerCount } from '../lib/escapeStack'
import { AccountMenu } from './AccountMenu'

const setup = () => {
  const onEstimates = vi.fn()
  render(
    <div>
      <p>Elsewhere on the page</p>
      <AccountMenu
        email="me@example.com"
        admin={false}
        onHealth={vi.fn()}
        onEstimates={onEstimates}
        onSignOut={vi.fn()}
      />
    </div>,
  )
  const details = document.querySelector('details.account-menu') as HTMLDetailsElement
  const openMenu = () =>
    act(() => {
      details.open = true
      details.dispatchEvent(new Event('toggle'))
    })
  return { details, openMenu, onEstimates }
}

describe('AccountMenu', () => {
  afterEach(cleanup)

  it('shows your initial in a circle, not a person icon', () => {
    setup()
    const summary = document.querySelector('details.account-menu > summary')!
    expect(summary.getAttribute('aria-label')).toBe('Account')
    expect(summary.querySelector('.account-initial')?.textContent).toBe('M')
    expect(summary.querySelector('svg')).toBeNull()
  })

  it('closes on a click or tap outside it', () => {
    const { details, openMenu } = setup()
    openMenu()
    fireEvent.pointerDown(screen.getByText('Elsewhere on the page'))
    expect(details.open).toBe(false)
  })

  it('stays open for a click inside it', () => {
    const { details, openMenu } = setup()
    openMenu()
    fireEvent.pointerDown(screen.getByText('me@example.com'))
    expect(details.open).toBe(true)
  })

  it('closes on Esc', () => {
    const { details, openMenu } = setup()
    openMenu()
    expect(escapeLayerCount()).toBe(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(details.open).toBe(false)
    act(() => {
      details.dispatchEvent(new Event('toggle'))
    })
    expect(escapeLayerCount()).toBe(0)
  })

  it('closes after picking an item', () => {
    const { details, openMenu, onEstimates } = setup()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Our Estimates' }))
    expect(onEstimates).toHaveBeenCalledTimes(1)
    expect(details.open).toBe(false)
  })
})
