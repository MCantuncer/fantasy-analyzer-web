import { useState } from 'react'
import type { TradeIdea } from '../api/client'
import { names, pct } from '../lib/format'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'

const ACCEPTANCE = {
  likely: { label: 'Likely', tone: 'good' },
  possible: { label: 'Possible', tone: 'warn' },
  long_shot: { label: 'Long shot', tone: 'bad' },
} as const

function dollars(x: number) {
  return `$${Math.round(x)}`
}

function tradeKey(t: TradeIdea) {
  return `${t.partner_team_id}-${t.give.map((p) => p.id).join('.')}-${t.get.map((p) => p.id).join('.')}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="secondary"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          },
          () => undefined,
        )
      }}
    >
      {copied ? 'Copied' : 'Copy pitch'}
    </button>
  )
}

export function Trades({ trades }: { trades: TradeIdea[] }) {
  const [open, setOpen] = useState<string | null>(trades[0] ? tradeKey(trades[0]) : null)

  return (
    <section className="card flush trades-panel" aria-labelledby="trades-title">
      <div className="card-head">
        <h2 id="trades-title">Trades to offer</h2>
        <span className="small muted">Ranked by your gain and the chance they say yes</span>
      </div>
      {trades.length === 0 ? (
        <p className="empty">No deal helps both sides at a fair price right now. Check back after a few weeks of games.</p>
      ) : (
        <>
          <div className="move-cols" aria-hidden="true">
            <span>You give</span>
            <span>You get</span>
            <span>With</span>
            <span>They accept</span>
            <span className="right">Playoff odds</span>
          </div>
          <ol className="move-list">
            {trades.map((t, i) => {
              const key = tradeKey(t)
              const isOpen = open === key
              const acc = ACCEPTANCE[t.acceptance_label]
              return (
                <li key={key} id={`trade-${i}`} className={isOpen ? 'move open' : 'move'}>
                  <button
                    type="button"
                    className="move-row"
                    aria-expanded={isOpen}
                    aria-controls={`trade-${i}-detail`}
                    onClick={() => setOpen(isOpen ? null : key)}
                  >
                    <span>
                      <span className="label-sm">Give </span>
                      <strong>{names(t.give)}</strong>
                    </span>
                    <span>
                      <span className="label-sm">Get </span>
                      <strong>{names(t.get)}</strong>
                    </span>
                    <span>
                      <span className="label-sm">with </span>
                      {t.partner_team_name}
                    </span>
                    <span className="accept" title="Rough estimate from value balance and how much the deal helps them">
                      <span className={`tnum ${acc.tone}`}>
                        {pct(t.acceptance)} · {acc.label}
                      </span>
                      <span className="meter" aria-hidden="true">
                        <span className={`fill-${acc.tone}`} style={{ width: pct(t.acceptance) }} />
                      </span>
                    </span>
                    <OddsChange before={t.playoff_pct_before} after={t.playoff_pct_after} />
                  </button>
                  {isOpen && (
                    <div className="move-detail" id={`trade-${i}-detail`}>
                      <div>
                        <div className="detail-label">Your pitch to {t.partner_team_name}</div>
                        <p className="pitch">{t.pitch}</p>
                        {t.reasons.length > 0 && (
                          <>
                            <div className="detail-label">Why they might say yes</div>
                            <ul className="reasons">
                              {t.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        <ul className="reasons">
                          <li>
                            They get {dollars(t.value_they_get)} of value for {dollars(t.value_they_give)}, as owners
                            price players.
                          </li>
                          {t.my_drop && <li>You drop {t.my_drop.name} to make room.</li>}
                          {t.their_drop && <li>They would likely drop {t.their_drop.name}.</li>}
                        </ul>
                        <div className="row">
                          <CopyButton text={t.pitch} />
                        </div>
                      </div>
                      <ImpactBars changes={t.category_changes} label="Your weekly win chance per category" />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}
