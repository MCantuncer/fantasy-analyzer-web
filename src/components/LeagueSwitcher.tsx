import { useEffect, useRef } from 'react'
import type { MyLeague } from '../api/client'
import './LeagueSwitcher.css'
import { VerifiedBadge } from './VerifiedBadge'

interface Props {
  leagues: MyLeague[]
  current: { leagueId: number; season: number | null }
  leagueName: string
  teamName?: string
  onOpen: (league: MyLeague) => void
  onAdd: () => void
  onManage: () => void
}

/** The league / team crumb in the top bar, which opens a menu to jump to another league or add one. */
export function LeagueSwitcher({ leagues, current, leagueName, teamName, onOpen, onAdd, onManage }: Props) {
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
  const isCurrent = (l: MyLeague) =>
    l.league_id === current.leagueId && (current.season === null || l.season === current.season)

  return (
    <details className="switcher league-switcher" ref={ref}>
      <summary aria-label={`${leagueName}${teamName ? `, ${teamName}` : ''}. Switch league`}>
        <span className="league-name" title={leagueName}>
          {leagueName}
        </span>
        {teamName && (
          <>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="team-name" title={teamName}>
              {teamName}
            </span>
          </>
        )}
        <svg className="chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </summary>
      <div className="menu card switcher-pop">
        <span className="menu-label small muted">Your leagues</span>
        <ul className="switcher-list">
          {leagues.map((l) => {
            const here = isCurrent(l)
            return (
              <li key={`${l.league_id}-${l.season}`}>
                <button
                  type="button"
                  className="menu-item switcher-item"
                  aria-current={here ? 'page' : undefined}
                  onClick={close(() => (here ? undefined : onOpen(l)))}
                >
                  <span className="switcher-item-text">
                    <span className="switcher-item-title">
                      <span className="switcher-item-name">{l.name}</span>
                      {l.team_id ? <VerifiedBadge /> : null}
                    </span>
                    <span className="small muted">
                      {here && teamName ? teamName : l.team_id ? 'Verified manager' : 'League view only'}
                    </span>
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
        <button type="button" className="menu-item" onClick={close(onAdd)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Add a league
        </button>
        <button type="button" className="menu-item" onClick={close(onManage)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Manage leagues
        </button>
      </div>
    </details>
  )
}
