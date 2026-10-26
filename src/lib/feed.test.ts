import { describe, expect, it } from 'vitest'
import type { FeedItem, FeedTeam } from '../api/client'
import { bidLine, dayLabel, faabLine, groupByDay, matches, tradeSides, wonVotes } from './feed'

const teams: FeedTeam[] = [
  { id: 3, name: 'Kucukesat Aspavas', abbrev: 'KEA', faab_spent: 2 },
  { id: 6, name: 'Cayyolu', abbrev: 'CAY', faab_spent: 2 },
  { id: 8, name: 'Eryaman Lakers', abbrev: 'ERY', faab_spent: 9 },
  { id: 9, name: 'Aliaga Hermanos', abbrev: 'AYR', faab_spent: 0 },
]

function player(id: number, name: string) {
  return { id, name, position: 'C' }
}

const claim: FeedItem = {
  id: 'tx:a',
  kind: 'waiver',
  at: '2026-10-22T10:00:07Z',
  team_id: 8,
  team_ids: [8],
  bid: 4,
  moves: [
    { player: player(1, 'Yves Missi'), kind: 'add', from_team_id: 0, to_team_id: 8 },
    { player: player(2, 'Nikola Vucevic'), kind: 'drop', from_team_id: 8, to_team_id: 0 },
  ],
  losing_bids: [{ team_id: 6, bid: 1 }],
  reactions: { counts: {}, mine: [] },
  replies: 0,
}

const trade: FeedItem = {
  ...claim,
  id: 'tx:t',
  kind: 'trade',
  team_id: 3,
  team_ids: [3, 9],
  bid: null,
  losing_bids: [],
  moves: [
    { player: player(1, 'Jalen Green'), kind: 'trade', from_team_id: 3, to_team_id: 9 },
    { player: player(2, 'Zion Williamson'), kind: 'trade', from_team_id: 9, to_team_id: 3 },
    { player: player(3, 'Bench guy'), kind: 'trade', from_team_id: 9, to_team_id: 3 },
  ],
  reactions: { counts: { 'won:3': 3, 'won:9': 1, smart: 2 }, mine: ['won:9'] },
}

const post: FeedItem = { id: 'post:1', kind: 'post', at: '2026-10-23T09:00:00Z', team_id: 3, body: 'hi', replies: 0 }

describe('feed lines', () => {
  it('names the bid a claim beat', () => {
    expect(bidLine(claim, teams, 100)).toBe('Won over 1 other bid (Cayyolu, $1).')
    expect(bidLine(claim, teams, null)).toBe('Won over 1 other claim (Cayyolu) on waiver priority.')
    expect(bidLine({ ...claim, losing_bids: [] }, teams)).toBeNull()
    expect(
      bidLine(
        {
          ...claim,
          losing_bids: [
            { team_id: 6, bid: 3 },
            { team_id: 3, bid: 1 },
          ],
        },
        teams,
        100,
      ),
    ).toBe('Won over 2 other bids, the highest $3.')
    expect(bidLine(trade, teams)).toBeNull()
  })

  it('calls out the biggest FAAB spender only when they lead alone', () => {
    expect(faabLine(claim, teams, 100)).toBe('Eryaman Lakers has spent $9 of $100, the most in the league.')
    expect(faabLine({ ...claim, team_id: 3 }, teams, 100)).toBeNull()
    expect(faabLine(claim, teams, null)).toBeNull()
  })
})

describe('trades', () => {
  it('groups players by the team that gets them', () => {
    expect(tradeSides(trade).map((s) => [s.teamId, s.gets!.map((m) => m.player.name)])).toEqual([
      [9, ['Jalen Green']],
      [3, ['Zion Williamson', 'Bench guy']],
    ])
  })

  it('counts who-won votes apart from other reactions', () => {
    expect(wonVotes(trade)).toEqual({ counts: { 3: 3, 9: 1 }, total: 4, mine: 9 })
  })
})

describe('filters and days', () => {
  it('filters by kind and by my team', () => {
    expect(matches(trade, 'trade', 3)).toBe(true)
    expect(matches(claim, 'trade', 3)).toBe(false)
    expect(matches(trade, 'mine', 9)).toBe(true)
    expect(matches(claim, 'mine', 3)).toBe(false)
    expect(matches(post, 'post', null)).toBe(true)
  })

  it('labels today and yesterday, then dates', () => {
    const now = new Date('2026-10-23T18:00:00')
    expect(dayLabel('2026-10-23T09:00:00', now)).toBe('Today')
    expect(dayLabel('2026-10-22T09:00:00', now)).toBe('Yesterday')
    expect(dayLabel('2026-10-20T09:00:00', now)).not.toMatch(/Today|Yesterday/)
    const groups = groupByDay(
      [
        { ...post, at: '2026-10-23T10:00:00' },
        { ...claim, at: '2026-10-23T09:00:00' },
        { ...claim, id: 'tx:b', at: '2026-10-22T09:00:00' },
      ],
      now,
    )
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
    ])
  })
})
