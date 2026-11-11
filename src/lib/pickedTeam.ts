import { useCallback, useState } from 'react'

// The team a manager picked in a league before proving it on ESPN. It lives on this device only:
// the server shows a team's moves to any account that added the league until someone verifies it.

function key(leagueId: number, season: number) {
  return `picked-team:${leagueId}:${season}`
}

export function loadPickedTeam(leagueId: number, season: number): number | null {
  try {
    const id = Number(localStorage.getItem(key(leagueId, season)))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function storePickedTeam(leagueId: number, season: number, teamId: number | null) {
  try {
    if (teamId === null) localStorage.removeItem(key(leagueId, season))
    else localStorage.setItem(key(leagueId, season), String(teamId))
  } catch {
    // storage unavailable: the pick lasts for this page view only
  }
}

/** The pick for one league, and a setter that also saves it (null forgets it). */
export function usePickedTeam(
  leagueId: number | undefined,
  season: number | undefined,
): [number | null, (teamId: number | null) => void] {
  // What was set during this visit; before that, what the device remembers.
  const [set, setSet] = useState<{ key: string; id: number | null } | null>(null)
  const known = leagueId !== undefined && season !== undefined
  const current = known ? key(leagueId, season) : null
  const id = !known ? null : set?.key === current ? set.id : loadPickedTeam(leagueId, season)
  const pick = useCallback(
    (teamId: number | null) => {
      if (leagueId === undefined || season === undefined) return
      storePickedTeam(leagueId, season, teamId)
      setSet({ key: key(leagueId, season), id: teamId })
    },
    [leagueId, season],
  )
  return [id, pick]
}
