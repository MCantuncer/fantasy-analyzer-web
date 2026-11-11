import type { AnalysisReport, PickupIdea, TradeIdea } from '../api/client'
import { expectedGain } from './expectedGain'
import { tradeKey } from './format'

export type BestMoveChoice =
  | { kind: 'pickup'; pickup: PickupIdea; key: string }
  | { kind: 'trade'; trade: TradeIdea; key: string }
  | { kind: 'hold'; key: 'hold' }

/** Playoff-odds points to one decimal, as whole tenths: the precision a trade row prints. */
const tenths = (points: number) => Math.round(points * 10)

/**
 * The one move the Best move card leads with: the top trade or the top straight add/drop,
 * whichever is worth more to your playoff odds (a pickup wins a tie), else hold. A trade needs
 * a yes, so it counts for its expected gain (its gain times the chance they accept, the number
 * its row prints); a pickup needs no one, so it counts in full. Only a straight add/drop
 * counts: a pickup that needs a trade first does need someone to agree.
 */
export function bestMoveOf(report: Pick<AnalysisReport, 'trades' | 'pickups'>): BestMoveChoice {
  const trade = report.trades[0]
  const pickup = report.pickups.find((p) => !p.open_spot_by_trade)
  const tradeGain = trade ? expectedGain(trade.acceptance, trade.playoff_pct_before, trade.playoff_pct_after) : -1
  const pickupGain = pickup ? (pickup.playoff_pct_after - pickup.playoff_pct_before) * 100 : -1
  if (tradeGain <= 0 && pickupGain <= 0) return { kind: 'hold', key: 'hold' }
  if (pickup && pickupGain > 0 && (tradeGain <= 0 || tenths(pickupGain) >= tenths(tradeGain))) {
    return { kind: 'pickup', pickup, key: pickupKey(pickup) }
  }
  return { kind: 'trade', trade, key: tradeKey(trade) }
}

/** Stable key for a pickup: who comes in and who goes. */
export function pickupKey(p: Pick<PickupIdea, 'add' | 'drop'>): string {
  return `${p.add.id}/${p.drop.id}`
}
