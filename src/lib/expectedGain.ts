/** What a trade is worth before anyone answers: the playoff-odds points it adds times the chance
    they say yes. Trade lists are ranked by this number, so the row prints it. */
export function expectedGain(acceptance: number, before: number, after: number): number {
  return acceptance * (after - before) * 100
}

/** "+2.4", "−0.6", or words when it rounds to nothing: a signed zero would read as "does nothing". */
export function expectedGainText(points: number): string {
  if (points >= 0.05) return `+${points.toFixed(1)}`
  if (points <= -0.05) return `−${Math.abs(points).toFixed(1)}`
  return points >= 0 ? 'under +0.1' : 'just under 0'
}

/** The same number for screen readers, with the unit the row leaves out. */
export function expectedGainSpoken(points: number): string {
  if (points >= 0.05) return `plus ${points.toFixed(1)} playoff odds points`
  if (points <= -0.05) return `minus ${Math.abs(points).toFixed(1)} playoff odds points`
  return points >= 0 ? 'under plus 0.1 playoff odds points' : 'just under 0 playoff odds points'
}
