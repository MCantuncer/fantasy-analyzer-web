import type { AnalysisReport, PickupIdea, TradeIdea } from '../api/client'
import { tradeKey } from './format'

export type BestMoveChoice =
  | { kind: 'pickup'; pickup: PickupIdea; key: string }
  | { kind: 'trade'; trade: TradeIdea; key: string }
  | { kind: 'hold'; key: 'hold' }

/**
 * The one move the Best move card leads with: the top trade or the top straight add/drop,
 * whichever raises the playoff odds more (a pickup wins a tie), else hold. Only a straight
 * add/drop counts: a pickup that needs a trade first does need someone to agree.
 */
export function bestMoveOf(report: Pick<AnalysisReport, 'trades' | 'pickups'>): BestMoveChoice {
  const trade = report.trades[0]
  const pickup = report.pickups.find((p) => !p.open_spot_by_trade)
  const tradeGain = trade ? trade.playoff_pct_after - trade.playoff_pct_before : -1
  const pickupGain = pickup ? pickup.playoff_pct_after - pickup.playoff_pct_before : -1
  if (tradeGain <= 0 && pickupGain <= 0) return { kind: 'hold', key: 'hold' }
  if (pickup && pickupGain >= tradeGain) return { kind: 'pickup', pickup, key: pickupKey(pickup) }
  return { kind: 'trade', trade, key: tradeKey(trade) }
}

/** Stable key for a pickup: who comes in and who goes. */
export function pickupKey(p: Pick<PickupIdea, 'add' | 'drop'>): string {
  return `${p.add.id}/${p.drop.id}`
}
