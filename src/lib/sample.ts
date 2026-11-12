// The sample league shown to visitors before they sign in (see api app/sample.py): which team
// they scout, and the dated line that says what the data is.

import type { SampleIndex, SampleTeam } from '../api/client'

/** The product's name in the sample's intro sentence: one constant, so a rename touches one line. */
export const PRODUCT_NAME = 'COURT'

/** The URL parameter for the scouted team, so a shared link opens on the same team. */
export const SCOUT_PARAM = 'scout'

/** The team to scout: the one asked for (URL or a pick), if it is in the sample, else the day's default. */
export function scoutOf(index: SampleIndex, wanted: number | null): SampleTeam {
  return (
    index.teams.find((t) => t.id === wanted) ??
    index.teams.find((t) => t.id === index.default_team_id) ??
    index.teams[0]
  )
}

/** "Wed, Nov 11" for an ISO day (YYYY-MM-DD), with the year when it isn't this one. */
export function sampleDay(day: string, today: Date = new Date()): string {
  const d = new Date(`${day}T12:00:00Z`)
  const sameYear = d.getUTCFullYear() === today.getUTCFullYear()
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}

/** The scouted team in the URL, if any. */
export function scoutWanted(): number | null {
  const n = Number(new URLSearchParams(window.location.search).get(SCOUT_PARAM))
  return Number.isInteger(n) && n > 0 ? n : null
}
