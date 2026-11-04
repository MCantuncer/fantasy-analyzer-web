/** Shooting percentage the way box scores print it: ".467", "1.000", or a dash without attempts. */
export function shotPct(made: number, attempts: number): string {
  if (!(attempts > 0)) return '–'
  const p = made / attempts
  return p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, '')
}

/** Same format from a ratio (0-1), for season lines that only carry the percentage. */
export function ratioPct(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '–'
  return ratio >= 1 ? '1.000' : ratio.toFixed(3).replace(/^0/, '')
}
