import { MaybeHandshake } from './MaybeHandshake'
import './TradeModes.css'

/** Which trade tool is open: Trade Park finding deals, Trade For, or Trade Park checking a deal. */
export type TradeMode = 'park' | 'trade-for' | 'check'

const PHONE: { id: TradeMode; label: string }[] = [
  { id: 'park', label: 'Trade Park' },
  { id: 'trade-for', label: 'Trade For' },
  { id: 'check', label: 'Check a Trade' },
]

/**
 * The head of the trade tools. Wider screens show the page title with Trade Park's own switch
 * (Find Deals | Check a Trade), or a Check a Trade button on Trade For, since the tab row already
 * holds both tools. Phones, where the bottom bar (and its one Trades item) replaces the tab row, get one
 * 3-way segment instead, at the bottom bar's own breakpoint.
 */
export function TradeModes({ mode, onMode }: { mode: TradeMode; onMode: (mode: TradeMode) => void }) {
  const forTab = mode === 'trade-for'
  return (
    <div className="tmo">
      <div className="tmo-head">
        <h1 className="tmo-title">{forTab ? 'Trade For' : 'Trade Park'}</h1>
        {forTab ? (
          <button type="button" className="secondary tmo-check" onClick={() => onMode('check')}>
            <MaybeHandshake size={18} />
            Check a Trade
          </button>
        ) : (
          <div className="tmo-seg tmo-wide" role="group" aria-label="Trade Park">
            <button type="button" aria-pressed={mode === 'park'} onClick={() => onMode('park')}>
              Find Deals
            </button>
            <button type="button" aria-pressed={mode === 'check'} onClick={() => onMode('check')}>
              <MaybeHandshake size={18} />
              Check a Trade
            </button>
          </div>
        )}
      </div>
      <div className="tmo-seg tmo-phone" role="group" aria-label="Trades">
        {PHONE.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
