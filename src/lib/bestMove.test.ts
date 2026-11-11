import { describe, expect, it } from 'vitest'
import { P, pickup, trade } from '../test/newsSince'
import { bestMoveOf } from './bestMove'

const THEM: [number, string] = [8, 'Gergin Atamans']

/** A trade for Morant that moves your odds from `before` to `after`, with this chance of a yes. */
function deal(before: number, after: number, acceptance: number) {
  return { ...trade(THEM, [P.mitchell], [P.morant], before, after), acceptance }
}

describe('bestMoveOf', () => {
  it('holds when nothing raises your odds', () => {
    expect(bestMoveOf({ trades: [], pickups: [] }).kind).toBe('hold')
    expect(bestMoveOf({ trades: [deal(0.48, 0.47, 0.5)], pickups: [pickup(P.lopez, 0.48, 0.48)] }).kind).toBe('hold')
  })

  it('leads with a sure pickup over a long-shot trade that gains more on paper', () => {
    // +8 at 27% is worth +2.2, less than the pickup's +4.
    const best = bestMoveOf({ trades: [deal(0.48, 0.56, 0.27)], pickups: [pickup(P.lopez, 0.48, 0.52)] })
    expect(best.kind).toBe('pickup')
  })

  it('leads with the trade when it is worth more even after the chance they say no', () => {
    // +12 at 50% is worth +6, more than the pickup's +4.
    const best = bestMoveOf({ trades: [deal(0.48, 0.6, 0.5)], pickups: [pickup(P.lopez, 0.48, 0.52)] })
    expect(best.kind).toBe('trade')
  })

  it('gives a tie to the pickup: no one has to agree', () => {
    // +8 at 50% is worth +4, the same as the pickup.
    const best = bestMoveOf({ trades: [deal(0.47, 0.55, 0.5)], pickups: [pickup(P.lopez, 0.47, 0.51)] })
    expect(best.kind).toBe('pickup')
  })

  it('leads with the trade when the only pickup lowers your odds or needs a trade first', () => {
    const down = bestMoveOf({ trades: [deal(0.48, 0.5, 0.1)], pickups: [pickup(P.lopez, 0.48, 0.47)] })
    expect(down.kind).toBe('trade')
    const byTrade = { ...pickup(P.lopez, 0.4, 0.6), open_spot_by_trade: true }
    expect(bestMoveOf({ trades: [deal(0.48, 0.5, 0.1)], pickups: [byTrade] }).kind).toBe('trade')
  })

  it('never leads with a pickup that lowers your odds', () => {
    const best = bestMoveOf({ trades: [deal(0.48, 0.5, 0.01)], pickups: [pickup(P.lopez, 0.48, 0.4798)] })
    expect(best.kind).toBe('trade')
  })
})
