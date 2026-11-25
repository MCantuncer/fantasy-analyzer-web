import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSwipeToClose } from './swipeToClose'

function Sheet({ onClose, media }: { onClose: () => void; media?: string }) {
  const sheet = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  useSwipeToClose(sheet, onClose, { backdrop, media })
  return (
    <>
      <div ref={backdrop} data-testid="backdrop" />
      <div ref={sheet} data-testid="sheet">
        <div data-testid="handle">grab</div>
        <div data-testid="list" style={{ overflowY: 'auto' }}>
          <div data-testid="row">row</div>
        </div>
        <input data-testid="field" />
      </div>
    </>
  )
}

let phone = true
let reduce = false
beforeEach(() => {
  phone = true
  reduce = false
  vi.useFakeTimers()
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduced-motion') ? reduce : phone,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** jsdom has no Touch constructor: a plain event with a touches list is all the hook reads. */
function touch(el: Element, type: string, y: number, x = 100, time = 0) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] })
  Object.defineProperty(e, 'timeStamp', { value: time })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

function sized(sheet: HTMLElement, h = 600) {
  Object.defineProperty(sheet, 'offsetHeight', { configurable: true, value: h })
}

describe('useSwipeToClose', () => {
  it('follows the finger and closes when pulled far enough', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    const sheet = getByTestId('sheet')
    sized(sheet)
    touch(getByTestId('handle'), 'touchstart', 100, 100, 0)
    const move = touch(getByTestId('handle'), 'touchmove', 180, 100, 300)
    expect(move.defaultPrevented).toBe(true)
    expect(sheet.style.transform).toBe('translate3d(0, 80px, 0)')
    expect(Number(getByTestId('backdrop').style.opacity)).toBeLessThan(1)
    touch(getByTestId('handle'), 'touchmove', 280, 100, 600)
    touch(getByTestId('handle'), 'touchend', 280, 100, 650)
    expect(onClose).not.toHaveBeenCalled() // slides away first
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back after a short, slow pull', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    const sheet = getByTestId('sheet')
    sized(sheet)
    touch(getByTestId('row'), 'touchstart', 100, 100, 0)
    touch(getByTestId('row'), 'touchmove', 140, 100, 400)
    touch(getByTestId('row'), 'touchmove', 150, 100, 800)
    touch(getByTestId('row'), 'touchend', 150, 100, 820)
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet.style.transform).toBe('')
  })

  it('closes on a quick flick', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    sized(getByTestId('sheet'))
    touch(getByTestId('handle'), 'touchstart', 100, 100, 0)
    touch(getByTestId('handle'), 'touchmove', 120, 100, 16)
    touch(getByTestId('handle'), 'touchmove', 150, 100, 32)
    touch(getByTestId('handle'), 'touchend', 150, 100, 40)
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves scrolled content, sideways drags, upward drags and fields alone', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    const sheet = getByTestId('sheet')
    sized(sheet)
    const list = getByTestId('list')
    list.scrollTop = 120
    touch(getByTestId('row'), 'touchstart', 100)
    expect(touch(getByTestId('row'), 'touchmove', 300).defaultPrevented).toBe(false)
    touch(getByTestId('row'), 'touchend', 300)
    list.scrollTop = 0

    touch(getByTestId('row'), 'touchstart', 100, 100)
    expect(touch(getByTestId('row'), 'touchmove', 110, 160).defaultPrevented).toBe(false)
    touch(getByTestId('row'), 'touchend', 110)

    touch(getByTestId('row'), 'touchstart', 300)
    expect(touch(getByTestId('row'), 'touchmove', 200).defaultPrevented).toBe(false)
    // once it has gone up, coming back down in the same gesture is still a scroll
    expect(touch(getByTestId('row'), 'touchmove', 500).defaultPrevented).toBe(false)
    touch(getByTestId('row'), 'touchend', 500)

    touch(getByTestId('field'), 'touchstart', 100)
    expect(touch(getByTestId('field'), 'touchmove', 400).defaultPrevented).toBe(false)
    touch(getByTestId('field'), 'touchend', 400)

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet.style.transform).toBe('')
  })

  it('does nothing when the card is not a bottom sheet', () => {
    phone = false
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    sized(getByTestId('sheet'))
    touch(getByTestId('handle'), 'touchstart', 100)
    expect(touch(getByTestId('handle'), 'touchmove', 400).defaultPrevented).toBe(false)
    touch(getByTestId('handle'), 'touchend', 400)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes straight away with reduced motion', () => {
    reduce = true
    const onClose = vi.fn()
    const { getByTestId } = render(<Sheet onClose={onClose} />)
    sized(getByTestId('sheet'))
    touch(getByTestId('handle'), 'touchstart', 100, 100, 0)
    touch(getByTestId('handle'), 'touchmove', 400, 100, 500)
    touch(getByTestId('handle'), 'touchend', 400, 100, 520)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
