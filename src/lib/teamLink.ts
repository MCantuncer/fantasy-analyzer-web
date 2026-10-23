// Which ESPN team this device posts as, per league. The token is the server's proof
// that the abbreviation check passed; it says nothing about the ESPN account itself.

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
