import { describe, expect, it } from 'vitest'
import { AFTER, BEFORE, CHANGES, P, ME, pickup, report } from '../test/newsSince'
import { buildNews } from './newsSince'

describe('buildNews', () => {
  it('shows only the moves that changed, with reasons the ids prove', () => {
    const { rows } = buildNews(BEFORE, AFTER, CHANGES)
    expect(rows.map((r) => r.kind)).toEqual(['best', 'trades'])
    const [best, trades] = rows
    expect(best).toMatchObject({
      title: 'Add Ayo Dosunmu',
      before: 0.39,
      after: 0.42,
      side: 'was Lopez',
    })
    expect(best.reason).toEqual({
      lead: 'Lopez went to',
      team: { id: 5, name: 'Baglayan BDSMs' },
    })
    expect(trades).toMatchObject({
      title: 'Get Ja Morant',
      side: '1 new · 1 gone',
    })
    expect(trades.reason).toEqual({
      team: { id: 8, name: 'Gergin Atamans' },
      tail: 'just added him',
    })
  })

  it('puts your own roster news apart and groups the rest of the league', () => {
    const { roster, league } = buildNews(BEFORE, AFTER, CHANGES)
    expect(roster.map((i) => [i.player.name, i.tag])).toEqual([
      ['Draymond Green', 'Back'],
      ['Scottie Barnes', 'DTD'],
    ])
    expect(league.hurt.map((i) => [i.player.name, i.tag])).toEqual([
      ['Desmond Bane', 'OUT'],
      ['Joel Embiid', 'DTD'],
    ])
    expect(league.back.map((i) => i.player.name)).toEqual(['Anthony Davis'])
    expect(league.moves.map((g) => [g.team.name, g.items.map((i) => `${i.sign}${i.player.name}`)])).toEqual([
      ['Baglayan BDSMs', ['+Brook Lopez', '−Bilal Coulibaly']],
      ['Gergin Atamans', ['+Ja Morant', '−Nikola Vucevic']],
      ['Simsek Splashers', ['+Klay Thompson']],
    ])
    expect(league.games).toBe(68)
  })

  it('says nothing of yours changed when the moves are the same, and only moves odds past the bar', () => {
    const same = buildNews(BEFORE, { ...BEFORE, season: report({ odds: 0.39 }).season }, CHANGES)
    expect(same.rows).toEqual([])
    const odds = buildNews(BEFORE, { ...BEFORE, season: report({ odds: 0.41 }).season }, CHANGES)
    expect(odds.rows).toEqual([
      {
        kind: 'odds',
        label: 'Season odds',
        title: 'Playoff odds',
        before: 0.38,
        after: 0.41,
        delta: 3,
      },
    ])
  })

  it('while running, shows only what the old report and the changes prove', () => {
    const { rows } = buildNews(BEFORE, null, CHANGES)
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'best',
        title: 'Lopez is off the board',
        reason: { lead: 'Went to', team: { id: 5, name: 'Baglayan BDSMs' } },
        pending: true,
      }),
      expect.objectContaining({
        kind: 'trades',
        title: '1 idea has Barnes',
        reason: { lead: 'He is now', tag: 'DTD' },
      }),
    ])
  })

  it('names a taken FA target that was not the best move', () => {
    const before = report({
      pickups: [pickup(P.dosunmu, 0.38, 0.42), pickup(P.lopez, 0.38, 0.41)],
    })
    const after = report({ pickups: [pickup(P.dosunmu, 0.38, 0.42)] })
    const { rows } = buildNews(before, after, CHANGES)
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'fa',
        title: 'Lopez is off the board',
        side: '1 gone',
        reason: {
          lead: 'Lopez went to',
          team: { id: 5, name: 'Baglayan BDSMs' },
        },
      }),
    ])
    expect(ME).toBe(3)
  })
})
