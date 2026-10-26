import { createContext, useContext } from 'react'
import { ordinal } from './format'

/**
 * Trade values come from the API in auction dollars. Auction leagues show them as dollars;
 * snake leagues show the draft round a player of that value goes in, using the league's
 * `round_values` (the value of the last pick in each round, round 1 first).
 */
export type RoundValues = readonly number[] | null | undefined

export const RoundValuesContext = createContext<RoundValues>(null)

export function useRoundValues(): RoundValues {
  return useContext(RoundValuesContext)
}

// Below this a player is waiver-level in any league.
const WAIVER_LEVEL = 0.5

/** The draft round a value goes in, or null past the rounds that have a price. */
export function draftRound(x: number, rounds: readonly number[]): number | null {
  const k = rounds.findIndex((v) => v >= WAIVER_LEVEL && x >= v)
  return k < 0 ? null : k + 1
}

/** Short form for tables and chips: "$24", or "Rd 3" in snake leagues. */
export function shortValue(x: number, rounds: RoundValues): string {
  if (!rounds) return `$${Math.round(x)}`
  const r = draftRound(x, rounds)
  return r ? `Rd ${r}` : x >= WAIVER_LEVEL ? 'Late' : 'Waiver'
}

/** Sentence form: "$24", or "a 3rd-round pick's worth" in snake leagues. */
export function longValue(x: number, rounds: RoundValues): string {
  if (!rounds) return `$${Math.round(x)}`
  const r = draftRound(x, rounds)
  return r ? `a ${ordinal(r)}-round pick's worth` : x >= WAIVER_LEVEL ? 'late-round value' : 'waiver-level value'
}

/** "They get $30 of value for $28", or "They get a 2nd-round pick's worth for a 3rd-round pick's worth". */
export function valueSentence(get: number, give: number, rounds: RoundValues): string {
  return rounds
    ? `They get ${longValue(get, rounds)} for ${longValue(give, rounds)}`
    : `They get ${longValue(get, rounds)} of value for ${longValue(give, rounds)}`
}

/** An owner premium on top of `total`: "$6", or "15%" in snake leagues, where a round can't be added. */
export function premiumValue(premium: number, total: number, rounds: RoundValues): string {
  return rounds ? `${Math.round((100 * premium) / Math.max(total, 1))}%` : `$${Math.round(premium)}`
}

export function valueTitle(rounds: RoundValues): string {
  return rounds ? 'Trade value, as the draft round a player like this goes in' : 'Trade value in auction dollars'
}
