import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCourtReveal } from '../lib/useCourtReveal'
import { CourtMark, type CourtMarkHandle } from './CourtMark'

function Brand({ onHome }: { onHome: () => void }) {
  const button = useRef<HTMLButtonElement>(null)
  const mark = useRef<CourtMarkHandle>(null)
  const reveal = useCourtReveal(mark, button)
  return (
    <>
      <button
        ref={button}
        onClick={() => {
          onHome()
          reveal.playOnce()
        }}
        onPointerEnter={reveal.onPointerEnter}
        onPointerLeave={reveal.onPointerLeave}
        aria-label="COURT, My leagues"
        aria-describedby="court-words"
      >
        <CourtMark ref={mark} veil />
      </button>
      <span id="court-words" hidden>
        Categories, Odds, Upgrades, Rosters, Trades
      </span>
    </>
  )
}

const state = (c: HTMLElement) => c.querySelector('.court-mark')?.getAttribute('data-state')

describe('CourtMark in the top bar', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('is decorative: the button carries the name, the words are read once', () => {
    const { container } = render(<Brand onHome={() => {}} />)
    const button = screen.getByRole('button', { name: 'COURT, My leagues' })
    expect(button).toHaveAccessibleDescription('Categories, Odds, Upgrades, Rosters, Trades')
    expect(container.querySelector('.court-mark')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.court-mark .w')).toHaveLength(5)
    expect(state(container)).toBe('folded')
  })

  it('navigates first, then plays the opening once and folds back', () => {
    const calls: string[] = []
    const { container } = render(<Brand onHome={() => calls.push(state(container) ?? '')} />)
    fireEvent.click(screen.getByRole('button'))
    expect(calls).toEqual(['folded']) // home ran before the mark started to open
    expect(state(container)).toBe('open')
    act(() => vi.advanceTimersByTime(2000))
    expect(state(container)).toBe('folded')
  })

  it('opens after a 140ms mouse rest and closes on leave', () => {
    const { container } = render(<Brand onHome={() => {}} />)
    const button = screen.getByRole('button')
    fireEvent.pointerEnter(button, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(100))
    expect(state(container)).toBe('folded')
    act(() => vi.advanceTimersByTime(60))
    expect(state(container)).toBe('open')
    fireEvent.pointerLeave(button, { pointerType: 'mouse' })
    expect(state(container)).toBe('folded')
  })

  it('a passing touch does not open it, and Esc closes it', () => {
    const { container } = render(<Brand onHome={() => {}} />)
    const button = screen.getByRole('button')
    fireEvent.pointerEnter(button, { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(300))
    expect(state(container)).toBe('folded')
    fireEvent.click(button)
    expect(state(container)).toBe('open')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(state(container)).toBe('folded')
  })
})
