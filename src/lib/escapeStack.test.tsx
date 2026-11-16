import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeLayerCount, pushEscapeLayer, useEscapeLayer } from './escapeStack'

const esc = () => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  act(() => {
    document.body.dispatchEvent(e)
  })
  return e
}

describe('escape stack', () => {
  afterEach(() => expect(escapeLayerCount()).toBe(0))

  it('closes only the newest layer per Esc', () => {
    const box = vi.fn()
    const card = vi.fn()
    const offBox = pushEscapeLayer(box)
    const offCard = pushEscapeLayer(card)
    expect(esc().defaultPrevented).toBe(true)
    expect(card).toHaveBeenCalledTimes(1)
    expect(box).not.toHaveBeenCalled()
    offCard()
    esc()
    expect(box).toHaveBeenCalledTimes(1)
    offBox()
    expect(esc().defaultPrevented).toBe(false)
  })

  it('leaves an Esc a field already handled', () => {
    const close = vi.fn()
    const off = pushEscapeLayer(close)
    const input = document.createElement('input')
    document.body.append(input)
    input.addEventListener('keydown', (e) => e.preventDefault())
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(close).not.toHaveBeenCalled()
    input.remove()
    off()
  })

  it('a box score behind a player card waits for the second Esc', () => {
    function Page() {
      const [box, setBox] = useState(true)
      const [card, setCard] = useState(false)
      return (
        <>
          {box && <Box onClose={() => setBox(false)} onOpenCard={() => setCard(true)} />}
          {card && <Card onClose={() => setCard(false)} />}
        </>
      )
    }
    function Box({ onClose, onOpenCard }: { onClose: () => void; onOpenCard: () => void }) {
      // Re-renders hand a new onClose each time; the layer must keep its place under the card.
      const [n, setN] = useState(0)
      useEscapeLayer(true, () => onClose())
      return (
        <div data-testid="box">
          <button onClick={() => (onOpenCard(), setN(n + 1))}>open {n}</button>
        </div>
      )
    }
    function Card({ onClose }: { onClose: () => void }) {
      useEscapeLayer(true, onClose)
      return <div data-testid="card" />
    }
    const view = render(<Page />)
    act(() => view.getByRole('button').click())
    expect(view.queryByTestId('card')).not.toBeNull()
    esc()
    expect(view.queryByTestId('card')).toBeNull()
    expect(view.queryByTestId('box')).not.toBeNull()
    esc()
    expect(view.queryByTestId('box')).toBeNull()
    view.unmount()
  })
})
