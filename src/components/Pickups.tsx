import { useState } from 'react'
import type { PickupIdea } from '../api/client'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'
import { ordinal, pct, ptsDiff } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import { PlayerChips } from './PlayerCard'
import './Pickups.css'

interface Props {
  pickups: PickupIdea[]
  faab: number | null | undefined
  /** Your place in the rolling waiver order, in leagues without FAAB. */
  waiverPriority?: number | null
  teams?: number
}

export function Pickups({ pickups, faab, waiverPriority, teams }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const keepRow = useKeepRowInView(open)
  // Most days every idea drops the same player from the same odds: say that once, not on every row.
  const first = pickups[0]
  const sharedDrop =
    first && pickups.length > 1 && pickups.every((p) => !p.open_spot_by_trade && p.drop.id === first.drop.id)
      ? first.drop
      : null
  const sameStart = first && pickups.every((p) => p.playoff_pct_before === first.playoff_pct_before)
  const maxGain = Math.max(1, ...pickups.map((p) => ptsDiff(p.playoff_pct_before, p.playoff_pct_after)))

  return (
    <section className="card flush pickups-panel" aria-labelledby="pickups-title">
      <div className="card-head">
        <h2 id="pickups-title">FA Targets</h2>
        {faab != null && <span className="small muted">${faab} FAAB left</span>}
        {faab == null && waiverPriority != null && (
          <span className="small muted">
            Waiver priority {ordinal(waiverPriority)}
            {teams ? ` of ${teams}` : ''}
          </span>
        )}
      </div>
      {pickups.length === 0 ? (
        <p className="empty">No free agent improves your team right now.</p>
      ) : (
        <>
          {sharedDrop && (
            <p className="pk-shared">
              <PlayerHead player={sharedDrop} size={28} />
              <span>
                Each one replaces <strong>{sharedDrop.name}</strong>
              </span>
              {sameStart && <span className="pk-from num">from {pct(first.playoff_pct_before)}</span>}
            </p>
          )}
          <ol className="move-list" onClickCapture={keepRow}>
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
                    <PlayerHead player={p.add} size={40} />
                    <span>
                      <span className="good" aria-hidden="true">
                        +{' '}
                      </span>
                      <span className="sr-only">Add </span>
                      <strong>{p.add.name}</strong>
                      <br />
                      {sharedDrop ? (
                        <span className="pk-gain" aria-hidden="true">
                          <span
                            style={{
                              width: `${(Math.max(0, ptsDiff(p.playoff_pct_before, p.playoff_pct_after)) / maxGain) * 100}%`,
                            }}
                          />
                        </span>
                      ) : (
                        <span className="small muted">
                          <span className="bad" aria-hidden="true">
                            −{' '}
                          </span>
                          <span className="sr-only">{p.open_spot_by_trade ? 'trade ' : 'drop '}</span>
                          {p.open_spot_by_trade ? `Trade ${p.drop.name} first to open the spot` : p.drop.name}
                        </span>
                      )}
                    </span>
                    <OddsChange
                      before={p.playoff_pct_before}
                      after={p.playoff_pct_after}
                      showBefore={!(sharedDrop && sameStart)}
                    />
                  </button>
                  {isOpen && (
                    <div className="move-detail" id={`pickup-${i}-detail`}>
                      <div>
                        <PlayerChips players={[p.add, p.drop]} label="Players in this move" />
                        <ul className="pk-facts" aria-label={`About ${p.add.name}`}>
                          <li>{p.add.positions.join('/')}</li>
                          <li>
                            <span className="num">{Math.round(p.add.percent_owned)}%</span> owned
                          </li>
                          <li className={p.availability === 'WAIVERS' ? 'pk-waivers' : 'pk-fa'}>
                            {p.availability === 'WAIVERS' ? 'On waivers' : 'Free agent'}
                          </li>
                        </ul>
                        <ul className="reasons">
                          {p.availability === 'WAIVERS' && faab == null && waiverPriority != null && (
                            <li>
                              A claim uses your waiver priority ({ordinal(waiverPriority)}) and a successful one usually
                              sends you to the back of the order. Teams ahead of you can claim him first.
                            </li>
                          )}
                          {p.open_spot_by_trade ? (
                            <li>
                              {p.drop.name} has trade value ({Math.round(p.drop.percent_owned)}% owned), so don't
                              release him: move him in a trade that brings back fewer players, then add {p.add.name}.
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
        </>
      )}
    </section>
  )
}
