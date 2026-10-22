import type { PickupIdea } from '../api/client'
import { signed } from '../lib/format'
import { CategoryChanges } from './CategoryChanges'
import { OddsChange } from './OddsChange'

export function Pickups({ pickups, faab }: { pickups: PickupIdea[]; faab: number | null | undefined }) {
  return (
    <section className="card">
      <h2>Pickups</h2>
      <p className="muted">
        Every healthy free agent tested against every possible drop on your roster.
        {faab != null && ` You have $${faab} of FAAB left.`}
      </p>
      {pickups.length === 0 ? (
        <p>No free agent improves your team right now.</p>
      ) : (
        <ol className="ideas">
          {pickups.map((p) => (
            <li key={p.add.id} className="idea">
              <div className="idea-main">
                <div>
                  <div className="idea-title">
                    Add <strong>{p.add.name}</strong>, drop <strong>{p.drop.name}</strong>
                  </div>
                  <div className="muted">
                    {p.add.positions.join('/')} · {p.add.percent_owned}% owned ·{' '}
                    {p.availability === 'WAIVERS' ? 'on waivers' : 'free agent'} · you {signed(p.my_cats_gain)}{' '}
                    cats/wk
                  </div>
                </div>
                <OddsChange before={p.playoff_pct_before} after={p.playoff_pct_after} />
              </div>
              <div className="idea-foot">
                <CategoryChanges changes={p.category_changes} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
