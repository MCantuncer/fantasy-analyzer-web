/**
 * The chance they accept a trade, as a natural frequency: "1 in 9". It comes from the API's
 * `acceptance` (0 to 1), never from its word label. N is 1/p rounded to the nearest whole number,
 * coarse on purpose since the fitted rate is only good to a few points. "1 in 2" is the best it
 * reads (p of 0.4 and up), and "1 in 100" the worst.
 */
export function oneInN(p: number): number {
  if (!(p > 0)) return 100
  return Math.min(100, Math.max(2, Math.round(1 / p)))
}

export const oneIn = (p: number): string => `1 in ${oneInN(p)}`
