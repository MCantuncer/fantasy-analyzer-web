import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeepRowInView } from './useKeepRowInView'

// jsdom has no layout, so each row reports a top that depends on whether row 0 is open.
function List() {
  const [open, setOpen] = useState<number | null>(0)
  const keepRow = useKeepRowInView(open)
  return (
    <ol onClickCapture={keepRow}>
      {[0, 1].map((i) => (
        <li key={i}>
          <button
            type="button"
            className="move-row"
            data-i={i}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            row {i}
          </button>
        </li>
      ))}
    </ol>
  )
}

function layout(container: HTMLElement, rowTop: (i: number, open0: boolean) => number) {
  container.querySelectorAll<HTMLButtonElement>('.move-row').forEach((b) => {
    b.getBoundingClientRect = () => {
      const open0 = container.querySelector('[data-i="0"]')!.getAttribute('aria-expanded') === 'true'
      const top = rowTop(Number(b.dataset.i), open0)
      return { top, bottom: top + 60 } as DOMRect
    }
  })
}

afterEach(() => vi.restoreAllMocks())

describe('useKeepRowInView', () => {
  it('keeps the tapped row in place when the open row above closes', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    const { container } = render(<List />)
    // Row 1 sits at 300px while row 0's 900px of details are open, at -600px once they close.
    layout(container, (i, open0) => (i === 0 ? -1000 : open0 ? 300 : -600))
    fireEvent.click(container.querySelector('[data-i="1"]')!)
    expect(scrollBy).toHaveBeenCalledWith(0, -900)
  })

  it('does nothing when a row closes in place', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { container } = render(<List />)
    layout(container, (i) => 100 + i * 60)
    fireEvent.click(container.querySelector('[data-i="0"]')!)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('scrolls an opened row up when its details would start below the screen', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    const { container } = render(<List />)
    layout(container, (i) => (i === 0 ? 100 : 700))
    fireEvent.click(container.querySelector('[data-i="1"]')!)
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 692 }))
  })
})
