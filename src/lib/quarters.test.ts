import { describe, expect, it } from 'vitest'
import type { PregameBox, PregameQuarters } from '../api/client'
import raw from '../test/pregame-orl-bkn.json'
import day from '../test/quarters-day.json'
import {
  habitSource,
  leanLabel,
  leanOf,
  leanSize,
  leaningSide,
  pieces,
  quarterHeadline,
  quarterSentence,
  roleLine,
  signed,
} from './quarters'

// Tonight's quarters (2026-11-21 UTC slate, the real engine) on the ORL at BKN box for its names.
type DayGame = { call: { away: number; home: number; chance: number }; away: Side; home: Side }
type Side = { team: string; quarters: PregameQuarters }
const games = (day as unknown as { games: DayGame[] }).games
const NAMES: Record<string, string> = {
  CHA: 'Charlotte Hornets',
  ATL: 'Atlanta Hawks',
  ORL: 'Orlando Magic',
  BKN: 'Brooklyn Nets',
  IND: 'Indiana Pacers',
  CLE: 'Cleveland Cavaliers',
  TOR: 'Toronto Raptors',
  DET: 'Detroit Pistons',
  WSH: 'Washington Wizards',
  CHI: 'Chicago Bulls',
  NO: 'New Orleans Pelicans',
  OKC: 'Oklahoma City Thunder',
  PHX: 'Phoenix Suns',
  UTAH: 'Utah Jazz',
  HOU: 'Houston Rockets',
  DEN: 'Denver Nuggets',
  SAC: 'Sacramento Kings',
  LAL: 'Los Angeles Lakers',
}
const base = raw as unknown as PregameBox
function box(g: DayGame): PregameBox {
  const side = (s: 'away' | 'home') => ({
    ...base[s],
    abbrev: g[s].team,
    name: NAMES[g[s].team],
    call: g.call[s],
    quarters: g[s].quarters,
  })
  return { ...base, chance: g.call.chance, away: side('away'), home: side('home') }
}
const find = (a: string) => box(games.find((g) => g.away.team === a)!)

describe('quarters', () => {
  it('reads a flat night as flat', () => {
    const b = find('PHX')
    expect(quarterHeadline(b)).toBe('No real lean either side. Both dip in the 4th, like every team.')
    const l = leanOf(b.away.quarters!)
    expect(l.even).toBe(true)
    expect(leanLabel(l)).toBe('Even all night')
    expect(leanSize(l)).toEqual({ lead: 'Within ', num: '0.4', tail: ' of a typical quarter' })
  })

  it('says who leans and why, in 14 words or fewer', () => {
    const okc = find('NO')
    // "as underdogs do" would make it 15 words, so it goes
    expect(quarterHeadline(okc)).toBe('New Orleans starts a little slower; Oklahoma City starts a little quicker.')
    expect(leaningSide(okc)).toBe('away')
    const lal = find('SAC')
    const h = quarterHeadline(lal)
    expect(h.split(/\s+/).length).toBeLessThanOrEqual(14)
    expect(h).toMatch(/^Los Angeles starts a little quicker/)
    expect(quarterHeadline(find('WSH'))).toBe('Washington starts a little slower; Chicago stays even.')
    for (const g of games) expect(quarterHeadline(box(g)).split(/\s+/).length).toBeLessThanOrEqual(14)
  })

  it('names a strong habit plainly', () => {
    const q: PregameQuarters = {
      points: [27, 27, 30, 26],
      raw: [27.07, 27.08, 29.59, 25.96],
      league: [27.86, 27.67, 27.87, 26.58],
      favourite: [-0.19, -0.09, -0.08, 0.08],
      shape: [-0.6, -0.5, 1.8, -0.7],
      games: 18,
    }
    const l = leanOf(q)
    expect(l.phrase).toBe('is strong after halftime')
    expect(leanLabel(l)).toBe('Strong after halftime')
    expect(leanSize(l)).toEqual({ lead: '', num: '+1.7', tail: ' vs a typical 3rd' })
    expect(habitSource(18)).toBe('From last season and 18 games this season.')
    expect(habitSource(0)).toBe('From last season; this season joins as games are played.')
  })

  it('adds the pieces up to the number shown, column by column', () => {
    for (const g of games)
      for (const s of ['away', 'home'] as const)
        for (const p of pieces(g[s].quarters)) {
          expect(Math.round((p.league + p.favourite + p.habit) * 10) / 10).toBeCloseTo(p.raw, 5)
          expect(Math.round(p.raw)).toBeGreaterThanOrEqual(p.points - 1)
        }
  })

  it('writes signs and roles plainly', () => {
    expect(signed(0.34)).toBe('+0.3')
    expect(signed(-0.41)).toBe('−0.4')
    expect(signed(0.01)).toBe('·')
    const okc = find('NO')
    expect(roleLine(okc, 'home')).toMatch(/^Oklahoma City is the favourite/)
    expect(roleLine(okc, 'away')).toMatch(/^New Orleans is the underdog/)
    expect(roleLine(find('PHX'), 'away')).toBe('A close call, so this barely moves.')
    expect(quarterSentence(okc)).toBe(
      'Our number for each quarter. New Orleans, starts a little slower: 1st 27; 2nd 28; 3rd 28; 4th 27. Oklahoma City, starts a little quicker: 1st 31; 2nd 30; 3rd 30; 4th 29.',
    )
  })
})
