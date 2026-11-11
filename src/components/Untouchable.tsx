import { useMemo } from 'react'
import { LockSimple, LockSimpleOpen } from '@phosphor-icons/react'
import type { PlayerRef } from '../api/client'
import { keptNames } from '../lib/untouchable'
import { PlayerHead } from './PlayerHead'
import { Spinner } from './Spinner'
import './Untouchable.css'

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
  /** "Everyone is available": the question is answered and the card leaves. */
  onEveryone: () => void
  onMyTeam: () => void
}

/**
 * Asked once at the top of Moves while nobody is kept: who would you never trade? A tap on a face is
 * the same switch as Keep in My Team, so the page's own "Update moves with these keepers" button
 * is the next step.
 */
export function Untouchable({ roster, keep, onToggleKeep, onEveryone, onMyTeam }: Props) {
  const best = useMemo(() => [...roster].sort((a, b) => b.perceived_value - a.perceived_value), [roster])
  const picked = keep.length > 0
  return (
    <section className="card unt-card" aria-labelledby="unt-title">
      <div className="unt-head">
        <h2 className="unt-title" id="unt-title">
          <LockSimpleOpen size={18} aria-hidden="true" />
          Anyone untouchable?
        </h2>
        <p className="small muted">Tap anyone you would never trade. Moves will leave them out.</p>
      </div>
      <div className="unt-strip" role="group" aria-label="Your roster, best players first">
        <div className="unt-track">
          {best.map((p) => {
            const kept = keep.includes(p.id)
            const [first, ...rest] = p.name.split(' ')
            return (
              <button
                key={p.id}
                type="button"
                className="unt-tile"
                aria-pressed={kept}
                aria-label={p.name}
                onClick={() => onToggleKeep(p.id)}
              >
                {kept && <LockSimple className="unt-mark" size={12} weight="fill" aria-hidden="true" />}
                <PlayerHead player={p} size={40} team={p.pro_team} />
                <span className="unt-name">
                  <span>{first}</span>
                  <span>{rest.join(' ')}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="unt-foot">
        {!picked && (
          <button type="button" className="secondary" onClick={onEveryone}>
            Everyone is available
          </button>
        )}
        <p className="small muted">
          {picked && 'Takes 1 to 3 minutes. '}Change it any time in{' '}
          <button type="button" className="link" onClick={onMyTeam}>
            My Team
          </button>
          .
        </p>
      </div>
    </section>
  )
}

/** The card's place while moves are worked out again without the keepers. */
export function UntouchableWorking({ names }: { names: string[] }) {
  return (
    <section className="card unt-working" role="status">
      <Spinner size={18} className="unt-spin" />
      <div>
        <p className="unt-line">Working out your moves without {keptNames(names)}</p>
        <p className="small muted">Until then, the moves below are the old ones.</p>
      </div>
    </section>
  )
}
