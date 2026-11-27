import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InjuryImpact, NewsPage, NewsStory } from '../api/client'
import { News } from './News'

const TEAMS = [
  { id: 3, abbrev: 'KEA' },
  { id: 8, abbrev: 'KVK' },
]
const NOW = new Date()
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

function story(over: Partial<NewsStory>): NewsStory {
  return {
    id: over.headline ?? 'x',
    kind: 'other',
    status: 'reported',
    headline: 'Headline',
    summary: '',
    published_at: hoursAgo(2),
    updated_at: hoursAgo(1),
    players: [],
    sources: [],
    severity: 0,
    conflict: null,
    ...over,
  }
}

const PAGE: NewsPage = {
  league_id: 1,
  updated_at: hoursAgo(0.2),
  refreshing: false,
  stories: [
    story({
      kind: 'injury',
      status: 'confirmed',
      headline: 'Jalen Williams fractures ankle, out indefinitely',
      severity: 3,
      conflict: 'Sources disagree: ESPN status says day-to-day; CBS Sports says serious, weeks or more (ankle).',
      players: [
        {
          player_id: 1,
          name: 'Jalen Williams',
          pro_team: 'OKC',
          injury_status: 'DAY_TO_DAY',
          owner_team_id: 8,
        },
      ],
      sources: [
        {
          source_id: 'cbs',
          name: 'CBS Sports',
          kind: 'outlet',
          title: 'Jalen Williams fractures ankle, out indefinitely',
          url: 'https://cbs.example/jw',
          published_at: hoursAgo(1),
          summary: '',
        },
        {
          source_id: 'espn_players',
          name: 'ESPN player data',
          kind: 'fact',
          title: 'ESPN lists Jalen Williams as day-to-day',
          url: 'https://www.espn.com/nba/player/_/id/1',
          published_at: hoursAgo(1),
          summary: '',
        },
      ],
    }),
    story({
      kind: 'role',
      headline: 'Kris Dunn moves into the starting lineup',
      players: [
        {
          player_id: 2,
          name: 'Kris Dunn',
          pro_team: 'LAC',
          injury_status: 'ACTIVE',
          owner_team_id: null,
        },
      ],
    }),
    story({
      kind: 'rumor',
      headline: 'Davion Mitchell drawing trade interest',
      players: [
        {
          player_id: 3,
          name: 'Davion Mitchell',
          pro_team: 'MIA',
          injury_status: 'ACTIVE',
          owner_team_id: 3,
        },
      ],
    }),
  ],
  trending: [
    {
      player_id: 2,
      name: 'Kris Dunn',
      pro_team: 'LAC',
      injury_status: 'ACTIVE',
      percent_owned: 18.7,
      percent_change: 10.3,
      owner_team_id: null,
    },
  ],
  sources: [
    {
      source_id: 'espn_players',
      name: 'ESPN player data',
      kind: 'fact',
      ok: true,
      items: 700,
    },
    {
      source_id: 'yahoo',
      name: 'Yahoo Sports',
      kind: 'outlet',
      ok: false,
      items: 0,
      error: 'HTTP 503',
    },
    {
      source_id: 'reddit',
      name: 'Reddit r/nba',
      kind: 'tip',
      ok: null,
      items: 0,
    },
  ],
}

const IMPACT: InjuryImpact = {
  player_id: 1,
  name: 'Jalen Williams',
  pro_team: 'OKC',
  minutes: 33.2,
  games_missed: 11.4,
  beneficiaries: [
    {
      player_id: 4,
      name: 'Cason Wallace',
      owner_team_id: 3,
      minutes_before: 27.1,
      minutes_after: 32.9,
      minutes_change: 5.8,
      error: 2.1,
      games_without: 9.2,
      gains: { pts: 2.1, reb: 0.6, ast: 0.8, stl: 0.3, blk: 0.1, tpm: 0.3, to: 0.3, fg_impact: 0.1, ft_impact: 0 },
      value: 0.9,
      confidence: 'strong',
      note: null,
    },
    {
      player_id: 5,
      name: 'Isaiah Joe',
      owner_team_id: null,
      minutes_before: 14.0,
      minutes_after: 19.5,
      minutes_change: 5.5,
      error: 3.4,
      games_without: 4.1,
      gains: { pts: 2.6, reb: 0.5, ast: 0.3, stl: 0.1, blk: 0, tpm: 0.9, to: 0.2, fg_impact: 0.2, ft_impact: 0 },
      value: 0.7,
      confidence: 'some',
      note: 'Ajay Mitchell was also out in most of those games, so part of the gain may be his',
    },
  ],
  method: 'Minutes and per-minute stats in games without him.',
  track_record: 'Checked on 202 past absences.',
}

function renderNews(myTeamId: number | null = 3) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const body = String(input).includes('/api/injury-impact') ? IMPACT : PAGE
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <News leagueId={1} season={2027} myTeamId={myTeamId} teams={TEAMS} creds={null} />
    </QueryClientProvider>,
  )
}

describe('News', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows checked stories with their sources, owners and the injury conflict', async () => {
    renderNews()
    const link = await screen.findByRole('link', {
      name: 'Jalen Williams fractures ankle, out indefinitely',
    })
    expect(link).toHaveAttribute('href', 'https://cbs.example/jw')
    const jw = link.closest('article') as HTMLElement
    // How well it is confirmed, in one word; the via list already names the sources.
    const confirmed = within(jw).getByText('Confirmed')
    expect(confirmed.querySelector('svg.news-seal')).not.toBeNull()
    // Dated by when the story broke, not by its latest source.
    expect(within(jw).getByText('2h ago')).toBeInTheDocument()
    expect(within(jw).queryByText('1h ago')).not.toBeInTheDocument()
    expect(within(jw).getByText('Sources disagree')).toBeInTheDocument()
    expect(within(jw).getByRole('note')).toHaveTextContent('ESPN status says day-to-day')
    expect(within(jw).getByText('DTD')).toHaveAttribute('title', 'ESPN status: DTD')
    expect(within(jw).getByText('KVK')).toBeInTheDocument()
    expect(screen.getAllByText('Reported')).toHaveLength(2)
    for (const r of screen.getAllByText('Reported')) expect(r.querySelector('svg')).toBeNull()
    expect(screen.getAllByText('Free agent').length).toBeGreaterThan(0)
    // Your player keeps the team's abbreviation, marked as yours by the owner dot only (no story bar).
    const dm = screen.getByText('Davion Mitchell drawing trade interest').closest('article') as HTMLElement
    const kea = within(dm).getByTitle('Your team')
    expect(kea).toHaveTextContent('KEA')
    expect(kea.querySelector('.news-owner-dot')).not.toBeNull()
    expect(dm).not.toHaveAttribute('data-mine')
    expect(screen.getByText('+10.3%')).toBeInTheDocument()
    expect(screen.getByText(/Not answering/)).toBeInTheDocument()
  })

  it('puts the stories on the bare page under a plain day head, with no intro line', async () => {
    renderNews()
    await screen.findByText('Kris Dunn moves into the starting lineup')
    expect(screen.queryByText(/checked against several sources before they show/)).not.toBeInTheDocument()
    const feed = screen.getByRole('region', { name: 'Stories' })
    expect(feed).not.toHaveClass('card')
    expect(within(feed).getAllByRole('heading', { level: 3 })[0]).toHaveTextContent(/^Today$/)
    // Trending pickups is a bare rail with no explainer line.
    const trending = screen.getByRole('region', { name: 'Trending pickups' })
    expect(trending).not.toHaveClass('card')
    expect(within(trending).queryByText(/Biggest rise/)).not.toBeInTheDocument()
  })

  it('says only what happened when there are no stories, with no explainer under it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ...PAGE, stories: [], refreshing: false }))),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <News leagueId={1} season={2027} myTeamId={3} teams={TEAMS} creds={null} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('No checked stories in the last 7 days.')).toBeInTheDocument()
    expect(screen.queryByText(/A story shows once/)).not.toBeInTheDocument()
  })

  it('filters by kind and by my roster', async () => {
    renderNews()
    await screen.findByText('Kris Dunn moves into the starting lineup')
    const injuries = screen.getByRole('button', { name: /Injuries/ })
    fireEvent.click(injuries)
    expect(injuries).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Kris Dunn moves into the starting lineup')).not.toBeInTheDocument()
    expect(screen.getByText('Jalen Williams fractures ankle, out indefinitely')).toBeInTheDocument()
    // Pressed again, the kind chip lets every kind back in; there is no "All" kind chip.
    fireEvent.click(injuries)
    expect(injuries).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Kris Dunn moves into the starting lineup')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^All \d/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'My Roster' }))
    expect(screen.getByText('Davion Mitchell drawing trade interest')).toBeInTheDocument()
    expect(screen.queryByText('Kris Dunn moves into the starting lineup')).not.toBeInTheDocument()
  })

  it('shows one toolbar of chips, hiding kinds with no stories in scope', async () => {
    renderNews()
    await screen.findByText('Kris Dunn moves into the starting lineup')
    const bar = screen.getByRole('toolbar', { name: 'Filter stories' })
    expect(within(bar).getByRole('group', { name: 'Which players' })).toBeInTheDocument()
    const kinds = within(bar).getByRole('group', { name: 'Kind of news' })
    const labels = within(kinds)
      .getAllByRole('button')
      .map((b) => b.textContent)
    // Every kind chip has at least one story; zero counts never show.
    expect(labels.length).toBeGreaterThan(1)
    for (const l of labels) expect(l).not.toMatch(/ 0$/)
  })

  it('hides the kind group when only one kind is left in scope', async () => {
    renderNews()
    await screen.findByText('Kris Dunn moves into the starting lineup')
    fireEvent.click(screen.getByRole('button', { name: 'My Roster' }))
    expect(screen.getByText('Davion Mitchell drawing trade interest')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Kind of news' })).not.toBeInTheDocument()
  })

  it('has no "My Roster" before the team is verified', async () => {
    renderNews(null)
    await screen.findByText('Kris Dunn moves into the starting lineup')
    expect(screen.queryByRole('button', { name: 'My Roster' })).not.toBeInTheDocument()
  })
  it('shows who gains from an injury, with minutes, evidence and owners', async () => {
    renderNews()
    await screen.findByText('Jalen Williams fractures ankle, out indefinitely')
    // Only injury stories offer it.
    expect(screen.getAllByRole('button', { name: 'Who gains?' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Who gains?' }))
    const wallace = (await screen.findByText('Cason Wallace')).closest('li') as HTMLElement
    expect(within(wallace).getByText('Your team')).toBeInTheDocument()
    expect(within(wallace).getByText('Strong evidence')).toBeInTheDocument()
    expect(within(wallace).getByText('27 → 33 min')).toBeInTheDocument()
    expect(within(wallace).getByText('(+5.8 ±2.1 min)')).toBeInTheDocument()
    const joe = screen.getByText('Isaiah Joe').closest('li') as HTMLElement
    expect(within(joe).getByText('Free agent')).toBeInTheDocument()
    expect(within(joe).getByText(/Ajay Mitchell was also out/)).toBeInTheDocument()
    expect(screen.getByText(/about 11 OKC games without him/)).toBeInTheDocument()
    const call = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('/api/injury-impact'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ player_id: 1, league_id: 1, season: 2027 })
    const toggle = screen.getByRole('button', { name: 'Who gains?' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Cason Wallace')).not.toBeInTheDocument()
  })

  it('has its own refresh that checks every source and says what came in', async () => {
    let checked = false
    const later: NewsPage = {
      ...PAGE,
      updated_at: new Date().toISOString(),
      stories: [story({ kind: 'trade', headline: 'Kris Dunn traded to the Kings' }), ...PAGE.stories],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/news/check')) {
        checked = true
        return Promise.resolve(new Response(JSON.stringify({ refreshing: true, updated_at: PAGE.updated_at })))
      }
      return Promise.resolve(new Response(JSON.stringify(checked ? later : PAGE)))
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <News leagueId={1} season={2027} myTeamId={3} teams={TEAMS} creds={null} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Updated 12 min ago')).toBeInTheDocument()
    // Not the top bar's analysis refresh: a labelled button of its own.
    fireEvent.click(screen.getByRole('button', { name: 'Refresh news' }))
    expect(await screen.findByText('1 new story')).toBeInTheDocument()
    expect(screen.getByText('Kris Dunn traded to the Kings')).toBeInTheDocument()
  })

  it('says the news is up to date when the sources were just checked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const body = String(input).includes('/api/news/check') ? { refreshing: false, updated_at: PAGE.updated_at } : PAGE
      return Promise.resolve(new Response(JSON.stringify(body)))
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <News leagueId={1} season={2027} myTeamId={3} teams={TEAMS} creds={null} />
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh news' }))
    expect(await screen.findByText('Up to date')).toBeInTheDocument()
  })
})
