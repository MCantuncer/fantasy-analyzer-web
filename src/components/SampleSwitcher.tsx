import { useEffect, useRef } from 'react'
import { Binoculars } from '@phosphor-icons/react'
import type { SampleIndex, SampleTeam } from '../api/client'
import { ordinal } from '../lib/format'
import { OpenCrest } from './OpenCrest'
import './LeagueSwitcher.css'

/**
 * The top bar's crumb while a visitor scouts the sample league: "Sample league / Scouting Horns".
 * Its menu lists every team by projected finish, then the doors to your own league and sign-in.
 */
export function SampleSwitcher({
  index,
  scout,
  onScout,
  onJoin,
  onSignIn,
}: {
  index: SampleIndex
  scout: SampleTeam
  onScout: (id: number) => void
  onJoin: () => void
  onSignIn: () => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  // Close on outside click and Escape, like any other menu.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onDown = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false
        el.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const close = (then: () => void) => () => {
    if (ref.current) ref.current.open = false
    then()
  }
  const ladder = [...index.teams].sort((a, b) => a.projected_rank - b.projected_rank)

  return (
    <details className="switcher league-switcher smp-switcher" ref={ref}>
      <summary aria-label={`Sample league, team names masked. Scouting ${scout.name}. Scout another team`}>
        <span className="smp-crumb">
          <span className="league-name">Sample league</span>
          <span className="crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="team-name smp-switcher-team">
            <Binoculars size={14} weight="bold" aria-hidden="true" />
            <span className="smp-switcher-verb">Scouting </span>
            {scout.name}
          </span>
        </span>
        <svg className="chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </summary>
      <div className="menu card switcher-pop">
        <span className="menu-label small muted">Sample league · team names masked</span>
        <ul className="switcher-list">
          {ladder.map((t) => {
            const here = t.id === scout.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="menu-item switcher-item"
                  aria-current={here ? 'true' : undefined}
                  onClick={close(() => onScout(t.id))}
                >
                  <span className="switcher-item-text">
                    <span className="switcher-item-title">
                      <span className="switcher-item-name">{t.name}</span>
                    </span>
                    <span className="small muted">projected {ordinal(t.projected_rank)}</span>
                  </span>
                  <svg className="check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    {here && <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" />}
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
        <hr className="menu-sep" />
        <button type="button" className="menu-item" onClick={close(onJoin)}>
          <OpenCrest size={16} />
          Analyze my own league
        </button>
        <button type="button" className="menu-item" onClick={close(onSignIn)}>
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
            <path
              d="M3.5 15.5c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
            />
          </svg>
          Sign in
        </button>
      </div>
    </details>
  )
}
