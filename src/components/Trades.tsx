import type { PlayerRef, TradeIdea } from '../api/client'
import { signed } from '../lib/format'
import { CategoryChanges } from './CategoryChanges'
import { OddsChange } from './OddsChange'

const PAPER = {
  win_for_them: { label: 'Looks like a win for them', hint: 'They get the higher-ranked player on paper.' },
  even: { label: 'Even on paper', hint: 'Rankings call it roughly fair.' },
  stretch: { label: 'Stretch on paper', hint: 'You get the higher-ranked player; pitch it on their needs.' },
} as const

function names(players: PlayerRef[]) {
  return players.map((p) => p.name).join(' + ')
}

export function Trades({ trades }: { trades: TradeIdea[] }) {
  return (
    <section className="card">
      <h2>Trades to offer</h2>
      <p className="muted">
        Every 1-for-1 in the league, kept only if it helps you and does not hurt the other team in the categories they
        care about. Ranked by your playoff odds after the trade.
      </p>
      {trades.length === 0 ? (
        <p>No 1-for-1 trade helps both sides right now.</p>
      ) : (
        <ol className="ideas">
          {trades.map((t) => (
            <li key={`${t.partner_team_id}-${t.give[0]?.id}-${t.get[0]?.id}`} className="idea">
              <div className="idea-main">
                <div>
                  <div className="idea-title">
                    Give <strong>{names(t.give)}</strong>, get <strong>{names(t.get)}</strong>
                  </div>
                  <div className="muted">
                    with {t.partner_team_name} · you {signed(t.my_cats_gain)} cats/wk, they{' '}
                    {signed(t.their_cats_gain)} under their build
                  </div>
                </div>
                <OddsChange before={t.playoff_pct_before} after={t.playoff_pct_after} />
              </div>
              <div className="idea-foot">
                <span className={`badge paper-${t.paper_verdict}`} title={PAPER[t.paper_verdict].hint}>
                  {PAPER[t.paper_verdict].label}
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
