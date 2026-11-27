import { useId, useMemo, useState } from 'react'
import { CaretDown, CaretRight, LockSimple, LockSimpleOpen } from '@phosphor-icons/react'
import type { PlayerRef } from '../api/client'
import { railName } from '../lib/untouchable'
import { PlayerHead } from './PlayerHead'
import { KeptPlayers, PlayerList } from './PlayerInline'
import { Spinner } from './Spinner'
import './Untouchable.css'

/**
 * The roster as bare 44px faces, best first: each face is the Keep switch (aria-pressed). A kept
 * face gets an ink ring and a lock badge on its corner, and its name goes to full weight. The rail
 * is its own size container: 14 across on a wide page, 7 in a column, 5 on a phone.
 */
export function UntouchableRail({
  roster,
  keep,
  onToggleKeep,
  id,
}: {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
  id?: string
}) {
  const best = useMemo(() => [...roster].sort((a, b) => b.perceived_value - a.perceived_value), [roster])
  return (
    <div className="unt-rail" id={id}>
      <div className="unt-faces" role="group" aria-label="Your roster, best players first">
        {best.map((p) => {
          const kept = keep.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              className="unt-face"
              aria-pressed={kept}
              aria-label={p.name}
              title={kept ? `${p.name} is kept out of trades` : `Keep ${p.name} out of trades`}
              onClick={() => onToggleKeep(p.id)}
            >
              <span className="unt-head">
                <PlayerHead player={p} size={44} team={p.pro_team} />
                {kept && (
                  <span className="unt-badge" aria-hidden="true">
                    <LockSimple size={10} weight="fill" />
                  </span>
                )}
              </span>
              <span className="unt-name">{railName(p.name)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
  /** "Everyone is available": the question is answered and the field leaves. */
  onEveryone: () => void
  /** Trades that change with the answer (the unique ones across Fair and Bold). */
  waiting?: number
}

/**
 * Asked once at the top of Moves while nobody is kept: who would you never trade? One soft field:
 * the question, the face rail, and its foot. A tap on a face is the same switch as Keep in My Team,
 * so the page's own "Update moves with these keepers" button is the next step.
 */
export function Untouchable({ roster, keep, onToggleKeep, onEveryone, waiting = 0 }: Props) {
  const picked = roster.filter((p) => keep.includes(p.id)).sort((a, b) => b.perceived_value - a.perceived_value)
  return (
    <section className="unt-field" aria-labelledby="unt-title">
      <h2 className="unt-title" id="unt-title">
        <LockSimpleOpen size={20} aria-hidden="true" />
        Anyone untouchable?
      </h2>
      <UntouchableRail roster={roster} keep={keep} onToggleKeep={onToggleKeep} />
      {picked.length > 0 && (
        <p className="unt-kept">
          Kept: <PlayerList players={picked} />
        </p>
      )}
      <div className="unt-foot">
        {picked.length > 0 ? (
          <p className="unt-takes">Takes 1 to 3 minutes.</p>
        ) : (
          <button type="button" className="secondary unt-everyone" onClick={onEveryone}>
            Everyone is available
          </button>
        )}
        {waiting > 0 && (
          <p className="unt-wait">
            <b className="num">{waiting}</b> {waiting === 1 ? 'trade waits' : 'trades wait'} for your answer
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * The answered question as one line at the top of Trades to offer: "Untouchable Nobody · Change"
 * (or the kept players, each opening his card). Change opens the same face rail in place.
 */
export function UntouchableLine({
  roster,
  keep,
  onToggleKeep,
}: {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const railId = useId()
  const kept = roster.filter((p) => keep.includes(p.id)).sort((a, b) => b.perceived_value - a.perceived_value)
  const Caret = open ? CaretDown : CaretRight
  return (
    <div className="unt-answer">
      <p className="unt-answer-line">
        <span className="unt-answer-k">
          <LockSimple size={16} aria-hidden="true" />
          Untouchable
        </span>
        <span className="unt-answer-v">
          {kept.length ? <PlayerList players={kept} name={(p) => railName(p.name)} /> : <b>Nobody</b>}
        </span>
        <button
          type="button"
          className="link unt-change"
          aria-expanded={open}
          aria-controls={railId}
          onClick={() => setOpen(!open)}
        >
          Change
          <Caret size={12} weight="bold" aria-hidden="true" />
        </button>
      </p>
      {open && <UntouchableRail roster={roster} keep={keep} onToggleKeep={onToggleKeep} id={railId} />}
    </div>
  )
}

/** The field's place while moves are worked out again without the keepers. */
export function UntouchableWorking({ players }: { players: PlayerRef[] }) {
  return (
    <section className="unt-field unt-working" role="status">
      <Spinner size={18} className="unt-spin" />
      <div>
        <p className="unt-working-line">
          Working out your moves without <KeptPlayers players={players} />
        </p>
        <p className="small muted">Until then, the moves below are the old ones.</p>
      </div>
    </section>
  )
}
