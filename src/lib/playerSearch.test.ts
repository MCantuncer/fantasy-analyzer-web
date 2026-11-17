import { describe, expect, it } from 'vitest'
import type { IndexedPlayer } from '../api/client'
import { buildIndex, fold, pieces, search } from './playerSearch'

function p(player_id: number, name: string, percent_owned = 50): IndexedPlayer {
  return {
    player_id,
    name,
    percent_owned,
    pro_team: 'DEN',
    position: 'C',
    owner_team_id: null,
    on_roster: true,
    injury_status: null,
  }
}

const index = buildIndex([
  p(1, 'Nikola Jokić', 100),
  p(2, 'LeBron James', 99),
  p(3, 'Shai Gilgeous-Alexander', 100),
  p(4, 'Royce O’Neale', 20),
  p(5, 'P.J. Washington', 60),
  p(6, 'Josh Hart', 70),
  p(7, 'Jordan Clarkson', 30),
  p(8, 'Nikola Jović', 40),
  p(9, 'Bojan Bogdanović', 1),
])

const names = (q: string) => search(index, q).map((h) => h.player.name)

describe('fold', () => {
  it('drops accents and keeps a map to the name as written', () => {
    expect(fold('Jokić').folded).toBe('jokic')
    expect(fold('Đorđević').folded).toBe('dordevic')
    expect(fold('ab').from).toEqual([0, 1])
  })
})

describe('search', () => {
  it('finds a name typed without its accents, and with them', () => {
    expect(names('jokic')).toEqual(['Nikola Jokić'])
    expect(names('Jokić')).toEqual(['Nikola Jokić'])
  })

  it('puts a name that starts with it first, then a word that does, then the more rostered', () => {
    expect(names('jo')).toEqual(['Josh Hart', 'Jordan Clarkson', 'Nikola Jokić', 'Nikola Jović'])
    expect(names('nikola')).toEqual(['Nikola Jokić', 'Nikola Jović'])
  })

  it('matches each typed word to the start of a word of his name', () => {
    expect(names('le ja')).toEqual(['LeBron James'])
    expect(names('ja le')).toEqual([])
  })

  it('knows initials and ignores dots and apostrophes', () => {
    expect(names('sga')).toEqual(['Shai Gilgeous-Alexander'])
    expect(names('pj')).toContain('P.J. Washington')
    expect(names('oneale')).toEqual(['Royce O’Neale'])
    expect(names('alexander')).toEqual(['Shai Gilgeous-Alexander'])
  })

  it('finds a stretch inside a name last, and nothing for one letter inside or a blank query', () => {
    expect(names('dan')).toEqual(['Jordan Clarkson', 'Bojan Bogdanović'])
    expect(names('   ')).toEqual([])
    expect(search(index, 'o', 20).every((h) => h.rank < 3)).toBe(true)
  })

  it('caps the list', () => {
    expect(search(index, 'j', 2).map((h) => h.player.name)).toEqual(['Josh Hart', 'Jordan Clarkson'])
  })
})

describe('pieces', () => {
  it('marks the typed part on the name as written', () => {
    const [hit] = search(index, 'jokic')
    expect(pieces(hit.player.name, hit.marks)).toEqual([
      { text: 'Nikola ', marked: false },
      { text: 'Jokić', marked: true },
    ])
    const [sga] = search(index, 'sga')
    expect(
      pieces(sga.player.name, sga.marks)
        .filter((x) => x.marked)
        .map((x) => x.text),
    ).toEqual(['S', 'G', 'A'])
  })
})

describe('recent players', () => {
  it('keeps the last five per league, newest first, without repeats', async () => {
    const { pushRecent, readRecent, clearRecent } = await import('./playerSearch')
    clearRecent(1, 2027)
    for (const id of [1, 2, 3, 4, 5, 6, 3]) pushRecent(1, 2027, id)
    expect(readRecent(1, 2027)).toEqual([3, 6, 5, 4, 2])
    expect(readRecent(2, 2027)).toEqual([])
    localStorage.setItem('player-search-recent:1:2027', 'not json')
    expect(readRecent(1, 2027)).toEqual([])
  })
})
