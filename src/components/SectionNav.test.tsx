import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TABS } from './Report'
import { SectionNav } from './SectionNav'

afterEach(cleanup)

describe('SectionNav', () => {
  it('keeps the tab row with every section', () => {
    render(<SectionNav sections={TABS} active="moves" onSelect={() => {}} />)
    const row = screen.getByRole('tablist')
    expect(within(row).getAllByRole('tab')).toHaveLength(TABS.length)
    expect(within(row).getByRole('tab', { name: 'Moves' }).getAttribute('aria-selected')).toBe('true')
  })

  it('puts four sections on the phone bar and the rest behind More', () => {
    const onSelect = vi.fn()
    render(<SectionNav sections={TABS} active="moves" onSelect={onSelect} />)
    const bar = document.querySelector('.sn-bar') as HTMLElement
    const items = [...bar.querySelectorAll('.sn-item')].map((b) => b.textContent)
    expect(items).toEqual(['Moves', 'Trades', 'Team', 'League', 'More'])
    fireEvent.click(within(bar).getByRole('button', { name: 'More' }))
    fireEvent.click(within(bar).getByRole('button', { name: 'Scores' }))
    expect(onSelect).toHaveBeenCalledWith('scores')
  })

  it('names the open section on More when it lives there', () => {
    render(<SectionNav sections={TABS} active="news" onSelect={() => {}} />)
    const more = document.querySelector('.sn-item[aria-expanded]') as HTMLElement
    expect(more.textContent).toBe('News')
    expect(more.getAttribute('aria-current')).toBe('page')
  })

  it('shows short lists as they are', () => {
    const sections = [
      { id: 'overview', label: 'League' },
      { id: 'feed', label: 'Moves Feed' },
      { id: 'news', label: 'NBA News' },
    ]
    render(<SectionNav sections={sections} active="overview" onSelect={() => {}} />)
    expect([...document.querySelectorAll('.sn-item')].map((b) => b.textContent)).toEqual(['League', 'Feed', 'News'])
  })

  it('lights Trades for Trade For, which the segment reaches, and keeps it out of More', () => {
    const onSelect = vi.fn()
    render(<SectionNav sections={TABS} active="trade-for" onSelect={onSelect} />)
    const bar = document.querySelector('.sn-bar') as HTMLElement
    const trades = within(bar).getByRole('button', { name: 'Trades' })
    expect(trades.getAttribute('aria-current')).toBe('page')
    const more = within(bar).getByRole('button', { name: 'More' })
    expect(more.getAttribute('aria-current')).toBeNull()
    fireEvent.click(more)
    expect(within(bar).queryByRole('button', { name: 'Trade For' })).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Scores' })).toBeInTheDocument()
    // The desktop tab row still lists it.
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: 'Trade For' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('keeps Trade For on the bar when there is no Trade Park to reach it from', () => {
    const sections = [
      { id: 'moves', label: 'Moves' },
      { id: 'trade-for', label: 'Trade For' },
    ]
    render(<SectionNav sections={sections} active="trade-for" onSelect={() => {}} />)
    const item = within(document.querySelector('.sn-bar') as HTMLElement).getByRole('button', { name: 'Trade For' })
    expect(item.getAttribute('aria-current')).toBe('page')
  })
})
