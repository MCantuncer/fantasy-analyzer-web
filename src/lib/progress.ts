import { useEffect, useRef, useState } from 'react'
import type { WordState } from './courtSpan'

const TICK_MS = 200
// While the server's number stands still, the bar creeps on by this much per tick, never
// more than CREEP_AHEAD past the last real reading, so it neither freezes nor runs away.
const CREEP = 0.0015
const CREEP_AHEAD = 0.08

/** A progress value that eases toward the server's reading and keeps moving between polls. */
export function useSmoothProgress(target: number, running: boolean): number {
  const [shown, setShown] = useState(0)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    if (!running) {
      setShown(0)
      return
    }
    const id = setInterval(() => {
      setShown((s) => {
        const t = targetRef.current
        if (s < t - 0.005) return s + (t - s) * 0.2
        return Math.min(s + CREEP, t + CREEP_AHEAD, 0.97)
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running])

  return shown
}

export function percent(p: number) {
  return `${Math.floor(Math.max(0, Math.min(p, 1)) * 100)}%`
}

/*
 * When each word of COURT lands (in this order): Categories when the league arrives, Rosters once they are
 * read, Upgrades once free agents are screened, Odds once the main trade screen (which simulates every
 * deal's playoff odds) is through, Trades when the last trade lists are done. Index into C O U R T.
 */
const LANDING = [0, 3, 2, 1, 4]

export function wordStates(waking: boolean, now: number, stage: string, progress: number): WordState[] {
  const done = [
    !waking,
    now >= 2,
    now >= 3,
    stage === 'Screening edge trades' || stage === 'Screening vision trades' || progress >= 0.72,
    progress >= 0.98,
  ]
  const states: WordState[] = ['pending', 'pending', 'pending', 'pending', 'pending']
  let running = false
  LANDING.forEach((letter, k) => {
    if (done[k] && !running) states[letter] = 'landed'
    else if (!running) {
      states[letter] = 'running'
      running = true
    }
  })
  return states
}
