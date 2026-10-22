/** Accepts a bare league ID or any ESPN fantasy URL and pulls out leagueId / teamId / seasonId. */
export function parseLeagueInput(input: string): { leagueId?: number; teamId?: number; season?: number } {
  const text = input.trim()
  if (/^\d+$/.test(text)) return { leagueId: Number(text) }
  try {
    const url = new URL(text)
    const num = (k: string) => {
      const v = url.searchParams.get(k)
      return v && /^\d+$/.test(v) ? Number(v) : undefined
    }
    return { leagueId: num('leagueId'), teamId: num('teamId'), season: num('seasonId') }
  } catch {
    return {}
  }
}
