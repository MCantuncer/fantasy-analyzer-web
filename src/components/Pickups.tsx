import { useState } from 'react'
import { ArrowsLeftRight, Coins, UserPlus } from '@phosphor-icons/react'
import type { AnalysisReport, PickupIdea } from '../api/client'
import { ImpactBars } from './ImpactBars'
import { Sign } from './OddsChange'
import { InjuryBadges } from './InjuryBadges'
import { ordinal, pct, ptsDiff } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import { PlayerChips } from './PlayerCard'
import { SpotStrip } from './MoveTiming'
import { ifMade, keptDays, lastName, longDay, spotGames, waitLabel } from '../lib/moveTiming'
import './Pickups.css'

interface Props {
  pickups: PickupIdea[]
  faab: number | null | undefined
  /** Your place in the rolling waiver order, in leagues without FAAB. */
  waiverPriority?: number | null
  teams?: number
  /** This week's matchup: adds left in it. */
  week?: AnalysisReport['week']
}

/** The categories a pickup helps most (up to two), for the small tags on its row. */
function topCats(changes: Record<string, number>) {
  return Object.entries(changes)
    .filter(([, v]) => v >= 0.02)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([c]) => c)
}

const gain = (p: PickupIdea) => ptsDiff(p.playoff_pct_before, p.playoff_pct_after)

/** "Make this Sunday: Niang plays Thursday and Saturday first, 3 games in the spot instead of 1." */
function waitSaid(p: PickupIdea): string {
  const t = p.timing
  if (!t?.wait) return ''
  const g = spotGames(t)
  const days = keptDays(t).map((d) => longDay(d.date))
  return ` ${waitLabel(t)}: ${lastName(p.drop.name)} plays ${days.join(' and ')} first, ${g.best} games in the spot instead of ${g.now}.`
}

export function Pickups({ pickups, faab, waiverPriority, teams, week }: Props) {
  const adds = week?.adds_allowed != null ? Math.max(week.adds_allowed - week.adds_used, 0) : null
  const [open, setOpen] = useState<number | null>(null)
  const keepRow = useKeepRowInView(open)
  // Most days every idea drops the same player from the same odds: say that once, not on every row.
  const first = pickups[0]
  const sharedDrop =
    first && pickups.length > 1 && pickups.every((p) => !p.open_spot_by_trade && p.drop.id === first.drop.id)
      ? first.drop
      : null
  const sameStart = first && pickups.every((p) => p.playoff_pct_before === first.playoff_pct_before)

  return (
    <section className="card flush pickups-panel" aria-labelledby="pickups-title">
      <div className="card-head">
        <h2 id="pickups-title" className="fa-title">
          <UserPlus size={20} aria-hidden="true" />
          FA Targets
        </h2>
        <span className="fa-right">
          {faab != null && (
            <span className="fa-faab">
              <Coins size={16} aria-hidden="true" />
              <b className="num">${faab}</b> FAAB left
            </span>
          )}
          {faab == null && waiverPriority != null && (
            <span className="small muted">
              Waiver priority {ordinal(waiverPriority)}
              {teams ? ` of ${teams}` : ''}
            </span>
          )}
          {adds != null && (
            <span className="fa-adds">
              <b className="num">{adds}</b> of {week?.adds_allowed} adds left
            </span>
          )}
        </span>
      </div>
      {pickups.length === 0 ? (
        <p className="empty">No free agent improves your team right now.</p>
      ) : (
        <>
          {sharedDrop && (
            <p className="pk-shared">
              <PlayerHead player={sharedDrop} size={28} team={sharedDrop.pro_team} />
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
                    className="move-row pickup-row fa-row"
                    aria-expanded={isOpen}
                    aria-controls={`pickup-${i}-detail`}
                    onClick={() => setOpen(isOpen ? null : p.add.id)}
                  >
                    <PlayerHead player={p.add} size={44} team={p.add.pro_team} />
                    <span className="fa-text">
                      <span className="fa-name">
                        <span className="sr-only">Add </span>
                        {p.add.name}
                        <InjuryBadges players={[p.add]} />
                      </span>
                      <span className="fa-meta">
                        {[p.add.pro_team, p.add.positions.join('/')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="fa-pts">
                      <span className="sr-only">Playoff odds {pct(p.playoff_pct_before)} to </span>
                      {p.timing?.wait && <span className="sr-only">{ifMade(p.timing)}, </span>}
                      <span className="fa-pts-n num good">
                        <Sign up={gain(p) >= 0} />
                        {Math.abs(gain(p))}
                      </span>
                      <span className="fa-pts-u">
                        odds pts<span className="fa-to">, to {pct(p.playoff_pct_after)}</span>
                      </span>
                    </span>
                    <span className="fa-why">
                      {p.stream && <span className="fa-tag fa-stream">This week</span>}
                      {topCats(p.category_changes).map((c) => (
                        <span key={c} className="fa-tag">
                          {c}
                        </span>
                      ))}
                      {p.timing?.wait && (
                        <span className="fa-when">
                          <SpotStrip timing={p.timing} />
                          <span className="fa-when-text">
                            <span className="fa-when-day">
                              {p.timing.next_week ? 'Next week' : waitLabel(p.timing)}
                            </span>
                            <span className="fa-when-gain">
                              <span className="num">+{spotGames(p.timing).best - spotGames(p.timing).now}</span>{' '}
                              {spotGames(p.timing).best - spotGames(p.timing).now === 1 ? 'game' : 'games'}
                            </span>
                          </span>
                          <span className="sr-only">{waitSaid(p)}</span>
                        </span>
                      )}
                      {!sharedDrop && (
                        <span className="fa-for">
                          {p.open_spot_by_trade ? (
                            <>
                              <span className="sr-only">trade </span>
                              <ArrowsLeftRight size={14} aria-hidden="true" />
                              Trade <span>{p.drop.name}</span> first to open the spot
                            </>
                          ) : (
                            <>
                              <span className="sr-only">drop </span>
                              <ArrowsLeftRight size={14} aria-hidden="true" />
                              for <span>{p.drop.name}</span>
                            </>
                          )}
                        </span>
                      )}
                    </span>
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
                      <ImpactBars
                        changes={p.category_changes}
                        label={
                          p.stream ? 'Your win chance per category this week' : 'Your weekly win chance per category'
                        }
                      />
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
