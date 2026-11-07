import { describe, expect, it } from 'vitest'
import type { GameLine } from '../api/client'
import { nextSort, sortLines } from './boxSort'

function line(name: string, s: Partial<GameLine> = {}): GameLine {
  return {
    player_id: name.length,
    name,
    pro_team_id: 1,
    minutes: 20,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tpm: 0,
    to: 0,
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
    starter: false,
    ...s,
  }
}

const names = (ls: GameLine[]) => ls.map((l) => l.name)

describe('nextSort', () => {
  it('goes highest first, then lowest first, then back to the game order', () => {
    const one = nextSort(null, 'reb')
    expect(one).toEqual({ cat: 'reb', dir: 'desc' })
    const two = nextSort(one, 'reb')
    expect(two).toEqual({ cat: 'reb', dir: 'asc' })
    expect(nextSort(two, 'reb')).toBeNull()
  })

  it('starts a new category highest first', () => {
    expect(nextSort({ cat: 'reb', dir: 'asc' }, 'ast')).toEqual({ cat: 'ast', dir: 'desc' })
  })
})

describe('sortLines', () => {
  const lines = [line('A', { reb: 2 }), line('B', { reb: 9 }), line('C', { reb: 2 }), line('D', { reb: 5 })]

  it('keeps the game order with no sort', () => {
    expect(names(sortLines(lines, null))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('sorts both ways and keeps the game order on ties', () => {
    expect(names(sortLines(lines, { cat: 'reb', dir: 'desc' }))).toEqual(['B', 'D', 'A', 'C'])
    expect(names(sortLines(lines, { cat: 'reb', dir: 'asc' }))).toEqual(['A', 'C', 'D', 'B'])
  })

  it('sorts shooting by makes, fewer misses first on a tie', () => {
    const shots = [
      line('one', { fgm: 1, fga: 1 }),
      line('nine', { fgm: 9, fga: 16 }),
      line('nineB', { fgm: 9, fga: 12 }),
    ]
    expect(names(sortLines(shots, { cat: 'fg', dir: 'desc' }))).toEqual(['nineB', 'nine', 'one'])
  })

  it('does not change the list it was given', () => {
    sortLines(lines, { cat: 'reb', dir: 'desc' })
    expect(names(lines)).toEqual(['A', 'B', 'C', 'D'])
  })
})
