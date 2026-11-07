import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerCard, PlayerGame, PlayerMove } from '../api/client'
import {
  average,
  dealGroups,
  dealPlayers,
  formTiles,
  moveOthers,
  spotlight,
  withExtras,
  gameDate,
  healthStatus,
  moveText,
  opponent,
  ownerText,
} from '../lib/playerCard'
import { DealChips, PlayerCardHost, PlayerChips, PlayerLink } from './PlayerCard'

const teams = new Map([
  [3, 'Kucukesat Aspavas'],
  [8, 'Bench Mob'],
])

function move(m: Partial<PlayerMove>): PlayerMove {
  return { id: 'x', kind: 'add', via: 'free_agent', at: '2026-10-24T14:00:00Z', from_team_id: 0, to_team_id: 8, ...m }
}

function game(pts: number, extra: Partial<PlayerGame> = {}): PlayerGame {
  return {
    game_id: pts,
    season: 2027,
    day: 1,
    date: '2026-10-31T23:30:00Z',
    opponent: 'BOS',
    home: false,
    stats: { minutes: 30, pts, reb: 5, ast: 3, stl: 1, blk: 0, tpm: 2, to: 2, fgm: 6, fga: 12, ftm: 2, fta: 2 },
    ...extra,
  }
}

describe('player card text', () => {
  it('describes each kind of move', () => {
    expect(moveText(move({ kind: 'draft', via: 'draft', bid: 14, to_team_id: 3 }), teams, null)).toBe(
      'Drafted by Kucukesat Aspavas',
    )
    expect(moveText(move({ kind: 'draft', via: 'draft', pick: 30 }), teams, null)).toBe('Drafted by Bench Mob, pick 30')
    expect(moveText(move({ via: 'waiver', bid: 5 }), teams, null)).toBe('Claimed off waivers by Bench Mob')
    expect(moveText(move({ via: 'waiver' }), teams, null)).toBe('Claimed off waivers by Bench Mob')
    expect(moveText(move({}), teams, 8)).toBe('Picked up by you')
    expect(moveText(move({ kind: 'drop', from_team_id: 8, to_team_id: 0 }), teams, null)).toBe('Dropped by Bench Mob')
    expect(moveText(move({ kind: 'trade', via: 'trade', from_team_id: 8, to_team_id: 3 }), teams, 3)).toBe(
      'Traded from Bench Mob to you',
    )
  })

  it('says who has him', () => {
    expect(ownerText({ owner_team_id: null, on_waivers: false }, teams, 3)).toBe('Free agent')
    expect(ownerText({ owner_team_id: null, on_waivers: true }, teams, 3)).toBe('On waivers')
    expect(ownerText({ owner_team_id: 3, on_waivers: false }, teams, 3)).toBe('On your team')
    expect(ownerText({ owner_team_id: 8, on_waivers: false }, teams, 3)).toBe('On Bench Mob')
  })

  it('labels health in plain words', () => {
    expect(healthStatus('ACTIVE')).toEqual({ label: 'Healthy', tone: 'good' })
    expect(healthStatus('DAY_TO_DAY').label).toBe('Day-to-day')
    expect(healthStatus('OUT').tone).toBe('bad')
  })

  it('uses the US date and box-score opponent', () => {
    // 23:30 UTC on Oct 31 is still Oct 31 in New York; 00:30 UTC Nov 1 is too.
    expect(gameDate('2026-11-01T00:30:00Z')).toBe('Oct 31')
    expect(opponent({ opponent: 'BOS', home: false })).toBe('@BOS')
    expect(opponent({ opponent: 'BOS', home: true })).toBe('BOS')
    expect(opponent({ opponent: '', home: null })).toBe('–')
  })

  it('averages games', () => {
    expect(average([game(10), game(20)])?.pts).toBe(15)
    expect(average([])).toBeNull()
  })

  it('spotlights big nights and fades quiet ones, turnovers the other way', () => {
    expect(spotlight('pts', 23, 14.8)).toBeGreaterThan(0)
    expect(spotlight('pts', 15, 14.8)).toBe(0)
    expect(spotlight('pts', 5, 14.8)).toBe(-1)
    expect(spotlight('to', 0, 2)).toBeGreaterThan(0)
    expect(spotlight('to', 4, 2)).toBe(-1)
  })

  it('builds nine form tiles against the season', () => {
    const last5 = { ...game(15).stats, to: 1 }
    const season = { ...game(14).stats, to: 2 }
    const tiles = formTiles(last5, season, 0.5, null)
    expect(tiles.map((t) => t.label)).toEqual(['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'TO', 'FG%', 'FT%'])
    expect(tiles[0]).toMatchObject({ value: '15.0', better: true })
    expect(tiles[6]).toMatchObject({ better: true }) // fewer turnovers
    expect(tiles[7].delta).toBeCloseTo(0)
  })

  it('names who moved with him', () => {
    const others = [{ player_id: 5, name: 'Kyle Kuzma', kind: 'drop' as const, to_team_id: 0 }]
    expect(moveOthers({ kind: 'add', from_team_id: 0, others })).toBe('Kyle Kuzma dropped')
    const trade = [
      { player_id: 6, name: 'A', kind: 'trade' as const, to_team_id: 8 },
      { player_id: 7, name: 'B', kind: 'trade' as const, to_team_id: 3 },
    ]
    expect(moveOthers({ kind: 'trade', from_team_id: 8, others: trade })).toBe('for A · with B')
  })

  it('fills news and move names in once the extras land', () => {
    const base: PlayerCard = {
      player_id: 1,
      on_waivers: false,
      name: 'A',
      position: 'C',
      pro_team: 'NY',
      injury_status: 'ACTIVE',
      percent_owned: 1,
      games: [],
      news: [],
      moves: [move({ others: [{ player_id: 5, name: '', kind: 'drop', to_team_id: 0 }] })],
    }
    expect(withExtras(base, undefined)).toBe(base)
    const full = withExtras(base, { news: [], names: { '5': 'Kyle Kuzma' } })
    expect(full.moves[0].others?.[0].name).toBe('Kyle Kuzma')
  })

  it('lists everyone a deal moves once', () => {
    const a = { id: 1, name: 'A' }
    const b = { id: 2, name: 'B' }
    const c = { id: 3, name: 'C' }
    expect(dealPlayers({ give: [a], get: [b], my_drop: c, my_add: null }).map((p) => p.id)).toEqual([1, 2, 3])
  })

  it('groups a deal by role and leaves out empty roles', () => {
    const a = { id: 1, name: 'A' }
    const b = { id: 2, name: 'B' }
    const c = { id: 3, name: 'C' }
    const d = { id: 4, name: 'D' }
    expect(
      dealGroups({ give: [a], get: [b, c], my_drop: null, my_add: null, their_drop: d }).map((g) => [
        g.label,
        g.players.map((p) => p.id),
      ]),
    ).toEqual([
      ['Give', [1]],
      ['Get', [2, 3]],
      ['They drop', [4]],
    ])
  })
})

const card: PlayerCard = {
  player_id: 7,
  name: 'Jaden McDaniels',
  position: 'SF',
  pro_team: 'ORL',
  injury_status: 'DAY_TO_DAY',
  owner_team_id: 8,
  on_waivers: false,
  percent_owned: 87.9,
  season_line: {
    season: 2027,
    games: 7,
    per_game: { ...game(17).stats, pts: 17.3 },
    fg_pct: 0.553,
    ft_pct: 0.778,
  },
  games: [
    game(19),
    game(23, { game_id: 2, home: true, opponent: 'LAC', won: true }),
    game(11, { game_id: 3, won: false }),
  ],
  news: [
    {
      id: 'n1',
      kind: 'injury',
      status: 'confirmed',
      headline: 'McDaniels (ankle) questionable Friday',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'RotoWire',
      url: 'https://example.com/n1',
      severity: 1,
    },
  ],
  moves: [move({ kind: 'draft', via: 'draft', pick: 102, to_team_id: 8 })],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderHost(
  ui: React.ReactNode,
  leagueRef: { leagueId: number; season: number } | null = { leagueId: 1, season: 2027 },
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
      <PlayerCardHost leagueRef={leagueRef} creds={null} teams={[{ id: 8, name: 'Bench Mob' }]} myTeamId={3} />
    </QueryClientProvider>,
  )
}

describe('PlayerCard', () => {
  it('opens from a name with games, health, news and moves, and closes on Escape', async () => {
    let releaseNews = () => {}
    const newsGate = new Promise<void>((r) => (releaseNews = r))
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/extras')) {
        await newsGate // the core shows before the news lands
        return new Response(JSON.stringify({ news: card.news, names: {} }), { status: 200 })
      }
      return new Response(JSON.stringify({ ...card, news: [] }), { status: 200 })
    })
    renderHost(<PlayerLink player={{ id: 7, name: 'Jaden McDaniels' }} />)
    const link = screen.getByRole('button', { name: 'Jaden McDaniels' })
    link.focus()
    fireEvent.click(link)

    const dialog = await screen.findByRole('dialog', { name: 'Jaden McDaniels' })
    expect(await within(dialog).findByText('Day-to-day')).toBeInTheDocument()
    expect(within(dialog).getByText('On Bench Mob')).toBeInTheDocument()
    expect(within(dialog).getByText('Form · last 3 games')).toBeInTheDocument()
    expect(within(dialog).getByText('season 7 G')).toBeInTheDocument()
    expect(within(dialog).getByText('Orlando Magic', { exact: false })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: /Minutes by game/ })).toBeInTheDocument()
    expect(within(dialog).getAllByText('@BOS').length).toBeGreaterThanOrEqual(2)
    expect(within(dialog).getByText('Drafted by Bench Mob, pick 102')).toBeInTheDocument()
    expect(within(dialog).getByText('Loading his news…')).toBeInTheDocument()
    releaseNews()
    expect((await within(dialog).findAllByText('McDaniels (ankle) questionable Friday')).length).toBeGreaterThan(0)

    // Opponents show as logos, and fall back to the letters when ESPN has no logo.
    const logos = dialog.querySelectorAll<HTMLImageElement>('.pc-opp-logo img[src$="/lac.png"]')
    expect(logos.length).toBe(2) // minutes chart and game log
    fireEvent.error(logos[0])
    expect(dialog.querySelectorAll('.pc-opp-logo img[src$="/lac.png"]').length).toBe(1)

    // Each finished game leads with his team's result, read before the date; a game in play has none.
    const rows = [...dialog.querySelectorAll('.pc-table tbody tr:not(.pc-avg) th')]
    expect(rows.map((r) => r.querySelector('.pc-result .sr-only')?.textContent ?? null)).toEqual([
      null,
      'Won',
      'Lost',
    ])
    expect(rows[1].textContent).toMatch(/^Won/)
    expect(rows[0].querySelector('.pc-result')).toHaveAttribute('aria-hidden', 'true')

    // Game log columns: points right after minutes, then the shooting splits and threes.
    const heads = [...dialog.querySelectorAll('.pc-table thead th')].map((h) => h.textContent)
    expect(heads).toEqual(['Game', 'MIN', 'FG', 'FT', 'PTS', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO'])

    const calls = vi.mocked(fetch).mock.calls.map(([url, init]) => [String(url), JSON.parse(String(init?.body))])
    expect(calls).toContainEqual([
      expect.stringMatching(/\/api\/player-card$/),
      { league_id: 1, season: 2027, player_id: 7, core: true },
    ])
    expect(calls).toContainEqual([expect.stringMatching(/\/extras$/), { league_id: 1, season: 2027, player_id: 7 }])

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(link)
  })

  it('starts loading a card when a name is pressed, before the tap opens it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(card), { status: 200 }))
    renderHost(<PlayerLink player={{ id: 7, name: 'Jaden McDaniels' }} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Jaden McDaniels' }))
    expect(fetch).toHaveBeenCalledTimes(2) // core and extras
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps names as plain text outside a league', () => {
    renderHost(
      <>
        <PlayerLink player={{ id: 7, name: 'Jaden McDaniels' }} />
        <PlayerChips players={[{ id: 7, name: 'Jaden McDaniels' }]} />
      </>,
      null,
    )
    expect(screen.getByText('Jaden McDaniels')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the players of a deal under their roles, each opening his card', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(card), { status: 200 }))
    renderHost(
      <DealChips
        deal={{ give: [{ id: 5, name: 'Amen Thompson' }], get: [{ id: 7, name: 'Jaden McDaniels' }], my_drop: null }}
      />,
    )
    const deal = screen.getByRole('region', { name: 'Players in this deal' })
    expect(deal).toHaveTextContent(/Give.*Amen Thompson.*Get.*Jaden McDaniels/)
    expect(deal).not.toHaveTextContent('You drop')
    fireEvent.click(screen.getByRole('button', { name: 'Jaden McDaniels' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('opens from a chip and shows an error with a retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: 'no_player', message: 'No such NBA player.' } }), { status: 404 }),
    )
    renderHost(<PlayerChips players={[{ id: 9, name: 'Nobody' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nobody' }))
    expect(await screen.findByText('No such NBA player.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
