import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, deletePost, fetchFeed, fetchReplies, react } from '../api/client'
import type { FeedItem, FeedPage } from '../api/client'
import { LeagueChat } from './LeagueChat'

const p = (id: number, name: string) => ({ id, name, position: 'SF' })
const base = { team_ids: [], losing_bids: [], reactions: { counts: {}, mine: [] }, replies: 0 }
const items: FeedItem[] = [
  {
    ...base,
    id: 'tx:big',
    kind: 'waiver',
    at: new Date().toISOString(),
    team_id: 3,
    bid: 12,
    losing_bids: [{ team_id: 6, bid: 5 }],
    moves: [
      { player: p(1, 'Tristan da Silva'), kind: 'add', from_team_id: 0, to_team_id: 3 },
      { player: p(2, 'Kyle Kuzma'), kind: 'drop', from_team_id: 3, to_team_id: 0 },
    ],
  },
  {
    ...base,
    id: 'tx:fa',
    kind: 'free_agent',
    at: new Date().toISOString(),
    team_id: 6,
    moves: [{ player: p(5, 'Cam Spencer'), kind: 'add', from_team_id: 0, to_team_id: 6 }],
  },
  {
    ...base,
    id: 'tx:t',
    kind: 'trade',
    at: new Date().toISOString(),
    team_id: 3,
    team_ids: [3, 6],
    moves: [
      { player: p(3, 'Mikal Bridges'), kind: 'trade', from_team_id: 6, to_team_id: 3 },
      { player: p(4, 'Jalen Green'), kind: 'trade', from_team_id: 3, to_team_id: 6 },
    ],
  },
  { ...base, id: 'post:1', kind: 'post', at: new Date().toISOString(), team_id: 6, body: 'nice steal' },
]
const page: FeedPage = {
  league_id: 1,
  season: 2027,
  page: 0,
  has_more: false,
  items,
  teams: [
    { id: 3, name: 'Kucukesat Aspavas', abbrev: 'KEA', faab_spent: 12 },
    { id: 6, name: 'Cayyolu Bastards', abbrev: 'CAY', faab_spent: 0 },
  ],
  faab_budget: 100,
  me: null,
}

vi.mock('../api/client', async (orig) => ({
  ...(await orig<typeof import('../api/client')>()),
  fetchFeed: vi.fn(async () => page),
  fetchReplies: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(async () => ({ ok: true })),
  react: vi.fn(),
}))

describe('LeagueChat wire', () => {
  afterEach(cleanup)

  it('puts moves on one line each, talk in moments, and sums the day on its milestone', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const wire = container.querySelector('ol.feed-wire')!
    expect(wire.getAttribute('aria-label')).toBe('League moves, newest first')
    expect(wire.querySelector('.feed-day h3')?.textContent).toBe('Today')
    expect(wire.querySelector('.feed-day-summary')?.textContent).toBe('3 moves · $12 spent')
    expect(wire.querySelectorAll('.feed-line')).toHaveLength(2)
    expect(wire.querySelectorAll('.feed-moment')).toHaveLength(2)
    expect(wire.querySelector('.feed-moment-trade')?.textContent).toContain('Cayyolu Bastards get')
    expect(wire.querySelector('.feed-moment-post')?.textContent).toContain('nice steal')
    expect(container.querySelector('.feed-grid, .feed-tile')).toBeNull()
    expect(wire.querySelectorAll('img')).toHaveLength(5)
  })

  it('shows the bid, what it beat and the biggest bid in the line, and a free agent in the same slot', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const [claim, fa] = container.querySelectorAll('.feed-line')
    expect(claim.querySelector('.feed-slot')?.textContent).toBe('Waiver bid$12')
    expect(claim.querySelector('.feed-meta')?.textContent).toContain('Biggest bid this week')
    const beat = claim.querySelector('.feed-beat')!
    expect(beat.textContent).toMatch(/^Beat 1 bid/)
    expect(beat.querySelector('.sr-only')?.textContent).toBe('Cayyolu Bastards')
    expect(beat.querySelector('.num')?.textContent).toBe('$5')
    expect(fa.querySelector('.feed-slot')?.textContent).toBe('Free agent')
    expect(fa.querySelector('.feed-meta')).toBeNull()
  })

  it('prints the time once for a run of moves made in the same minute', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const [first, second] = container.querySelectorAll('.feed-line')
    expect(first.querySelector('time.feed-time')).not.toBeNull()
    expect(second.querySelector('time.feed-time')).toBeNull()
    expect(second.querySelector('time.sr-only')).not.toBeNull()
  })
})

describe('LeagueChat refresh', () => {
  it('keeps the feed on screen when a refresh fails', async () => {
    const client = new QueryClient()
    const { container } = render(
      <QueryClientProvider client={client}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    vi.mocked(fetchFeed).mockRejectedValue(new ApiError(500, 'server', 'Something broke.'))
    await act(() => client.refetchQueries({ queryKey: ['feed', 1, 2027] }))
    await screen.findByText(/Couldn't refresh the feed just now/)
    expect(screen.queryByText("Couldn't load the league feed")).toBeNull()
    expect(container.querySelectorAll('.feed-wire .feed-line')).toHaveLength(2)
  })
})

describe('LeagueChat FAAB and composer', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.mocked(fetchFeed).mockResolvedValue(page)
  })

  it('shows FAAB as an unboxed rail with bars and "Most", folded into a summary row for smaller screens', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await within(container).findByText('Tristan da Silva')
    const rail = container.querySelector('aside.feed-faab')!
    expect(rail.querySelector('h2')?.textContent).toBe('FAAB spent')
    expect(rail.textContent).toContain('Of $100 each')
    const rows = rail.querySelectorAll('.feed-faab-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toBe('KAKucukesat AspavasMost$12')
    expect((rows[0].querySelector('.feed-faab-bar i') as HTMLElement).style.width).toBe('12%')
    expect(rail.querySelector('.feed-faab-note')?.textContent).toBe('1 team has not spent any yet.')
    expect(container.querySelector('.card, table.faab-table')).toBeNull()

    const sum = container.querySelector('details.feed-faab-sum')!
    expect(sum.querySelector('summary')?.textContent).toBe('FAAB spentKAKucukesat Aspavas$12All 2')
    expect(sum.querySelectorAll('.feed-faab-row')).toHaveLength(1)

    // The FAAB leader is named once, on the rail, not in a sentence under one of their moves.
    expect(container.querySelector('.feed-wire')?.textContent).not.toContain('the most in the league')
  })

  it('styles the filters as icon and Title Case label, pressed by aria-pressed', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await within(container).findByText('Tristan da Silva')
    const filters = [...container.querySelectorAll('.feed-filters .feed-filter')]
    expect(filters.map((f) => f.textContent)).toEqual(['Everything', 'Trades', 'Waivers', 'Free Agents'])
    expect(filters.every((f) => f.querySelector('svg'))).toBe(true)
    expect(filters[0].getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.chip[aria-pressed]:not(.feed-reaction)')).toBeNull()
  })

  it('puts the composer at the top of the wire with your crest and "Posting as" under it', async () => {
    vi.mocked(fetchFeed).mockResolvedValue({ ...page, me: { team_id: 3, team_name: 'Kucukesat Aspavas' } } as FeedPage)
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await within(container).findByText('Tristan da Silva')
    const top = container.querySelector('ol.feed-wire > li:first-child')!
    expect(top.classList.contains('chat-compose')).toBe(true)
    expect(top.querySelector('.feed-node .crest')?.textContent).toBe('KA')
    expect(top.querySelector('input')?.getAttribute('placeholder')).toBe('Talk to the league…')
    expect(top.querySelector('.chat-as')?.textContent).toBe('Posting as Kucukesat Aspavas')
    expect(container.querySelector('.chat-me, .feed-avatar, .card.composer')).toBeNull()
    expect(container.querySelector('.feed-faab-row.is-me')?.textContent).toContain('(you)')
    expect(container.querySelectorAll('.feed-filters .feed-filter')).toHaveLength(6)
  })
})

describe('LeagueChat react and reply', () => {
  afterEach(cleanup)
  const me = { team_id: 3, team_name: 'Kucukesat Aspavas' }
  const reacted = { counts: { smart: 2, steal: 1 }, mine: ['smart'] }
  const chatPage = (patch: Record<string, Partial<FeedItem>> = {}) =>
    ({ ...page, me, items: items.map((i) => ({ ...i, ...patch[i.id] })) }) as FeedPage
  function renderChat() {
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
  }

  it('gives each line one trailing React or reply button instead of a React / Reply text row', async () => {
    vi.mocked(fetchFeed).mockResolvedValue(chatPage({ 'tx:big': { reactions: reacted } }))
    const { container } = renderChat()
    await within(container).findByText('Tristan da Silva')
    const lines = [...container.querySelectorAll('.feed-line')]
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.querySelectorAll('button.chat-act').length)).toEqual([1, 1])
    expect(lines.some((l) => /React|Reply/.test(l.textContent ?? ''))).toBe(false)
    const [used, empty] = lines.map((l) => l.querySelector('button.chat-act')!)
    expect(used.classList.contains('has')).toBe(true)
    expect(used.textContent).toBe('🧠🥷3')
    expect(used.getAttribute('aria-label')).toBe('Smart move, 2; Steal, 1. React or reply')
    expect(empty.getAttribute('aria-label')).toBe('React or reply')
    expect(empty.querySelector('svg')).not.toBeNull()
  })

  it('opens the tray in place with your reaction pressed; Esc closes it and returns focus', async () => {
    vi.mocked(fetchFeed).mockResolvedValue(chatPage({ 'tx:big': { reactions: reacted } }))
    vi.mocked(react).mockResolvedValue({ target: 'tx:big', reactions: reacted })
    const { container } = renderChat()
    await within(container).findByText('Tristan da Silva')
    const btn = container.querySelector('.feed-line button.chat-act') as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    const tray = within(container).getByRole('group', { name: "React to Kucukesat Aspavas's move" })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.getAttribute('aria-controls')).toBe(tray.id)
    expect(tray.closest('li')).toBe(btn.closest('li'))
    const chips = [...tray.querySelectorAll('button')]
    expect(chips.map((c) => c.getAttribute('aria-label') ?? c.textContent)).toEqual([
      'Steal, 1',
      'Smart move, 2',
      'Overpay',
      'LOL',
      'Reply',
    ])
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', null])

    fireEvent.keyDown(chips[0], { key: 'Escape' })
    expect(container.querySelector('.chat-tray')).toBeNull()
    expect(document.activeElement).toBe(btn)

    fireEvent.click(btn)
    fireEvent.click(within(container).getByRole('button', { name: 'Overpay' }))
    await waitFor(() => expect(vi.mocked(react).mock.calls[0]?.slice(1, 4)).toEqual(['tx:big', 'overpay', true]))
    expect(container.querySelector('.chat-tray')).toBeNull()
  })

  it('opens a reply under the line from the tray, and promotes the line in place when the reply lands', async () => {
    vi.mocked(fetchFeed).mockResolvedValue(chatPage())
    vi.mocked(fetchReplies).mockResolvedValue({
      target: 'tx:fa',
      items: [{ ...base, id: 'post:7', kind: 'post', at: new Date().toISOString(), team_id: 3, body: 'Good pickup' }],
    })
    vi.mocked(createPost).mockImplementation(async () => {
      vi.mocked(fetchFeed).mockResolvedValue(chatPage({ 'tx:fa': { replies: 1 } }))
      return { ...base, id: 'post:7', kind: 'post', at: new Date().toISOString(), team_id: 3, body: 'Good pickup' }
    })
    const { container } = renderChat()
    await within(container).findByText('Cam Spencer')
    const li = within(container).getByText('Cam Spencer').closest('li')!
    fireEvent.click(li.querySelector('button.chat-act')!)
    fireEvent.click(within(li).getByRole('button', { name: 'Reply' }))
    const input = within(li).getByPlaceholderText('Write a reply…')
    expect(document.activeElement).toBe(input)
    expect(li.className).toBe('feed-entry feed-line is-open')
    expect(fetchReplies).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'Good pickup' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(li.className).toBe('feed-entry feed-moment feed-moment-move is-promoted'))
    expect(li.querySelector('button.chat-act')).toBeNull()
    expect(within(li).getByRole('button', { name: '1 reply' }).getAttribute('aria-expanded')).toBe('true')
    const reply = await within(li).findByText('Good pickup')
    expect(reply.closest('.chat-reply')?.querySelector('.crest')).not.toBeNull()
    expect(within(li).getByPlaceholderText('Write a reply…')).toBeTruthy()
  })

  it('shows moves with replies as moments with used chips, React and the reply count, without animating them', async () => {
    vi.mocked(fetchFeed).mockResolvedValue(chatPage({ 'tx:big': { replies: 2, reactions: reacted } }))
    const { container } = renderChat()
    await within(container).findByText('Tristan da Silva')
    const moment = container.querySelector('.feed-moment-move')!
    expect(moment.classList.contains('is-promoted')).toBe(false)
    const actions = [...moment.querySelectorAll('.chat-actions button')]
    expect(actions.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Steal, 1',
      'Smart move, 2',
      'React',
      '2 replies',
    ])
    // The old shared React / Reply row and its small bordered chips are gone.
    expect(container.querySelector('.feed-social, .feed-react, .feed-reply-toggle, .chip.sm')).toBeNull()

    fireEvent.click(actions[2])
    expect([...moment.querySelectorAll('.chat-actions .chat-chip[aria-pressed]')]).toHaveLength(4)
    fireEvent.keyDown(actions[2], { key: 'Escape' })
    expect([...moment.querySelectorAll('.chat-actions .chat-chip[aria-pressed]')]).toHaveLength(2)
  })

  it('deletes your own post in two taps, with focus on Keep', async () => {
    vi.mocked(fetchFeed).mockResolvedValue(chatPage({ 'post:1': { team_id: 3 } }))
    const { container } = renderChat()
    await within(container).findByText('nice steal')
    const post = container.querySelector('.feed-moment-post')!
    const trash = within(post as HTMLElement).getByRole('button', { name: 'Delete your post' })
    expect(trash.querySelector('svg')).not.toBeNull()
    fireEvent.click(trash)
    const keep = within(post as HTMLElement).getByRole('button', { name: 'Keep' })
    expect(document.activeElement).toBe(keep)
    fireEvent.click(keep)
    const again = within(post as HTMLElement).getByRole('button', { name: 'Delete your post' })
    expect(document.activeElement).toBe(again)
    expect(deletePost).not.toHaveBeenCalled()
    fireEvent.click(again)
    fireEvent.click(within(post as HTMLElement).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(vi.mocked(deletePost).mock.calls[0][1]).toBe(1))
  })
})
