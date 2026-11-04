/** ESPN injury statuses in their short form, as shown beside a player's name. */
const SHORT: Record<string, string> = {
  OUT: 'OUT',
  DAY_TO_DAY: 'DTD',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'SUSP',
}

/** "DAY_TO_DAY" -> "DTD"; an unknown status is shown as ESPN spells it, without underscores. */
export function injuryShort(status: string): string {
  return SHORT[status] ?? status.replace(/_/g, ' ')
}
