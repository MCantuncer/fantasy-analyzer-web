import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCrazyOne } from '../api/client'
import type { CrazyBoom, CrazyBoomRecord, CrazyGame, CrazyOne as CrazyData } from '../api/client'
import { CrazyDoor } from './CrazyDoor'
import { CrazyOne } from './CrazyOne'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchCrazyOne: vi.fn() }))
const fetchMock = vi.mocked(fetchCrazyOne)

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

const okc: CrazyGame = {
  game_id: 1,
  day: 37,
  away: 'MIN',
  home: 'OKC',
  tip: '2026-11-26T01:30:00Z',
  final: null,
  ours: { away: 111, home: 109.3, home_chance: 0.444 },
  crazy: { away: 109.5, home: 110.4, home_chance: 0.53 },
  book_home_chance: 0.558,
  swing: 0.086,
  beliefs: [{ belief: 'rivalry', team: 'OKC', points: 2.4 }],
}
const quiet: CrazyGame = {
  ...okc,
  game_id: 2,
  away: 'BOS',
  home: 'NYK',
  ours: { away: 108, home: 112, home_chance: 0.62 },
  crazy: { away: 108, home: 112, home_chance: 0.62 },
  swing: 0,
  beliefs: [],
  final: [101, 115],
  crazy_hit: true,
  ours_hit: true,
}

const ant: CrazyBoom = {
  game_id: 1,
  day: 37,
  player: 4594268,
  name: 'Anthony Edwards',
  team: 'MIN',
  opponent: 'OKC',
  home: false,
  tip: '2026-11-26T01:30:00Z',
  stat: 'pts',
  line: 26.4,
  bar: 40,
  ours: 0.1,
  crazy: 0.13,
  beliefs: [
    { belief: 'hot', value: 33.3, push: 0.018 },
    { belief: 'swings', value: 9.1, push: 0.011 },
  ],
}
const rudy: CrazyBoom = {
  ...ant,
  game_id: 2,
  player: 3032976,
  name: 'Rudy Gobert',
  team: 'NYK',
  opponent: 'BOS',
  home: true,
  stat: 'reb',
  line: 11,
  bar: 18,
  ours: 0.09,
  crazy: 0.1,
  beliefs: [{ belief: 'done_it', value: 19, push: 0.01 }],
}
const antReb: CrazyBoom = { ...ant, stat: 'reb', line: 6, bar: 11, ours: 0.06, crazy: 0.07, beliefs: [] }
const booked: CrazyBoomRecord = {
  nights: 2,
  picks: 3,
  caught: 1,
  expected: 0.3,
  edge: 0.35,
  edge_low: -0.6,
  edge_high: 1.3,
  leading: false,
  by_night: [
    {
      day: 36,
      caught: 1,
      expected: 0.2,
      picks: [
        { player: 1, name: 'Coby White', team: 'CHI', stat: 'pts', ours: 0.12, boom: true },
        { player: 2, name: 'Jalen Duren', team: 'DET', stat: 'reb', ours: 0.08, boom: false },
      ],
    },
    {
      day: 35,
      caught: 0,
      expected: 0.1,
      picks: [{ player: 3, name: 'Naz Reid', team: 'MIN', stat: 'pts', ours: 0.1, boom: false }],
    },
  ],
}

function data(over: Partial<CrazyData> = {}): CrazyData {
  return {
    season: 2027,
    day: 37,
    days: [36, 37],
    games: [quiet, okc],
    record: {
      games: 1,
      crazy_hits: 1,
      ours_hits: 1,
      edge: null,
      edge_low: null,
      edge_high: null,
      leading: false,
      bold: [],
    },
    booms: [rudy, ant, antReb],
    boom_record: booked,
    ...over,
  }
}

function show(onBack = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CrazyOne onBack={onBack} />
    </QueryClientProvider>,
  )
  return onBack
}

describe('CrazyDoor', () => {
  it('is a labelled button that opens the world', () => {
    const open = vi.fn()
    render(<CrazyDoor onOpen={open} />)
    fireEvent.click(screen.getByRole('button', { name: "Go to Crazy 1's World" }))
    expect(open).toHaveBeenCalled()
  })

  it('looks at where the hover started (reduced motion: turns without orbiting)', () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q })) as typeof window.matchMedia
    try {
      render(<CrazyDoor onOpen={vi.fn()} />)
      const door = screen.getByRole('button', { name: "Go to Crazy 1's World" })
      const moon = door.querySelector('g')!
      expect(moon.getAttribute('transform')).toBe('rotate(-42.00 13 13)')
      fireEvent.pointerEnter(door, { clientX: -20, clientY: 0, pointerType: 'mouse' })
      expect(moon.getAttribute('transform')).toBe('rotate(-180.00 13 13)')
      fireEvent.pointerLeave(door)
      fireEvent.pointerEnter(door, { clientX: 0, clientY: 20, pointerType: 'touch' })
      expect(moon.getAttribute('transform')).toBe('rotate(-180.00 13 13)')
    } finally {
      window.matchMedia = mm
    }
  })
})

describe('CrazyOne', () => {
  it('the face’s moon looks at a hovering pointer too, round the face’s own centre', async () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q })) as typeof window.matchMedia
    try {
      fetchMock.mockResolvedValue(data())
      show()
      await screen.findByText('Two players I think blow past their line tonight.')
      const face = document.querySelector('.cz-face')!
      const moon = face.querySelector('g')!
      expect(moon.getAttribute('transform')).toBe('rotate(-42.00 66 66)')
      fireEvent.pointerEnter(face, { clientX: 0, clientY: 20, pointerType: 'mouse' })
      expect(moon.getAttribute('transform')).toBe('rotate(90.00 66 66)')
    } finally {
      window.matchMedia = mm
    }
  })

  it('opens on tonight’s sky with the likeliest boom in the card, in its own voice', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    expect(await screen.findByText('Two players I think blow past their line tonight.')).toBeTruthy()
    expect(screen.getByText('Persona · not Our call')).toBeTruthy()
    const card = screen.getByRole('complementary', { name: 'Boom call: Anthony Edwards' })
    expect(card.textContent).toContain('Boom 40+')
    expect(card.textContent).toContain('Hot hand. 33.3 points a game over his last 3, on a 26.4 line.')
    expect(card.textContent).toContain('+3.0 points of chance more than Our call')
    const sky = screen.getByRole('region', { name: 'Tonight’s sky of boom calls' })
    expect(within(sky).getAllByRole('button', { name: /Our chance/ })).toHaveLength(3)
  })

  it('switches the card from a star and between his stats', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    fireEvent.click(await screen.findByRole('button', { name: /^Rudy Gobert, REB 18\+/ }))
    const card = screen.getByRole('complementary', { name: 'Boom call: Rudy Gobert' })
    expect(card.textContent).toContain('He had 19 rebounds in one of his last 10.')
    expect(within(card).queryByRole('group', { name: 'Stat' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Anthony Edwards, REB 11\+/ }))
    const both = screen.getByRole('complementary', { name: 'Boom call: Anthony Edwards' })
    fireEvent.click(within(both).getByRole('button', { name: 'PTS' }))
    expect(screen.getByRole('complementary').textContent).toContain('Boom 40+')
  })

  it('draws a belief through the calls it touches and dims the rest', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const chip = await screen.findByRole('button', { name: /^Done it lately 1/ })
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    const col = (name: RegExp) => screen.getByRole('button', { name }).closest('.cz-star-col')!
    expect(col(/^Rudy Gobert,/).className).toContain('is-lit')
    expect(col(/^Anthony Edwards, PTS/).className).toContain('is-dim')
    fireEvent.click(chip)
    expect(col(/^Anthony Edwards, PTS/).className).not.toContain('is-dim')
  })

  it('pulls a call open for its reasons, and lists the filter’s calls only', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const row = await screen.findByRole('button', { name: /Anthony Edwards.*PTS line/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(row.closest('li')!.textContent).toContain('Wild swings: His points swing by ±9.1 a night over his last 10.')
    fireEvent.click(screen.getByRole('button', { name: 'Rebounds' }))
    expect(screen.queryByRole('button', { name: /Anthony Edwards.*PTS line/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Rudy Gobert.*REB line/ })).toBeTruthy()
  })

  it('lists the games that could break and the ones it leaves to Our call, with hits in words', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const rows = (await screen.findAllByRole('listitem')).filter((li) => li.classList.contains('cz-game'))
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Upset alert')
    expect(rows[0].textContent).toContain('Other winner')
    const calm = screen.getByText('Same as Our call:').parentElement!
    expect(calm.textContent).toContain('BOS @ NYK')
    expect(calm.textContent).toContain('Crazy 1 hit')
  })

  it('shows a total belief as the total, agreeing on the winner', async () => {
    const shows: CrazyGame = {
      ...quiet,
      game_id: 3,
      final: null,
      crazy_hit: null,
      ours_hit: null,
      crazy: { away: 107.5, home: 111.5, home_chance: 0.62 },
      beliefs: [{ belief: 'one_man', team: '', points: -1 }],
    }
    fetchMock.mockResolvedValue(data({ games: [okc, shows] }))
    show()
    expect(await screen.findByText('I agree on the winner.')).toBeTruthy()
    expect(screen.getByText('Low-scoring watch')).toBeTruthy()
    expect(screen.getByText(/Two one-man shows total/)).toBeTruthy()
    expect(screen.getByText(/^Total/).textContent).toContain('220.0 → 219.0')
  })

  it('turns a belief over to its seasons', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const card = (await screen.findByText('Hot hand', { selector: 'h4' })).closest('li')!
    fireEvent.click(within(card).getByRole('button', { name: 'Turn over' }))
    expect(within(card).getByRole('table').textContent).toContain('21-22+10%')
    expect(within(card).getByRole('table').textContent).toContain('26-27 so far−5%')
    expect(within(card).getByRole('button', { name: 'Turn back' })).toBeTruthy()
    expect(screen.queryByText('Soft defense tonight')).toBeNull()
  })

  it('opens the player myths and the game myths in their own pop-ups', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const players = await screen.findByRole('button', { name: /Player myths I refuse/ })
    fireEvent.click(players)
    const sheet = screen.getByRole('dialog', { name: 'Player myths I refuse' })
    expect(within(sheet).getByText('Soft defense tonight')).toBeTruthy()
    expect(within(sheet).queryByText('Coach vs coach')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Game myths I refuse/ }))
    const games = screen.getByRole('dialog', { name: 'Game myths I refuse' })
    expect(within(games).getByText('Coach vs coach')).toBeTruthy()
    fireEvent.click(within(games).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('counts booms caught, filters the marks and reads one, and says it is too early', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const marks = await screen.findAllByRole('button', { name: /: (boomed|no boom)$/ })
    expect(marks).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Misses' }))
    expect(screen.getAllByRole('button', { name: /: (boomed|no boom)$/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'All', pressed: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Coby White PTS: boomed' }))
    expect(screen.getByText(/went way over/).textContent).toContain('Our chance said 12%')
    expect(screen.getByText(/Too early: the range still crosses zero, so what I caught/)).toBeTruthy()
  })

  it('shows an empty night and the way back', async () => {
    fetchMock.mockResolvedValue(
      data({ games: [], days: [], day: null, booms: [], boom_record: null, record: { ...data().record, games: 0 } }),
    )
    const back = show()
    expect(await screen.findByText(/No boom calls for this night yet/)).toBeTruthy()
    expect(screen.getByText(/No settled calls yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Our Estimates' }))
    expect(back).toHaveBeenCalled()
  })

  it('moves between nights', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const before = await screen.findByRole('button', { name: 'Night before' })
    expect(screen.getByRole('button', { name: 'Night after' })).toHaveProperty('disabled', true)
    fireEvent.click(before)
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(36))
  })
})
