import { describe, expect, it } from 'vitest'
import type { PregameBox } from '../api/client'
import raw from '../test/pregame-orl-bkn.json'
import {
  OUTCOMES,
  WHY_COLS,
  countdown,
  headline,
  houseLight,
  lastName,
  lineupNews,
  outShare,
  outcomes,
  people,
  place,
  rowNote,
  splitRotation,
  stepText,
  teamLine,
  whyLines,
  whySteps,
} from './pregame'

// ORL at BKN, NBA day 32 (2026-11-21 UTC), from the real /api/scores/pregame against League A.
const box = raw as unknown as PregameBox

describe('pre-game box', () => {
  it('names a team by its place', () => {
    expect(place(box.away)).toBe('Orlando')
    expect(place({ name: 'Oklahoma City Thunder', abbrev: 'OKC' })).toBe('Oklahoma City')
    expect(place({ name: 'Portland Trail Blazers', abbrev: 'POR' })).toBe('Portland')
  })

  it('says what decides the call in one short sentence, without betting words', () => {
    const h = headline(box)
    expect(h).toBe("Brooklyn's defense is soft, and that outweighs Orlando playing on the road.")
    expect(h.split(' ').length).toBeLessThanOrEqual(16)
    expect(h).not.toMatch(/spread|odds|lock|over\/under|props|vegas/i)
  })

  it('lists the margin piece by piece, adding up to the card, then the total', () => {
    const lines = whyLines(box)
    expect(lines.map((l) => l.label)).toEqual(['Matchup', 'Home court', 'Three-point luck', 'Back-to-back', 'Total'])
    const pieces = lines.filter((l) => l.kind !== 'total')
    expect(pieces.reduce((s, l) => s + l.points, 0)).toBe(box.margin)
    expect(lines[0].text).toContain('Brooklyn gives up 1.17 points a trip, 4% more than the league')
    expect(lines[0].text).toContain('about 100 trips each: 115 for Orlando, 109 for Brooklyn')
    expect(lines[2].text).toContain('Teams have shot unusually well from three against both, more so against Orlando')
    expect(lines[2].text).toContain('helps Orlando about 1 point')
    expect(lines[3]).toMatchObject({ quiet: true, text: 'Neither team played last night.' })
    expect(lines[4].text).toBe('Orlando by 5, 114 to 109. Calls at 55–64% have picked the winner 61 times in 100.')
  })

  it('shows how games called this close have really ended', () => {
    for (const r of OUTCOMES) expect(r.bands.reduce((a, b) => a + b, 0)).toBe(100)
    const { bands, blowout } = outcomes(box)
    expect(bands.map((b) => b.label)).toEqual([
      'Orlando by 15+',
      'Orlando by 6–14',
      'Within 5',
      'Brooklyn by 6–14',
      'Brooklyn by 15+',
    ])
    expect(bands.map((b) => b.times)).toEqual([23, 29, 26, 15, 7])
    expect(blowout).toBe(18)
    expect(outcomes({ ...box, margin: 16 }).bands[0].times).toBe(50)
    expect(outcomes({ ...box, margin: 1 }).bands[2].times).toBe(29)
  })

  it('counts down, opens the lineup-news window and brings the light up', () => {
    const tip = '2026-11-21T00:30:00Z'
    const at = (iso: string) => Date.parse(iso)
    expect(countdown(tip, at('2026-11-20T22:17:00Z'))).toBe('2h 13m')
    expect(countdown(tip, at('2026-11-21T00:00:00Z'))).toBe('30m')
    expect(countdown(tip, at('2026-11-21T00:29:30Z'))).toBe('under a minute')
    expect(countdown(tip, at('2026-11-21T00:31:00Z'))).toBeNull()
    expect(lineupNews(tip, at('2026-11-20T22:00:00Z')).state).toBe('later')
    expect(lineupNews(tip, at('2026-11-20T23:30:00Z')).state).toBe('now')
    expect(lineupNews(tip, at('2026-11-21T00:10:00Z')).state).toBe('set')
    expect(houseLight(tip, at('2026-11-20T12:00:00Z'))).toBe(0.35)
    expect(houseLight(tip, at('2026-11-21T00:30:00Z'))).toBe(1)
  })

  it('finds your players and your rival’s on both sides, out ones included', () => {
    const { mine, rival } = people(box, 3, 8)
    expect(mine.map((x) => [x.p.name, x.out])).toEqual([['Paolo Banchero', true]])
    expect(rival.map((x) => x.p.name)).toEqual(['Franz Wagner', 'Wendell Carter Jr.'])
    expect(people(box, 3, null).rival).toEqual([])
  })

  it('says where an absent player’s share went', () => {
    const { share, gains } = outShare(box.away)
    expect(share).toBe(24)
    expect(gains.length).toBeGreaterThan(0)
    expect(gains.length).toBeLessThanOrEqual(4)
    expect(gains[0].pts).toBeGreaterThanOrEqual(gains[gains.length - 1].pts)
    expect(outShare(box.home).share).toBeNull()
  })

  it('builds a line step by step so every column adds up as shown', () => {
    for (const p of [...box.away.players, ...box.home.players]) {
      const steps = whySteps(p.line)
      expect(steps[0].kind).toBe('usual')
      expect(steps[steps.length - 1].kind).toBe('tonight')
      for (const k of WHY_COLS) {
        const sum = steps.slice(0, -1).reduce((s, x) => s + x.values[k], 0)
        expect(sum).toBeCloseTo(steps[steps.length - 1].values[k], 3)
      }
    }
    expect(stepText('pts', 0, true)).toBe('·')
    expect(stepText('pts', 1.24, true)).toBe('+1.2')
    expect(stepText('pts', -0.5, true)).toBe('−0.5')
    expect(stepText('fg_pct', 0.476, false)).toBe('.476')
    expect(stepText('fg_pct', 0.006, true)).toBe('+.006')
  })

  it('gives a row the reason his teammates don’t share', () => {
    const wagner = box.away.players[0]
    expect(rowNote(wagner, box.away)).not.toMatch(/Teammates out/)
    expect(rowNote(wagner, box.away)).toBe('Big minutes ease off: 1 point fewer than usual')
    expect(splitRotation(box.home.players).starters).toHaveLength(5)
  })

  it('explains the team line against Our call, naming the real cause', () => {
    const t = teamLine(box.away)
    expect(t.gap).toBe(18.1)
    expect(t.minutes).toBeGreaterThan(245)
    expect(t.why[0]).toContain('more than the 240 a game has. We tested trimming them to fit on five seasons')
    expect(t.why.some((w) => w.startsWith('Banchero is out, he scores 24 a game, and these lines picked up'))).toBe(
      true,
    )
    expect(t.why[t.why.length - 1]).toBe('For the team, go by 114. For a player, go by his line.')
    const close = teamLine({ ...box.home, team_line: { ...box.home.team_line, gap: 1.2 } })
    expect(close.why[0]).toMatch(/^Close/)
  })

  it('keeps suffixes with the last name', () => {
    expect(lastName('Wendell Carter Jr.')).toBe('Carter Jr.')
    expect(lastName('Franz Wagner')).toBe('Wagner')
  })
})
