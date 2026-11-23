import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TradeModes } from './TradeModes'

afterEach(cleanup)

const phone = () => screen.getByRole('group', { name: 'Trades' })
const pressed = (group: HTMLElement) =>
  within(group)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)

describe('TradeModes', () => {
  it('gives phones all three tools in Title Case, with the open one pressed', () => {
    const onMode = vi.fn()
    render(<TradeModes mode="trade-for" onMode={onMode} />)
    expect(within(phone()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Trade Park',
      'Trade For',
      'Check a Trade',
    ])
    expect(pressed(phone())).toEqual(['Trade For'])
    fireEvent.click(within(phone()).getByRole('button', { name: 'Trade Park' }))
    expect(onMode).toHaveBeenLastCalledWith('park')
    fireEvent.click(within(phone()).getByRole('button', { name: 'Check a Trade' }))
    expect(onMode).toHaveBeenLastCalledWith('check')
  })

  it('heads Trade Park with Find Deals | Check a Trade on wider screens', () => {
    const onMode = vi.fn()
    render(<TradeModes mode="check" onMode={onMode} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Trade Park' })).toBeInTheDocument()
    const park = screen.getByRole('group', { name: 'Trade Park' })
    expect(pressed(park)).toEqual(['Check a Trade'])
    expect(pressed(phone())).toEqual(['Check a Trade'])
    fireEvent.click(within(park).getByRole('button', { name: 'Find Deals' }))
    expect(onMode).toHaveBeenLastCalledWith('park')
  })

  it('heads Trade For with a Check a Trade button, not a second segment', () => {
    const onMode = vi.fn()
    render(<TradeModes mode="trade-for" onMode={onMode} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Trade For' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Trade Park' })).toBeNull()
    const head = document.querySelector('.tmo-head') as HTMLElement
    fireEvent.click(within(head).getByRole('button', { name: 'Check a Trade' }))
    expect(onMode).toHaveBeenCalledWith('check')
  })
})
