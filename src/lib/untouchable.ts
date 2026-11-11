import { useCallback, useState } from 'react'

// "Anyone untouchable?" is asked once per team on this device. The answer itself is the Keep list;
// this only remembers that the question was answered, so it is not asked again.

function key(leagueId: number, season: number, teamId: number) {
  return `untouchable-asked:${leagueId}:${season}:${teamId}`
}

function load(k: string): boolean {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}

/** Whether this team's manager answered already, and a setter that also saves it. */
export function useUntouchableAsked(leagueId: number, season: number, teamId: number): [boolean, () => void] {
  const current = key(leagueId, season, teamId)
  const [answered, setAnswered] = useState<string | null>(null)
  const mark = useCallback(() => {
    try {
      localStorage.setItem(current, '1')
    } catch {
      // storage unavailable: the answer lasts for this page view only
    }
    setAnswered(current)
  }, [current])
  return [answered === current || load(current), mark]
}

/** "Kyshawn George", "Kyshawn George and Jayson Tatum", then "Kyshawn George and 2 more": two names at most. */
export function keptNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names[0]} and ${names.length - 1} more`
}
