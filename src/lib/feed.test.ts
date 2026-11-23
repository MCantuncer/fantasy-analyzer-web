import { describe, expect, it } from 'vitest'
import type { FeedItem, FeedTeam } from '../api/client'
import {
  biggestBidId,
  bidLine,
  dayLabel,
  daySummary,
  faabLine,
  groupByDay,
  matches,
  tradeSides,
  wonVotes,
  beatenBids,
  dayDate,
  faabLeaderId,
  isMoment,
  timeRunStarts,
} from './feed'

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

describe('day summary and biggest bid', () => {
  const post: FeedItem = { ...claim, id: 'post:1', kind: 'post', bid: null, moves: [], body: 'hi' }
  const fa: FeedItem = { ...claim, id: 'tx:f', kind: 'free_agent', bid: null }
  const small: FeedItem = { ...claim, id: 'tx:s', bid: 1 }

  it('counts moves and adds up waiver bids', () => {
    expect(daySummary([claim, fa, small, post], 100)).toBe('3 moves · $5 spent')
    expect(daySummary([fa], 100)).toBe('1 move')
    expect(daySummary([claim], null)).toBe('1 move')
    expect(daySummary([post], 100)).toBeNull()
  })

  it('picks the one highest bid, never a tie or a $0 claim', () => {
    expect(biggestBidId([claim, small, fa])).toBe('tx:a')
    expect(biggestBidId([claim, { ...small, bid: 4 }])).toBeNull()
    expect(biggestBidId([{ ...claim, bid: 0 }, fa])).toBeNull()
  })
})

describe('wire helpers', () => {
  it('lists the bids a claim beat, with amounts only in FAAB leagues', () => {
    const two: FeedItem = {
      ...claim,
      losing_bids: [
        { team_id: 6, bid: 3 },
        { team_id: 3, bid: 1 },
      ],
    }
    expect(beatenBids(two, 100)).toEqual({
      count: 2,
      unit: 'bid',
      rows: [
        { teamId: 6, bid: 3 },
        { teamId: 3, bid: 1 },
      ],
    })
    expect(beatenBids(claim, null)).toEqual({ count: 1, unit: 'claim', rows: [{ teamId: 6, bid: null }] })
    expect(beatenBids(claim, 0)?.unit).toBe('claim')
  })

  it('shows nothing for an uncontested claim or a move that is not a waiver claim', () => {
    expect(beatenBids({ ...claim, losing_bids: [] }, 100)).toBeNull()
    expect(beatenBids({ ...claim, losing_bids: undefined }, 100)).toBeNull()
    expect(beatenBids({ ...claim, kind: 'free_agent' }, 100)).toBeNull()
    expect(beatenBids(trade, 100)).toBeNull()
  })

  it('prints the time once for each run of moves in the same minute', () => {
    const at = (id: string, time: string, extra: Partial<FeedItem> = {}): FeedItem => ({
      ...claim,
      id,
      at: `2026-11-22T${time}`,
      ...extra,
    })
    const items = [
      at('a', '15:00:09'),
      at('b', '15:00:07'),
      at('c', '15:00:02', { replies: 1 }),
      at('d', '14:59:58'),
      at('e', '11:30:00', { kind: 'free_agent' }),
    ]
    expect([...timeRunStarts(items)]).toEqual(['a', 'd', 'e'])
  })

  it('gives posts and trades their own time and starts a new run after them', () => {
    const items: FeedItem[] = [
      { ...claim, id: 'a', at: '2026-11-22T15:00:09' },
      { ...post, id: 'p', at: '2026-11-22T15:00:05' },
      { ...claim, id: 'b', at: '2026-11-22T15:00:03' },
      { ...trade, id: 't', at: '2026-11-22T15:00:02' },
      { ...trade, id: 'u', at: '2026-11-22T15:00:01' },
    ]
    expect([...timeRunStarts(items)]).toEqual(['a', 'p', 'b', 't', 'u'])
  })

  it('starts a new run on a new day even at the same clock time', () => {
    const items = [
      { ...claim, id: 'a', at: '2026-11-22T15:00:00' },
      { ...claim, id: 'b', at: '2026-11-21T15:00:00' },
    ]
    expect([...timeRunStarts(items)]).toEqual(['a', 'b'])
    expect(timeRunStarts([]).size).toBe(0)
  })

  it('dates the Today and Yesterday milestones only', () => {
    const now = new Date('2026-11-23T18:00:00')
    const date = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    expect(dayDate('2026-11-23T09:00:00', now)).toBe(date('2026-11-23T09:00:00'))
    expect(dayDate('2026-11-22T15:00:00', now)).toBe(date('2026-11-22T15:00:00'))
    expect(dayDate('2026-11-22T15:00:00', now)).toMatch(/22/)
    expect(dayDate('2026-11-21T15:00:00', now)).toBeNull()
  })

  it('names the one FAAB leader, never a tie or an unspent league', () => {
    expect(faabLeaderId(teams)).toBe(8)
    expect(faabLeaderId([...teams, { id: 10, name: 'Tie', abbrev: 'TIE', faab_spent: 9 }])).toBeNull()
    expect(faabLeaderId(teams.map((t) => ({ ...t, faab_spent: 0 })))).toBeNull()
    expect(faabLeaderId(teams.map((t) => ({ ...t, faab_spent: null })))).toBeNull()
    expect(faabLeaderId([])).toBeNull()
  })

  it('breaks posts, trades and moves with replies out into moments', () => {
    expect(isMoment(post)).toBe(true)
    expect(isMoment(trade)).toBe(true)
    expect(isMoment(claim)).toBe(false)
    expect(isMoment({ ...claim, replies: 1 })).toBe(true)
    expect(isMoment({ ...claim, kind: 'free_agent', reactions: { counts: { smart: 2 }, mine: [] } })).toBe(false)
  })
})
