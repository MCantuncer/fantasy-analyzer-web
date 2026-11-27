import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { game } from '../test/fixtures'
import { CallTally } from './OurCall'

afterEach(cleanup)

const call = { away: 101, home: 112, chance: 0.82 }
const final = (id: number, away: number, home: number) =>
  game({
    id,
    status: 'final',
    call,
    away: { pro_team_id: 1, abbrev: 'AAA', name: 'A A', score: away },
    home: { pro_team_id: 2, abbrev: 'BBB', name: 'B B', score: home },
  })
const later = (id: number) =>
  game({
    id,
    status: 'scheduled',
    call,
    away: { pro_team_id: 1, abbrev: 'AAA', name: 'A A', score: null },
    home: { pro_team_id: 2, abbrev: 'BBB', name: 'B B', score: null },
  })

describe('CallTally', () => {
  it('says nothing before the first final', () => {
    const { container } = render(<CallTally games={[later(1)]} today />)
    expect(container.textContent).toBe('')
  })

  it('counts tonight while games are still to finish', () => {
    const { container } = render(<CallTally games={[final(1, 100, 110), later(2)]} today />)
    expect(container.textContent).toBe('Our calls tonight 1 of 1 right · 2 pts off a team')
  })

  it('keeps "tonight" once every game is final', () => {
    const { container } = render(<CallTally games={[final(1, 100, 110), final(2, 120, 100)]} today />)
    expect(container.textContent).toBe('Our calls tonight 1 of 2 right · 9 pts off a team')
  })

  it('reads "Our calls" on past days', () => {
    const { container } = render(<CallTally games={[final(1, 100, 110)]} today={false} />)
    expect(container.textContent).toBe('Our calls 1 of 1 right · 2 pts off a team')
  })
})
