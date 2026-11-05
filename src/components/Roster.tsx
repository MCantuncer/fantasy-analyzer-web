import type { PlayerRef } from '../api/client'
import { InjuryTag, PlayerBadges } from './PlayerBadges'
import { shortValue, useRoundValues } from '../lib/tradeValue'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { useMediaQuery } from '../lib/useMediaQuery'
import './Roster.css'

const TIERS: Record<PlayerRef['tier'], { label: string; title: string }> = {
  core: { label: 'Core', title: 'You keep him: never offered or dropped' },
  tradeable: { label: 'Tradeable', title: "Has a market. If he doesn't fit, trade him rather than drop him" },
  droppable: { label: 'Droppable', title: 'Lightly owned and replaceable from free agency' },
  injured: { label: 'Injured', title: "Out right now. Hold him unless it's long term" },
}

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
  onShop?: (id: number) => void
}

function catValue(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
}

function catClass(v: number): string {
  return v > 0 ? 'good' : v < 0 ? 'bad' : ''
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={locked ? 'currentColor' : 'none'} />
      <path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} />
    </svg>
  )
}

/** Phones: one compact row per player instead of a seven-column table that scrolls sideways. */
function RosterList({ roster, keep, onToggleKeep, onShop }: Props) {
  const rounds = useRoundValues()
  return (
    <ul className="rl-list">
      {roster.map((p) => {
        const kept = keep.includes(p.id)
        return (
          <li key={p.id} className={kept ? 'rl-row rl-kept' : 'rl-row'}>
            <span className="rl-head">
              <PlayerLink player={p} decorative>
                <PlayerHead player={p} size={40} team={p.pro_team} />
              </PlayerLink>
            </span>
            <div className="rl-name">
              <PlayerLink player={p} />
              <InjuryTag status={p.injury_status} />
              <PlayerBadges badges={p.badges} />
            </div>
            <span className="rl-trade num">{shortValue(p.perceived_value, rounds)}</span>
            <div className="rl-meta small">
              <span className="muted">{p.positions.join('/')}</span>
              <span className={`rl-tier rl-tier-${p.tier}`} title={TIERS[p.tier].title}>
                {TIERS[p.tier].label}
              </span>
              <span className={`num ${catClass(p.value) || 'muted'}`} title="Category value">
                {catValue(p.value)} cat
              </span>
              {onShop && (
                <button
                  type="button"
                  className="link rl-shop"
                  onClick={() => onShop(p.id)}
                  title={`Find the best deals for ${p.name} in Trade Park`}
                >
                  Shop<span className="sr-only"> {p.name}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className={kept ? 'rl-keep on' : 'rl-keep'}
              aria-pressed={kept}
              onClick={() => onToggleKeep(p.id)}
              title={kept ? `Kept: ${p.name} stays out of trades and drops` : `Keep ${p.name} out of trades and drops`}
            >
              <LockIcon locked={kept} />
              <span className="sr-only">Keep {p.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function Roster(props: Props) {
  const { roster, keep, onToggleKeep, onShop } = props
  const rounds = useRoundValues()
  // Phones get a list; the table needs about 720px and made every row three lines tall.
  const phone = useMediaQuery('(max-width: 640px)')
  return (
    <section className="card flush" aria-labelledby="roster-title">
      <div className="card-head">
        <h2 id="roster-title">Your roster</h2>
        <span className="small muted">
          Keep a player to leave him out of trades and drops. Only droppable players are ever suggested as drops.
        </span>
      </div>
      {phone ? (
        <RosterList {...props} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="keep-cell">Keep</th>
                <th className="left">Player</th>
                <th className="left">Pos</th>
                <th className="left">Status</th>
                <th title={`Trade value ${rounds ? 'as a draft round' : 'in auction dollars'}: draft-day rankings and prices fading into % owned, rest-of-season value in your categories and this season's production`}>Trade value</th>
                <th title="Category value: z-scores summed over the league's categories">Cat value</th>
                {onShop && (
                  <th>
                    <span className="sr-only">Shop</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id}>
                  <td className="keep-cell">
                    <label>
                      <input type="checkbox" checked={keep.includes(p.id)} onChange={() => onToggleKeep(p.id)} />
                      <span className="sr-only">Keep {p.name}</span>
                    </label>
                  </td>
                  <th scope="row">
                    <PlayerLink player={p} decorative>
                      <PlayerHead player={p} size={28} team={p.pro_team} />
                    </PlayerLink>{' '}
                    <PlayerLink player={p} />
                    <InjuryTag status={p.injury_status} />
                    <PlayerBadges badges={p.badges} />
                  </th>
                  <td className="left muted">{p.positions.join('/')}</td>
                  <td className="left">
                    <span className={`badge tier-${p.tier}`} title={TIERS[p.tier].title}>
                      {TIERS[p.tier].label}
                    </span>
                  </td>
                  <td>{shortValue(p.perceived_value, rounds)}</td>
                  <td className={catClass(p.value)}>{catValue(p.value)}</td>
                  {onShop && (
                    <td>
                      <button
                        type="button"
                        className="secondary btn-sm"
                        onClick={() => onShop(p.id)}
                        title={`Find the best deals for ${p.name} in Trade Park`}
                      >
                        Shop<span className="sr-only"> {p.name}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
