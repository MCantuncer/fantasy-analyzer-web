import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReportChange } from '../api/client'
import { NewsSince } from './NewsSince'

afterEach(cleanup)

const change = (text: string, mine = false): ReportChange => ({
  kind: 'status',
  text,
  player_id: text.length,
  team_id: mine ? 3 : 5,
  mine,
})
const changes = [
  change('Jayson Tatum is out', true),
  change('Ja Morant is day-to-day'),
  change('Team Five added Kris Dunn'),
  change('Luka Doncic is healthy again'),
  change('New stats from 37 player games'),
]

describe('NewsSince', () => {
  it('lists your news first, three at a time, while the moves update', () => {
    render(<NewsSince changes={changes} running progress={0.34} onDismiss={() => {}} />)
    expect(screen.getByRole('heading')).toHaveTextContent('News since your last look')
    expect(screen.getByRole('status')).toHaveTextContent('Updating your moves34%')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Jayson Tatum is out (your team)')
    fireEvent.click(screen.getByRole('button', { name: '2 more' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('says the moves now include the news once done, and can be dismissed', () => {
    const onDismiss = vi.fn()
    render(<NewsSince changes={changes.slice(0, 1)} running={false} progress={1} onDismiss={onDismiss} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Your moves now include this news')
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
