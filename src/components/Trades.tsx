import type { PlayerRef, TradeIdea } from '../api/client'
import { pct, signed } from '../lib/format'
import { CategoryChanges } from './CategoryChanges'
import { OddsChange } from './OddsChange'

const ACCEPTANCE = {
  likely: 'Likely accepted',
  possible: 'Possible',
  long_shot: 'Long shot',
} as const

function names(players: PlayerRef[]) {
  return players.map((p) => p.name).join(' + ')
}

function dollars(x: number) {
  return `$${Math.round(x)}`
}

export function Trades({ trades }: { trades: TradeIdea[] }) {
  return (
    <section className="card">
      <h2>Trades to offer</h2>
      <p className="muted">
        1-for-1, 2-for-1 and 1-for-2 deals that help you, help the other team in the categories it competes in, and
        give them fair value as owners see it (rankings, auction values, what they paid in your draft, with a premium
        for stars). Ranked by your playoff gain weighted by the chance they accept.
      </p>
      {trades.length === 0 ? (
        <p>No deal helps both sides at a fair price right now. Check back after a few weeks of games.</p>
      ) : (
        <ol className="ideas">
          {trades.map((t) => (
            <li key={`${t.partner_team_id}-${t.give.map((p) => p.id).join('.')}-${t.get.map((p) => p.id).join('.')}`} className="idea">
              <div className="idea-main">
                <div>
                  <div className="idea-title">
                    Give <strong>{names(t.give)}</strong>, get <strong>{names(t.get)}</strong>
                  </div>
                  <div className="muted">
                    with {t.partner_team_name} · they get {dollars(t.value_they_get)} of value for{' '}
                    {dollars(t.value_they_give)} · you {signed(t.my_cats_gain)} cats/wk, they {signed(t.their_cats_gain)}
                  </div>
                  {t.my_drop && <div className="muted small">You drop {t.my_drop.name} to make room.</div>}
                  {t.their_drop && <div className="muted small">They'd likely drop {t.their_drop.name}.</div>}
                </div>
                <OddsChange before={t.playoff_pct_before} after={t.playoff_pct_after} />
              </div>
              <p className="pitch">
                <span className="muted">Pitch: </span>
                {t.pitch}
              </p>
              {t.reasons.length > 0 && (
                <ul className="reasons small">
                  {t.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="idea-foot">
                <span
                  className={`badge accept-${t.acceptance_label}`}
                  title="Rough estimate from value balance and how much the deal helps them"
                >
                  {ACCEPTANCE[t.acceptance_label]} · {pct(t.acceptance)}
                </span>
                <CategoryChanges changes={t.category_changes} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
