// Which ESPN team this device posts as, per league. The token is the server's proof
// that the abbreviation check passed; it says nothing about the ESPN account itself.

import { useCallback, useEffect, useState } from 'react'

export interface TeamLink {
  token: string
  teamId: number
  teamName: string
}

function key(leagueId: number, season: number) {
  return `team-link:${leagueId}:${season}`
}

export function loadTeamLink(leagueId: number, season: number): TeamLink | null {
  try {
    const raw = localStorage.getItem(key(leagueId, season))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.token === 'string' && typeof parsed?.teamId === 'number') return parsed
  } catch {
    // storage blocked or corrupted
  }
  return null
}

export function saveTeamLink(leagueId: number, season: number, link: TeamLink): void {
  try {
    localStorage.setItem(key(leagueId, season), JSON.stringify(link))
  } catch {
    // storage blocked: the link lasts for this page view
  }
}

export function clearTeamLink(leagueId: number, season: number): void {
  try {
    localStorage.removeItem(key(leagueId, season))
  } catch {
    // ignore
  }
}

const EVENT = 'team-link-change'

/** The linked team for a league, kept in step across the top bar and the chat tab. */
export function useTeamLink(leagueId: number, season: number): [TeamLink | null, (link: TeamLink | null) => void] {
  const [link, setLink] = useState<TeamLink | null>(() => loadTeamLink(leagueId, season))
  useEffect(() => {
    const sync = () => setLink(loadTeamLink(leagueId, season))
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [leagueId, season])
  const update = useCallback(
    (next: TeamLink | null) => {
      if (next) saveTeamLink(leagueId, season, next)
      else clearTeamLink(leagueId, season)
      setLink(next)
      window.dispatchEvent(new Event(EVENT))
    },
    [leagueId, season],
  )
  return [link, update]
}
