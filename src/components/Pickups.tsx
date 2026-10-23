import { useState } from 'react'
import type { PickupIdea } from '../api/client'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'

export function Pickups({ pickups, faab }: { pickups: PickupIdea[]; faab: number | null | undefined }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="card flush pickups-panel" aria-labelledby="pickups-title">
      <div className="card-head">
        <h2 id="pickups-title">Pickups</h2>
        {faab != null && <span className="small muted">${faab} FAAB left</span>}
      </div>
      {pickups.length === 0 ? (
        <p className="empty">No free agent improves your team right now.</p>
      ) : (
        <ol className="move-list">
          {pickups.map((p, i) => {
            const isOpen = open === p.add.id
            return (
              <li key={p.add.id} id={`pickup-${i}`} className={isOpen ? 'move open' : 'move'}>
                <button
                  type="button"
                  className="move-row pickup-row"
                  aria-expanded={isOpen}
                  aria-controls={`pickup-${i}-detail`}
                  onClick={() => setOpen(isOpen ? null : p.add.id)}
                >
                  <span>
                    <span className="good" aria-hidden="true">
                      +{' '}
                    </span>
                    <span className="sr-only">Add </span>
                    <strong>{p.add.name}</strong>
                    <br />
                    <span className="small muted">
                      <span className="bad" aria-hidden="true">
                        −{' '}
                      </span>
                      <span className="sr-only">{p.open_spot_by_trade ? 'trade ' : 'drop '}</span>
                      {p.open_spot_by_trade ? `Trade ${p.drop.name} first to open the spot` : p.drop.name}
                    </span>
                  </span>
                  <OddsChange before={p.playoff_pct_before} after={p.playoff_pct_after} />
                </button>
                {isOpen && (
                  <div className="move-detail" id={`pickup-${i}-detail`}>
                    <div>
                      <ul className="reasons">
                        <li>
                          {p.add.name}: {p.add.positions.join('/')}, {p.add.percent_owned}% owned,{' '}
                          {p.availability === 'WAIVERS' ? 'on waivers' : 'free agent'}.
                        </li>
                        {p.open_spot_by_trade ? (
                          <li>
                            {p.drop.name} has trade value ({Math.round(p.drop.percent_owned)}% owned), so don't release
                            him: move him in a trade that brings back fewer players, then add {p.add.name}.
                          </li>
                        ) : (
                          <li>
                            You drop {p.drop.name} ({p.drop.positions.join('/')}, {Math.round(p.drop.percent_owned)}%
                            owned): replaceable from free agency.
                          </li>
                        )}
                      </ul>
                    </div>
                    <ImpactBars changes={p.category_changes} label="Your weekly win chance per category" />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
