import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTabInView } from './useTabInView'

function Bar({ active }: { active: string }) {
  const ref = useTabInView(active)
  return (
    <nav ref={ref}>
      {['a', 'b'].map((id) => (
        <button key={id} role="tab" aria-selected={active === id}>
          {id}
        </button>
      ))}
    </nav>
  )
}

function fakeLayout(nav: HTMLElement, scrollWidth: number) {
  Object.defineProperty(nav, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(nav, 'clientWidth', { value: 300, configurable: true })
  nav.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect
  const [, b] = nav.querySelectorAll('button')
  b.getBoundingClientRect = () => ({ left: 500, width: 100 }) as DOMRect
  const scrollBy = vi.fn()
  nav.scrollBy = scrollBy
  return scrollBy
}

describe('useTabInView', () => {
  it('centres the selected tab when the bar overflows', () => {
    const { container, rerender } = render(<Bar active="a" />)
    const scrollBy = fakeLayout(container.querySelector('nav')!, 900)
    rerender(<Bar active="b" />)
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 400 }))
  })

  it('leaves a bar that fits alone', () => {
    const { container, rerender } = render(<Bar active="a" />)
    const scrollBy = fakeLayout(container.querySelector('nav')!, 300)
    rerender(<Bar active="b" />)
    expect(scrollBy).not.toHaveBeenCalled()
  })
})
