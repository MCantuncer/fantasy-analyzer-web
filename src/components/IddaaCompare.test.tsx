import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import type { BookCompare, CompareGame, ComparePlayer } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { IddaaCompare } from './IddaaCompare'
import { ProProvider } from './Pro'

const PRO: Me = {
  id: 1,
  email: 'can@example.com',
  has_google: false,
  leagues: [],
  notices: [],
  admin: true,
  plan: 'pro',
  features: ['estimates'],
  gifted: false,
  payment_due: false,
}

/** Opens the game filter and picks a game, the way a person would. */
const pickGame = (sec: HTMLElement, name: RegExp) => {
  fireEvent.click(within(sec).getByRole('combobox', { name: 'Game' }))
  fireEvent.click(within(sec).getByRole('option', { name }))
}

const game = (id: number, status: CompareGame['status'], tip: string): CompareGame => ({
  game_id: id,
  away: 'IND',
  home: 'NY',
  tip,
  checked: '',
  status,
  away_score: null,
  home_score: null,
  markets: [],
  players: [],
})

function night(games: CompareGame[]): BookCompare {
  return {
    season: 2027,
    day: 34,
    date: '2026-11-22',
    days: [33, 34],
    nights: [
      { day: 33, date: '2026-11-21', games: 6 },
      { day: 34, date: '2026-11-22', games: 7 },
    ],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: '2026-11-22T21:33:00Z', ok: true, error: null, games: 4, matched: 4 },
    games,
    tally: [],
  }
}

function mount(data: BookCompare, onHealth?: () => void) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url).includes('/api/book-compare/record')
      ? new Response('{}', { status: 404 })
      : new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
  )
  const onBack = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
        <IddaaCompare onBack={onBack} onHealth={onHealth} />
      </ProProvider>
    </QueryClientProvider>,
  )
  return { onBack }
}

describe('Our Estimates head', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has Back, the title, How to read and Site health, and no intro paragraph', async () => {
    const onHealth = vi.fn()
    const { onBack } = mount(night([]), onHealth)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Site health' }))
    expect(onHealth).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'Our Estimates' })).toBeTruthy()
    expect(screen.queryByText(/never feeds our model/)).toBeNull()
    // One How to read per layout (wide in row 1, phone in row 2); CSS shows one of them.
    const how = screen.getAllByRole('button', { name: 'How to read' })
    expect(how).toHaveLength(2)
    await screen.findByRole('tablist', { name: 'Night' })
    fireEvent.click(how[0])
    expect(screen.getByRole('dialog', { name: 'How to read' }).textContent).toContain('never feeds our model')
  })

  it('leaves Site health out for non-admins', () => {
    mount(night([]))
    expect(screen.queryByRole('button', { name: 'Site health' })).toBeNull()
  })

  it('puts the nights and one meta line in the second row, and the last look in the foot', async () => {
    mount(
      night([
        game(1, 'final', '2026-11-22T19:00:00Z'),
        game(2, 'scheduled', '2026-11-22T22:30:00Z'),
        game(3, 'scheduled', '2026-11-22T22:00:00Z'),
      ]),
    )
    const tabs = await screen.findByRole('tablist', { name: 'Night' })
    const head = tabs.closest('.ic-head') as HTMLElement
    expect(within(tabs).getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toContain('Tonight')
    const meta = head.querySelector('.ic-meta') as HTMLElement
    expect(meta.textContent).toMatch(/^2 of 3 games to come/)
    expect(meta.textContent).toContain('First tip')
    expect(meta.textContent).toContain('Last look')
    expect(screen.getByText(/Last look at iddaa/).textContent).toMatch(/worked · 4 of 4 games matched$/)
    expect(document.querySelector('.ic-bands')).toBeNull()
  })

  it('says when the last look failed', async () => {
    const data = night([game(1, 'scheduled', '2026-11-22T22:00:00Z')])
    data.look = { ...data.look, ok: false, error: 'iddaa timed out' }
    mount(data)
    expect((await screen.findByText(/Last look at iddaa/)).textContent).toMatch(/failed: iddaa timed out$/)
  })
})

describe('Game picks', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const odds2 = (a: number, b: number) => [
    { side: 'pick' as const, odd: a },
    { side: 'other' as const, odd: b },
  ]
  const mk = (
    market: 'winner' | 'margin' | 'total',
    team: string,
    ours: number,
    book: number,
    odds: { side: 'pick' | 'other' | 'over' | 'under'; odd: number }[],
  ) => ({ market, team, book_team: team, won: '', ours, book, actual: null, gap: ours - book, ours_hit: null, book_hit: null, closer: null, odds })

  it('draws one match: the bets as lanes on number lines, our chance as a ring, No bet as one quiet line', async () => {
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.markets = [
      mk('winner', 'NY', 0.64, 0.58, odds2(1.3, 3.4)),
      mk('margin', 'NY', 2, 4.5, odds2(1.87, 1.93)),
      mk('total', '', 230, 226.5, [
        { side: 'under', odd: 1.9 },
        { side: 'over', odd: 1.9 },
      ]),
    ]
    mount(night([g]))
    const section = (await screen.findByRole('heading', { level: 2, name: 'Game picks' })).closest('section')!
    expect(section.querySelector('.ic-gp-sm')!.textContent).toBe('2 bets · 1 no bet')
    const card = within(section).getByRole('article', { name: 'IND at NY' })
    const lanes = [...card.querySelectorAll('.ic-gs-lanes > .ic-gs-lane')]
    expect(lanes.map((r) => r.querySelector('.ml')!.textContent)).toEqual(['Handicap', 'Total points', 'Match result'])
    expect(lanes[0].querySelector('.bt')!.textContent).toBe('IND +4.5')
    expect(lanes[0]).toHaveTextContent('Book NY −4.5 · Ours NY −2')
    // the handicap on one line: the book's tick, our dot, the side the bet wins on shaded
    expect(lanes[0].querySelector('.ic-gs-line .bk')).not.toBeNull()
    expect(lanes[0].querySelector('.ic-gs-line .ou')).not.toBeNull()
    expect(lanes[0].querySelector('.ic-gs-line .side')).not.toBeNull()
    expect(lanes[1].querySelector('.ic-gs-ring')!.textContent).toBe('Our chance 51%') // 9 parts the book's even 1.90s, 1 part our 58%
    expect(lanes[2]).toHaveClass('none')
    expect(lanes[2].querySelector('.nb')!.textContent).toBe('No bet·NY odds 1.33 or less')
    expect(lanes[2].querySelector('.nb .dot')).toHaveAttribute('aria-hidden', 'true')
    // the score call is a duel bar, said in words for screen readers
    expect(card.querySelector('.ic-gs-duel .ic-gs-track .fill')).not.toBeNull()
    expect(card.querySelector('.ic-gs-duel')!.textContent).toContain('Our score: IND')
  })

  it('lists the matches on a slate and shows one at a time, with Game N of M, ‹ › and the arrow keys', async () => {
    const first = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    first.markets = [mk('winner', 'NY', 0.64, 0.58, odds2(1.3, 3.4))]
    const second = { ...game(2, 'scheduled', '2099-11-22T23:00:00Z'), away: 'XYZ' }
    second.markets = [mk('winner', 'NY', 0.64, 0.58, odds2(1.3, 3.4))]
    window.history.replaceState(null, '', '/?view=estimates')
    mount(night([first, second]))
    const section = (await screen.findByRole('heading', { level: 2, name: 'Game picks' })).closest('section')!
    const slate = within(section).getByRole('navigation', { name: "Tonight's matches" })
    const rows = within(slate).getAllByRole('button')
    expect(rows.map((r) => r.querySelector('b')!.textContent)).toEqual(['IND @ NY', 'XYZ @ NY'])
    // one card only: the next to tip
    expect(within(section).getAllByRole('article')).toHaveLength(1)
    expect(within(section).getByRole('article', { name: 'IND at NY' })).toHaveTextContent('Game 1 of 2')
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    // the card carries each club's light; a club we don't know falls back to the ink
    const card = within(section).getByRole('article')
    expect(card.style.getPropertyValue('--ta')).toBe('#F2B233')
    expect(card.style.getPropertyValue('--tb')).toBe('#F07F2E')
    fireEvent.click(rows[1])
    const next = within(section).getByRole('article', { name: 'XYZ at NY' })
    expect(next).toHaveTextContent('Game 2 of 2')
    expect(next.style.getPropertyValue('--ta')).toBe('')
    expect(window.location.search).toContain('game=2')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(within(section).getByRole('article', { name: 'IND at NY' })).toBeInTheDocument()
    fireEvent.click(within(section).getAllByRole('button', { name: 'Next match' })[0])
    expect(within(section).getByRole('article', { name: 'XYZ at NY' })).toBeInTheDocument()
    window.history.replaceState(null, '', '/')
  })
  it('on phones folds the slate into a switcher that opens a sheet; picking a match closes it', async () => {
    const first = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    first.markets = [mk('winner', 'NY', 0.64, 0.58, odds2(1.3, 3.4))]
    const done = { ...game(2, 'final', '2020-11-22T23:00:00Z'), away_score: 101, home_score: 110 }
    done.markets = [{ ...mk('total', '', 230, 226.5, [{ side: 'over', odd: 1.9 }, { side: 'under', odd: 1.9 }]), actual: 211, ours_hit: false, book_hit: true }]
    window.history.replaceState(null, '', '/?view=estimates')
    mount(night([first, done]))
    const section = (await screen.findByRole('heading', { level: 2, name: 'Game picks' })).closest('section')!
    // the final match leads the slate: its pip and tally
    const slate = within(section).getByRole('navigation', { name: "Tonight's matches" })
    const finalRow = within(slate).getAllByRole('button')[0]
    expect(finalRow).toHaveTextContent('Final 101–110')
    expect(finalRow.querySelectorAll('.pips i.l')).toHaveLength(1)
    expect(finalRow).toHaveTextContent('0–1 bets won')
    const switcher = within(section).getByRole('button', { name: /IND @ NY/, expanded: false })
    expect(switcher).toHaveTextContent('2 of 2')
    fireEvent.click(switcher)
    const sheet = await screen.findByRole('dialog', { name: /Tonight's matches/ })
    const [close, finalInSheet] = within(sheet).getAllByRole('button')
    expect(close).toHaveAccessibleName('Close')
    fireEvent.click(finalInSheet) // the final match, first on the slate
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(section).getByRole('article', { name: 'IND at NY' })).toHaveTextContent('Final')
    expect(within(section).getByRole('article')).toHaveTextContent('Lost')
    fireEvent.click(within(section).getByRole('button', { name: /IND @ NY/, expanded: false }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    window.history.replaceState(null, '', '/')
  })
})

describe('Where we and the book disagree', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setPlayerCardHost(null)
  })

  /** A player line with rungs 1+ up to 12+, so the bet is the highest rung at or under ours. */
  const pl = (name: string, ours: number, book: number, over: Partial<ComparePlayer> = {}): ComparePlayer => ({
    name,
    player_id: name.length,
    team: 'NY',
    stat: 'reb',
    played: null,
    ladder: [],
    rungs: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, odd: 1.4 + i * 0.3, book: 0.5, ours: 0.55, value: null, hit: null })),
    ours,
    book,
    actual: null,
    gap: ours - book,
    ours_hit: null,
    book_hit: null,
    closer: null,
    ...over,
  })
  const section = async () => (await screen.findByRole('heading', { level: 2, name: /Where we and the book disagree/ })).closest('section')!

  it('is one ranked list: the top three larger, no duel cards, no Players/Games switch and no match chips', async () => {
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.players = [pl('Aa', 8.3, 7.4), pl('Bb', 6.8, 6.0), pl('Cc', 5.6, 5.0), pl('Dd', 4.2, 4.0), pl('Ee', 3.0, 3.5)]
    mount(night([g]))
    const sec = await section()
    expect(sec.querySelector('.ic-gl-sm')!.textContent).toBe('4 of 5 lines ours above')
    const rows = [...sec.querySelectorAll('.ic-gl-rows > .ic-gl-row')]
    expect(rows.map((r) => r.querySelector('.ic-gl-who b')!.textContent)).toEqual(['Aa', 'Bb', 'Cc', 'Dd'])
    expect(rows.map((r) => r.classList.contains('top'))).toEqual([true, true, true, false])
    expect(rows.map((r) => r.querySelector('.ic-gl-rk')!.textContent)).toEqual(['1', '2', '3', '4'])
    // the row: the signed gap, Book · Ours, the bet with its own odds and our chance
    expect(rows[0].querySelector('.ic-gl-gap')!.textContent).toBe('Gap +0.9')
    expect(rows[0].querySelector('.bo')!.textContent).toBe('Book 7.4 · Ours 8.3')
    expect(rows[0].querySelector('.ic-gl-pb b')!.textContent).toBe('8+')
    expect(rows[0].querySelector('.ic-gl-od b')!.textContent).toBe('3.50')
    expect(rows[0].querySelector('.ic-ch')!.textContent).toBe('55%')
    expect(rows[0].querySelector('.ic-gl-trk')!.getAttribute('aria-hidden')).toBe('true')
    // gone: the duel stage, the Players/Games switch, the old day bar's match chips, the row sentence
    expect(document.querySelector('.ic-duel, .ic-stage, .ic-seg, .ic-chip, .ic-games, .ic-nc')).toBeNull()
    expect(sec.textContent).not.toMatch(/we expect .* than the book/)
    // stat tabs in the site's order with counts; the game filter in the site's own menu
    expect(within(within(sec).getByRole('tablist', { name: 'Stat' })).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All 5',
      '3PM 0',
      'Rebounds 5',
      'Assists 0',
      'Steals 0',
      'Blocks 0',
      'Points 0',
    ])
    const select = within(sec).getByRole('combobox', { name: 'Game' })
    expect(select.textContent).toBe('All Games')
    expect(select.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(select)
    const list = within(sec).getByRole('listbox', { name: 'Game' })
    expect([...list.querySelectorAll('.selm-row')].map((o) => o.textContent)).toEqual(['All Games', 'IND @ NY'])
    expect(within(list).getByRole('option', { name: 'All Games' }).getAttribute('aria-selected')).toBe('true')
  })

  it('gives each row two targets: the player card and the rungs', async () => {
    const card = { open: vi.fn(), prefetch: vi.fn() }
    setPlayerCardHost(card)
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.players = [pl('Jayson Tatum', 8.3, 7.4)]
    mount(night([g]))
    const sec = await section()
    const row = sec.querySelector('.ic-gl-row') as HTMLElement
    const player = within(row).getByRole('button', { name: 'Jayson Tatum, Rebounds, 8+. Opens the player card' })
    fireEvent.click(player)
    expect(card.open).toHaveBeenCalledWith({ id: 12, name: 'Jayson Tatum' })
    const rungs = within(row).getByRole('button', { name: /Show the rungs/ })
    expect(rungs.contains(player) || player.contains(rungs)).toBe(false)
    expect(rungs.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(rungs)
    expect(rungs.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(rungs.getAttribute('aria-controls')!)!.querySelector('.ic-row-open')).toBeTruthy()
  })

  it('gathers the lines with no bet under one line, and says what the fold holds', async () => {
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    const high = (name: string, ours: number, book: number) =>
      pl(name, ours, book, { rungs: [{ n: 4, odd: 1.6, book: 0.5, ours: 0.45, value: null, hit: null }] })
    g.players = [pl('Aa', 8.3, 7.4), high('Toppin', 3.9, 3.5), high('Green', 3.6, 3.5), pl('Dd', 4.0, 4.5), pl('Ee', 3.0, 3.5), high('Ff', 2.0, 3)]
    mount(night([g]))
    const sec = await section()
    const grp = sec.querySelector('.ic-gl-grp')!
    expect(grp.textContent).toBe('No bet on these 2: iddaa’s lowest rung is above ours.')
    expect(grp.nextElementSibling!.querySelector('.ic-gl-nb')!.textContent).toBe('No betLowest rung 4+')
    const fold = within(sec).getByRole('button', { name: /Ours level with or below the book/ })
    expect(fold.textContent).toContain('Ours level with or below the book 3')
    expect(fold.textContent).toContain('2 still have a bet. iddaa only prices overs, so the rest carry none.')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(fold)
    expect(sec.querySelectorAll('#ic-gl-rest > .ic-gl-row')).toHaveLength(3)
  })

  it('filters by game with the game menu', async () => {
    const a = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    const b = { ...game(2, 'scheduled', '2099-11-22T23:00:00Z'), away: 'BOS', home: 'GS' }
    a.players = [pl('Aa', 8.3, 7.4)]
    b.players = [pl('Bb', 6.8, 6.0), pl('Cc', 5.6, 5.0)]
    mount(night([a, b]))
    const sec = await section()
    expect(sec.querySelectorAll('.ic-gl-rows > .ic-gl-row')).toHaveLength(3)
    pickGame(sec, /^BOS @ GS/)
    expect(within(sec).getByRole('combobox', { name: 'Game' }).textContent).toBe('BOS @ GS')
    expect([...sec.querySelectorAll('.ic-gl-who b')].map((b) => b.textContent)).toEqual(['Bb', 'Cc'])
  })

  it('pages by 12 on wider screens, and a new stat or game starts the list over', async () => {
    const a = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    const b = { ...game(2, 'scheduled', '2099-11-22T23:00:00Z'), away: 'BOS', home: 'GS' }
    a.players = Array.from({ length: 20 }, (_, i) => pl(`A${i}`, 5 + (30 - i) * 0.1, 5))
    b.players = Array.from({ length: 10 }, (_, i) => pl(`B${i}`, 5 + (10 - i) * 0.1, 5, { stat: 'ast' }))
    mount(night([a, b]))
    const sec = await section()
    const count = () => sec.querySelectorAll('.ic-gl-rows > .ic-gl-row').length
    expect(count()).toBe(12)
    expect([...sec.querySelectorAll('.ic-gl-row.top')]).toHaveLength(3)
    fireEvent.click(within(sec).getByRole('button', { name: 'Show 12 more' }))
    expect(count()).toBe(24)
    fireEvent.click(within(sec).getByRole('button', { name: 'Show 6 more' }))
    expect(count()).toBe(30)
    expect(within(sec).queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull()
    // a new stat tab starts over at 12
    fireEvent.click(within(sec).getByRole('tab', { name: 'Rebounds 20' }))
    expect(count()).toBe(12)
    fireEvent.click(within(sec).getByRole('button', { name: 'Show 8 more' }))
    expect(count()).toBe(20)
    // and so does a game
    fireEvent.click(within(sec).getByRole('tab', { name: 'All 30' }))
    fireEvent.click(within(sec).getByRole('button', { name: 'Show 12 more' }))
    expect(count()).toBe(24)
    pickGame(sec, /^IND @ NY/)
    expect(count()).toBe(12)
  })

  it('pages by 8 on phones', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(max-width: 719px)',
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.players = Array.from({ length: 11 }, (_, i) => pl(`P${i}`, 5 + (11 - i) * 0.1, 5))
    mount(night([g]))
    const sec = await section()
    expect(sec.querySelectorAll('.ic-gl-rows > .ic-gl-row')).toHaveLength(8)
    fireEvent.click(within(sec).getByRole('button', { name: 'Show 3 more' }))
    expect(sec.querySelectorAll('.ic-gl-rows > .ic-gl-row')).toHaveLength(11)
    expect(within(sec).queryByRole('button', { name: /more$/ })).toBeNull()
  })

  it('shows what he got once final, with a green edge light when ours was closer', async () => {
    const g = { ...game(1, 'final', '2026-11-22T00:00:00Z'), away_score: 101, home_score: 99 }
    g.players = [
      pl('Won', 8.3, 7.4, { actual: 9, ours_hit: true, book_hit: false, closer: 'ours' }),
      pl('Lost', 6.8, 6.0, { actual: 4, ours_hit: false, book_hit: true, closer: 'book' }),
    ]
    mount(night([g]))
    const sec = await section()
    const [won, lost] = [...sec.querySelectorAll('.ic-gl-rows > .ic-gl-row')]
    expect(won.querySelector('.ic-gl-got')!.textContent).toBe('Got 9, bet won')
    expect(won.classList.contains('closer')).toBe(true)
    expect(won.querySelector('.ic-gl-trk .rs')).toBeTruthy()
    expect(won.querySelector('.ic-gl-rs')!.textContent).toBe('Won')
    expect(lost.querySelector('.ic-gl-got')!.textContent).toBe('Got 4, bet lost')
    expect(lost.classList.contains('closer')).toBe(false)
    expect(lost.querySelector('.ic-gl-rs')!.textContent).toBe('Lost')
  })
})

describe('Our record on the page', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('sits after the disagree list as three counts, with no record ribbon, scorecard or stat-by-stat list', async () => {
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.players = [
      {
        name: 'Josh Hart',
        player_id: 1,
        team: 'NY',
        stat: 'reb',
        played: null,
        ladder: [],
        rungs: [7, 8, 9].map((n) => ({ n, odd: 1.5 + (n - 7) * 0.4, book: 0.5, ours: 0.55, value: null, hit: null })),
        ours: 8.3,
        book: 7.4,
        actual: null,
        gap: 0.9,
        ours_hit: null,
        book_hit: null,
        closer: null,
      },
    ]
    mount(night([g]))
    const rec = (await screen.findByRole('heading', { level: 2, name: 'Our record' })).closest('section')!
    const list = screen.getByRole('heading', { level: 2, name: /Where we and the book disagree/ }).closest('section')!
    expect(list.compareDocumentPosition(rec) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...rec.querySelectorAll('.ic-rec-l')].map((l) => l.textContent)).toEqual(['bet open', 'Kupons tonight', 'rungs waiting'])
    expect(document.querySelector('.vr-ribbon, .vr-sc-card, .vr-rec-tile')).toBeNull()
    expect(screen.queryByText(/Who won, stat by stat/)).toBeNull()
    expect(screen.queryByText(/Scorecard/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Running Record' })).toBeNull()
  })
})
