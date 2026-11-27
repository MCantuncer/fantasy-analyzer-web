import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DayLineup, LineupSpot, ScoreDay } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { game, line } from '../test/fixtures'
import { MyPlayers } from './MyPlayers'

const LIVE: ScoreDay = {
  league_id: 1,
  season: 2027,
  day: 22,
  date: '2026-11-10',
  live: true,
  updated_at: '2026-11-11T03:00:00Z',
  complete: true,
  days: [
    { day: 21, date: '2026-11-09', games: 8 },
    { day: 22, date: '2026-11-10', games: 6 },
    { day: 23, date: '2026-11-11', games: 10 },
  ],
  week: [],
  games: [
    game({
      id: 1,
      status: 'live',
      clock: 'Q4 4:12',
      away: { pro_team_id: 2, abbrev: 'BOS', name: 'Boston Celtics', score: 98 },
      home: { pro_team_id: 20, abbrev: 'PHI', name: 'Philadelphia 76ers', score: 94 },
      lines: [line({ player_id: 10, name: 'Jayson Tatum', pro_team_id: 2, owner_team_id: 3, pts: 27, fgm: 9, fga: 19 })],
    }),
    game({
      id: 2,
      status: 'scheduled',
      start: '2026-11-11T04:00:00Z',
      away: { pro_team_id: 25, abbrev: 'OKC', name: 'Oklahoma City Thunder', score: null },
      home: { pro_team_id: 22, abbrev: 'POR', name: 'Portland Trail Blazers', score: null },
      lines: [],
    }),
  ],
}

const spot = (player_id: number, name: string, slot: string, game_id: number | null, eligible = ['UTIL']): LineupSpot => ({
  player_id,
  name,
  pro_team_id: 2,
  slot,
  slot_id: 0,
  starting: slot !== 'BE' && slot !== 'IR',
  injury_status: 'ACTIVE',
  game_id,
  eligible,
})

const LINEUP: DayLineup = {
  league_id: 1,
  season: 2027,
  team_id: 3,
  day: 22,
  date: '2026-11-10',
  spots: [
    spot(10, 'Jayson Tatum', 'SF', 1),
    spot(11, 'Aday Mara', 'C', 2),
    spot(12, 'Saddiq Bey', 'UTIL', null),
    spot(13, 'Christian Braun', 'BE', 2, ['SG', 'UTIL']),
  ],
  open_slots: [],
  fetched_at: new Date().toISOString(),
}

function mockApi(lineup: DayLineup = LINEUP) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input), 'http://x').pathname
    return new Response(JSON.stringify(path === '/api/scores/lineup' ? lineup : LIVE))
  })
}

function renderIt() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MyPlayers leagueId={1} season={2027} teamId={3} creds={null} />
    </QueryClientProvider>,
  )
}

const rowOf = async (name: string) =>
  (await screen.findAllByText(name)).map((e) => e.closest('.tm-row')).find(Boolean) as HTMLElement

describe('MyPlayers', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("follows ESPN's lineup order on Quiet Field rows and accounts for every starting slot", async () => {
    mockApi()
    renderIt()
    const tatum = await rowOf('Tatum')
    const starters = [...document.querySelectorAll('ol[aria-label="Starters"] .tm-row')]
    expect(starters.map((r) => r.querySelector('.tm-slot')?.textContent)).toEqual(['SF', 'C', 'UTIL'])
    expect(starters.map((r) => r.querySelector('.tm-short')?.textContent)).toEqual(['Tatum', 'Mara', 'Bey'])
    expect(tatum).toHaveClass('tm-livex', 'tm-card')
    expect(within(tatum).getByText('Q4 4:12')).toBeInTheDocument()
    expect(within(tatum).getByText('27')).toBeInTheDocument()
    expect(await rowOf('Bey')).toHaveTextContent(/No game/)
    // Mara tips later: the tip-off and where, then what he usually brings.
    const mara = await rowOf('Mara')
    expect(mara).toHaveTextContent(/@ POR/)
    // The bench sits off the field, with no slot.
    const braun = await rowOf('Braun')
    expect(braun.closest('.tm-field')).toBeNull()
    expect(braun.querySelector('.tm-slot')).toBeNull()
    const status = document.querySelector('.mp-status-line')!
    expect(status).toHaveTextContent(/^1 live · 1 to come · 1 idle · next tip .+, /)
    expect(screen.getByText('Starters so far')).toBeInTheDocument()
  })

  it('lights a live player only while he is on the floor; the clock stays', async () => {
    const sitting: ScoreDay = {
      ...LIVE,
      games: LIVE.games.map((g) => (g.id === 1 ? { ...g, lines: g.lines.map((l) => ({ ...l, on_court: false })) } : g)),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      return new Response(JSON.stringify(path === '/api/scores/lineup' ? LINEUP : sitting))
    })
    renderIt()
    const tatum = await rowOf('Tatum')
    expect(tatum.querySelector('.tm-mk.sitting')).toHaveTextContent('On the bench now')
    expect(within(tatum).getByText('Q4 4:12')).toBeInTheDocument()
  })

  it('keeps a player on the floor lit', async () => {
    const onFloor: ScoreDay = {
      ...LIVE,
      games: LIVE.games.map((g) => (g.id === 1 ? { ...g, lines: g.lines.map((l) => ({ ...l, on_court: true })) } : g)),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      return new Response(JSON.stringify(path === '/api/scores/lineup' ? LINEUP : onFloor))
    })
    renderIt()
    const tatum = await rowOf('Tatum')
    expect(tatum.querySelector('.tm-mk.oncourt')).not.toBeNull()
    expect(tatum.querySelector('.tm-mk.sitting')).toBeNull()
  })

  it('grades a finished line in the spine, marks what moved it, and shows minutes against his average', async () => {
    const final: ScoreDay = {
      ...LIVE,
      live: false,
      games: LIVE.games.map((g) =>
        g.id === 1
          ? {
              ...g,
              status: 'final',
              clock: null,
              // 37 on 15/20, but 6/11 FT: the real Nov 13 Giannis line
              lines: g.lines.map((l) => ({
                ...l,
                minutes: 41,
                pts: 37,
                reb: 9,
                ast: 2,
                stl: 0,
                blk: 1,
                tpm: 1,
                to: 4,
                fgm: 15,
                fga: 20,
                ftm: 6,
                fta: 11,
              })),
            }
          : g,
      ),
    }
    const lineup: DayLineup = {
      ...LINEUP,
      spots: LINEUP.spots.map((s) =>
        s.player_id === 10
          ? { ...s, season_avg: { gp: 10, min: 33.6, fgm: 9, fga: 19, ftm: 6, fta: 7, tpm: 3, reb: 8, ast: 5, stl: 1, blk: 0.6, to: 3, pts: 27 } }
          : s,
      ),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      return new Response(JSON.stringify(path === '/api/scores/lineup' ? lineup : final))
    })
    renderIt()
    const tatum = await rowOf('Tatum')
    expect(tatum).toHaveClass('tm-final', 'tm-g-mid', 'tm-card')
    expect(tatum.querySelector('.tm-spine .tm-grade')).toHaveAttribute('aria-label', 'grade B−')
    // The carets carry their meaning for screen readers.
    const up = tatum.querySelector('.tm-drv-up')!
    expect(up).toHaveTextContent(/^FG 15\/20, helped most/)
    expect(tatum.querySelector('.tm-drv-down')).toHaveTextContent(/^FT 6\/11, hurt most/)
    // 41 minutes against a 33.6 average: +7 under MIN.
    expect(tatum.querySelector('.tm-md')).toHaveTextContent('+7 minutes against his average')
  })

  it('gives a live line no letter, no carets and no minutes delta', async () => {
    mockApi()
    renderIt()
    const tatum = await rowOf('Tatum')
    expect(tatum.querySelector('.tm-grade')).toBeNull()
    expect(tatum.querySelector('.tm-drv')).toBeNull()
    expect(tatum.querySelector('.tm-md')).toBeNull()
  })

  it("names each player's own side: Mara with OKC, Gafford with DAL", async () => {
    const day: ScoreDay = {
      ...LIVE,
      games: [
        game({
          id: 5,
          status: 'live',
          clock: 'Q3 2:00',
          away: { pro_team_id: 14, abbrev: 'MIA', name: 'Miami Heat', score: 76 },
          home: { pro_team_id: 25, abbrev: 'OKC', name: 'Oklahoma City Thunder', score: 55 },
          lines: [],
        }),
        game({
          id: 6,
          status: 'live',
          clock: 'Q1 5:00',
          away: { pro_team_id: 6, abbrev: 'DAL', name: 'Dallas Mavericks', score: 23 },
          home: { pro_team_id: 21, abbrev: 'PHX', name: 'Phoenix Suns', score: 24 },
          lines: [line({ player_id: 21, name: 'Daniel Gafford', pro_team_id: 6, owner_team_id: 3, minutes: 6 })],
        }),
      ],
    }
    const lineup: DayLineup = {
      ...LINEUP,
      spots: [
        { ...spot(20, 'Aday Mara', 'C', 5), pro_team_id: 25, injury_status: 'OUT' },
        { ...spot(21, 'Daniel Gafford', 'UTIL', 6), pro_team_id: 6 },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      return new Response(JSON.stringify(path === '/api/scores/lineup' ? lineup : day))
    })
    renderIt()
    const mara = await rowOf('Mara')
    expect(mara.querySelector('.tm-l1 .tm-tag')).toHaveTextContent('OUT')
    expect(mara.querySelector('.tm-st')).toHaveTextContent('Not playing · OKC 55–76')
    expect(mara.querySelector('.tm-stats')).toBeNull()
    expect((await rowOf('Gafford')).querySelector('.tm-st')).toHaveTextContent('DAL 23–24')
    expect(document.querySelector('.mp-status-line')).toHaveTextContent(/^1 live · 1 out$/)
  })

  it('shows no zeros, no column head and no pager before the first tip', async () => {
    const before: ScoreDay = { ...LIVE, live: false, games: LIVE.games.map((g) => ({ ...g, status: 'scheduled', clock: null, lines: [] })) }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      return new Response(JSON.stringify(path === '/api/scores/lineup' ? LINEUP : before))
    })
    renderIt()
    await rowOf('Tatum')
    expect(document.querySelector('.tm-stats')).toBeNull()
    expect(document.querySelector('.tm-colhead')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More stats' })).toBeNull()
    expect(document.querySelector('.tm-tot-note')).toHaveTextContent(/^Nothing yet · first tip /)
    expect(document.querySelector('.mp-status-line')).toHaveTextContent(/^2 to come · 1 idle · first tip /)
  })

  it('keeps a probable player quiet: no tag, the number alone', async () => {
    const lineup: DayLineup = {
      ...LINEUP,
      spots: LINEUP.spots.map((s) =>
        s.player_id === 11
          ? {
              ...s,
              play: {
                chance: 0.94,
                tag: 'Probable',
                basis: '94% of probable players played.',
                news: null,
                news_at: null,
                return_date: null,
                upgraded: false,
                missed_in_a_row: null,
              },
            }
          : s,
      ),
    }
    mockApi(lineup)
    renderIt()
    const mara = await rowOf('Mara')
    expect(mara.querySelector('.tm-tag')).toBeNull()
    expect(mara.querySelector('.tm-note')).toHaveTextContent(/94% to play/)
    // A tap off the name opens the why under the row.
    const hit = within(mara).getByRole('button', { name: 'What 94% means for Mara' })
    expect(hit).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(hit)
    expect(document.getElementById('mp-why-11')).not.toHaveAttribute('hidden')
    expect(document.getElementById('mp-why-11')).toHaveTextContent('94% of probable players played.')
  })

  it('drops the injury tag once he has played', async () => {
    const lineup: DayLineup = {
      ...LINEUP,
      spots: LINEUP.spots.map((s) => (s.player_id === 10 ? { ...s, injury_status: 'DAY_TO_DAY' } : s)),
    }
    mockApi(lineup)
    renderIt()
    expect((await rowOf('Tatum')).querySelector('.tm-tag')).toBeNull()
  })

  it('makes face and name one button that opens the card', async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    try {
      mockApi()
      renderIt()
      const tatum = await rowOf('Tatum')
      const pick = tatum.querySelector('.tm-pick') as HTMLElement
      expect(pick.querySelector('.head')).not.toBeNull()
      fireEvent.click(pick)
      expect(open).toHaveBeenLastCalledWith({ id: 10, name: 'Jayson Tatum' })
    } finally {
      act(() => setPlayerCardHost(null))
    }
  })

  it('asks for a swap when a bench player plays and fits an idle slot', async () => {
    mockApi()
    renderIt()
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('Braun plays from your bench, Bey has no game in UTIL.')
    expect(within(note).getByRole('link', { name: /Open team in ESPN/ })).toHaveAttribute(
      'href',
      'https://fantasy.espn.com/basketball/team?leagueId=1&teamId=3&seasonId=2027',
    )
  })

  it('opens the player card from the names in the swap note', async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    try {
      mockApi()
      renderIt()
      const note = await screen.findByRole('note')
      fireEvent.click(within(note).getByRole('button', { name: 'Braun' }))
      expect(open).toHaveBeenLastCalledWith({ id: 13, name: 'Christian Braun' })
      fireEvent.click(within(note).getByRole('button', { name: 'Bey' }))
      expect(open).toHaveBeenLastCalledWith({ id: 12, name: 'Saddiq Bey' })
    } finally {
      act(() => setPlayerCardHost(null))
    }
  })

  it('says nothing when there is nothing to swap', async () => {
    mockApi({ ...LINEUP, spots: LINEUP.spots.filter((s) => s.slot !== 'BE') })
    renderIt()
    await rowOf('Tatum')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
