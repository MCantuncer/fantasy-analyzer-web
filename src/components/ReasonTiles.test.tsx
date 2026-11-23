import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TradeIdea } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { ReasonTiles } from './ReasonTiles'

type Fact = NonNullable<TradeIdea['facts']>[number]

const facts = [
  {
    kind: 'sell_high',
    tone: 'for',
    text: 'Owners pay more for Jaylen Brown.',
    player_id: 9,
    player_name: 'Jaylen Brown',
    owners_value: 30,
    our_value: 20,
  },
  { kind: 'chasing', tone: 'for', text: 'They are chasing a spot.' },
] as Fact[]

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

describe('ReasonTiles', () => {
  it('opens the card from the player a tile is about, with his face, and says the point once for readers', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = render(
      <ReasonTiles
        facts={facts}
        reasons={[]}
        title="Why"
        valueGet={10}
        valueGive={9}
        myCats={0.2}
        theirCats={0.1}
        rounds={null}
      />,
    )
    const tile = container.querySelector('.rt-tile') as HTMLElement
    expect(tile.querySelector('.rt-sub .pin button.pc-link-face .head')).not.toBeNull()
    expect(tile.querySelector('.sr-only')?.textContent).toBe('Owners pay more for Jaylen Brown.')
    fireEvent.click(within(tile).getByRole('button', { name: 'Jaylen Brown' }))
    expect(open).toHaveBeenCalledWith({ id: 9, name: 'Jaylen Brown' })
    // A tile about no one has no link.
    expect(container.querySelectorAll('.rt-sub')).toHaveLength(1)
  })
})
