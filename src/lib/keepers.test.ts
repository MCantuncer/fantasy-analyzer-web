import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeep, sameKeepers, settleKeepers, storeKeep } from './keepers'

describe('keepers in the browser', () => {
  beforeEach(() => localStorage.clear())

  it('remembers keepers per league and team', () => {
    storeKeep(7, 3, [11, 22])
    expect(loadKeep(7, 3)).toEqual([11, 22])
    expect(loadKeep(7, 4)).toEqual([])
    expect(loadKeep(8, 3)).toEqual([])
  })

  it('ignores a stored value that is not a list of ids', () => {
    localStorage.setItem('keep:7:3', '{"oops":1}')
    expect(loadKeep(7, 3)).toEqual([])
    localStorage.setItem('keep:7:3', '[1,"2",3]')
    expect(loadKeep(7, 3)).toEqual([1, 3])
  })
})

describe('sameKeepers', () => {
  it('compares the players, not their order', () => {
    expect(sameKeepers([3, 1, 2], [1, 2, 3])).toBe(true)
    expect(sameKeepers([1, 2], [1, 2, 3])).toBe(false)
    expect(sameKeepers([], [])).toBe(true)
  })
})

describe('settleKeepers', () => {
  it("takes the account's list once it exists", () => {
    const settled = settleKeepers([1], { player_ids: [2, 3], saved: true })
    expect(settled).toEqual({ keep: [2, 3], upload: false, changed: true })
  })

  it('changes nothing when both agree', () => {
    const settled = settleKeepers([3, 2], { player_ids: [2, 3], saved: true })
    expect(settled).toEqual({ keep: [2, 3], upload: false, changed: false })
  })

  it('an emptied list on the account clears this browser too', () => {
    const settled = settleKeepers([1], { player_ids: [], saved: true })
    expect(settled).toEqual({ keep: [], upload: false, changed: true })
  })

  it("uploads this browser's keepers when the account has none saved yet", () => {
    const settled = settleKeepers([1, 2], { player_ids: [], saved: false })
    expect(settled).toEqual({ keep: [1, 2], upload: true, changed: false })
  })

  it('has nothing to upload from a browser without keepers', () => {
    const settled = settleKeepers([], { player_ids: [], saved: false })
    expect(settled).toEqual({ keep: [], upload: false, changed: false })
  })
})
