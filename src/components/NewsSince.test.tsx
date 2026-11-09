import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AFTER, BEFORE, CHANGES } from '../test/newsSince'
import { NewsSince } from './NewsSince'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const seenKey = `${AFTER.league.id}:${AFTER.team_id}:${AFTER.generated_at}`

describe('NewsSince', () => {
  it('while the moves update, shows what is already known and the progress', () => {
    render(<NewsSince changes={CHANGES} before={BEFORE} running progress={0.34} onDismiss={() => {}} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Since your last look')
    expect(screen.getByRole('status')).toHaveTextContent('Updating34%')
    expect(screen.getByRole('button', { name: /Lopez is off the board/ })).toHaveTextContent('Went to')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('leads with the moves that changed and takes you to them', () => {
    const onGo = vi.fn()
    const onDismiss = vi.fn()
    render(
      <NewsSince
        changes={CHANGES}
        before={BEFORE}
        after={AFTER}
        running={false}
        progress={1}
        onDismiss={onDismiss}
        onGo={onGo}
      />,
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('2 of your moves changed')
    const best = screen.getByRole('button', { name: /Best move/ })
    expect(best).toHaveTextContent('Add Ayo Dosunmu')
    expect(best).toHaveTextContent('was Lopez')
    expect(best).toHaveTextContent(/Lopez went to.*Baglayan BDSMs/)
    fireEvent.click(screen.getByRole('button', { name: /Trades to offer/ }))
    expect(onGo).toHaveBeenCalledWith('trades')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('keeps the rest of the league in one line that opens into lanes', () => {
    render(
      <NewsSince changes={CHANGES} before={BEFORE} after={AFTER} running={false} progress={1} onDismiss={() => {}} />,
    )
    const band = screen.getByRole('button', { name: /Around the league/ })
    expect(band).toHaveTextContent('2 hurt · 1 back · 5 moves · 68 new games')
    expect(band).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(band)
    const moves = screen.getByRole('region', { name: 'Roster moves' })
    expect(within(moves).getByText('Gergin Atamans')).toBeInTheDocument()
    expect(within(moves).getByText('Gergin Atamans added Ja Morant')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Hurt' })).toHaveTextContent('Desmond Bane is out')
    expect(screen.getByRole('region', { name: 'Box scores' })).toHaveTextContent('68')
  })

  it('says so when none of your moves changed', () => {
    render(
      <NewsSince changes={CHANGES} before={BEFORE} after={BEFORE} running={false} progress={1} onDismiss={() => {}} />,
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('None of your moves changed')
    expect(screen.queryByRole('button', { name: /Best move/ })).toBeNull()
  })

  it('folds to one line once read, and the title opens it again', () => {
    sessionStorage.setItem('news-seen', seenKey)
    render(
      <NewsSince changes={CHANGES} before={BEFORE} after={AFTER} running={false} progress={1} onDismiss={() => {}} />,
    )
    const toggle = screen.getByRole('button', { name: /2 of your moves changed/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Add Ayo Dosunmu · Get Ja Morant')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Best move/ })).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Best move/ })).toBeInTheDocument()
  })

  it('counts the card as read after it has been on screen for a few seconds', () => {
    vi.useFakeTimers()
    let seen: (entries: { isIntersecting: boolean }[]) => void = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof seen) {
          seen = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    render(
      <NewsSince changes={CHANGES} before={BEFORE} after={AFTER} running={false} progress={1} onDismiss={() => {}} />,
    )
    act(() => seen([{ isIntersecting: true }]))
    act(() => vi.advanceTimersByTime(4000))
    expect(sessionStorage.getItem('news-seen')).toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    expect(sessionStorage.getItem('news-seen')).toBe(seenKey)
    // Still unfolded while it is being read.
    expect(screen.getByRole('button', { name: /2 of your moves changed/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
