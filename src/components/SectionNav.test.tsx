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
      { id: 'feed', label: 'Moves feed' },
      { id: 'news', label: 'NBA News' },
    ]
    render(<SectionNav sections={sections} active="overview" onSelect={() => {}} />)
    expect([...document.querySelectorAll('.sn-item')].map((b) => b.textContent)).toEqual(['League', 'Feed', 'News'])
  })
})
