import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerRef } from '../api/client'
import './DurabilityScore.css'

// Share of his team's games a typical regular plays (the API's LEAGUE_SHARE, 0.728).
const TYPICAL_SCORE = 73
const POP_WIDTH = 300
const GAP = 8

function durabilityScore(p: PlayerRef): number | null {
  return p.games_share == null ? null : Math.round(p.games_share * 100)
}

/**
 * "Durability 62": a score chip for injury-prone players that opens a short explainer.
 * The chip can sit inside a clickable trade row, so it stops the click from reaching the
 * row, and the explainer renders in a portal so it isn't nested inside that row.
 */
export function DurabilityScore({ player, prefix = '' }: { player: PlayerRef; prefix?: string }) {
  const score = durabilityScore(player)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const chip = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = useCallback(() => {
    setOpen(false)
    chip.current?.focus()
  }, [])

  const place = useCallback(() => {
    const r = chip.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(POP_WIDTH, window.innerWidth - 2 * 16)
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16)
    const height = pop.current?.offsetHeight ?? 220
    const below = r.bottom + GAP
    const top = below + height > window.innerHeight - 16 && r.top - GAP - height > 16 ? r.top - GAP - height : below
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !chip.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onMove = () => place()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    pop.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, close, place])

  if (score == null) return null

  const toggle = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setOpen((o) => !o)
  }

  return (
    <>
      <span
        ref={chip}
        role="button"
        tabIndex={0}
        className="badge badge-warn dur-chip injury-badge"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${prefix}Durability ${score} out of 100. What does this mean?`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e)
        }}
      >
        <span className="dur-dot" aria-hidden="true" />
        {prefix}Durability <span className="tnum">{score}</span>
      </span>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={id}
            role="dialog"
            aria-label={`Durability score for ${player.name}`}
            tabIndex={-1}
            className="dur-pop"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(POP_WIDTH, window.innerWidth - 32) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dur-pop-head">
              <div>
                <div className="dur-pop-name">{player.name}</div>
                <div className="dur-pop-score">
                  <span className="tnum">{score}</span>
                  <span className="dur-pop-of">/100 durability</span>
                </div>
              </div>
              <button type="button" className="dur-pop-close" aria-label="Close" onClick={close}>
                ×
              </button>
            </div>
            <DurabilityScale score={score} />
            <p className="dur-pop-text">
              He plays about <strong className="tnum">{score}</strong> of every 100 team games. A typical starter plays{' '}
              <span className="tnum">{TYPICAL_SCORE}</span>.
            </p>
            <ul className="dur-pop-list">
              <li>Based on games he played the last 3 seasons and this one.</li>
              <li>Trade odds count him for fewer games.</li>
              <li>A healthy run this season raises it.</li>
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}

/** 0-100 track with his score and the typical starter's mark. */
function DurabilityScale({ score }: { score: number }) {
  return (
    <div className="dur-scale" aria-hidden="true">
      <div className="dur-track">
        <div className="dur-fill" style={{ width: `${score}%` }} />
        <div className="dur-typical" style={{ left: `${TYPICAL_SCORE}%` }} />
      </div>
      <div className="dur-scale-labels">
        <span>0</span>
        <span className="dur-typical-label" style={{ left: `${TYPICAL_SCORE}%` }}>
          Typical {TYPICAL_SCORE}
        </span>
        <span>100</span>
      </div>
    </div>
  )
}
