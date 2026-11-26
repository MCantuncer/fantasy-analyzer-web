/* The moon on Crazy One's door orbits slowly, and when a pointer comes in it turns to look at the spot
   where the hover started, then carries on orbiting from there (Can 2026-11-26: an "overthinker" that
   notices every change). Angles are degrees, clockwise from 3 o'clock, as SVG's rotate() reads them. */

/** One lap every 9 seconds, as the door always turned. */
export const ORBIT_DEG_PER_S = 360 / 9
/** How long the turn toward the pointer takes. */
export const LOOK_MS = 450
/** Where the moon sits before anything happens: up and to the right. */
export const START_DEG = -42

/** The angle from the door's centre to a point (y down, as on screen). */
export function lookAngle(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/** ``to`` moved by whole turns so it sits within half a turn of ``from``: the short way round. */
export function nearest(from: number, to: number): number {
  return to + 360 * Math.round((from - to) / 360)
}

/** Ease out: quick to turn, gentle to settle. */
export function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) ** 3
}

/** A turn in progress: where it set out, where it is looking, and when it started (ms). */
export interface Look {
  from: number
  to: number
  at: number
}

/** The moon's angle at time ``now`` (ms): for LOOK_MS it eases from ``from`` round to ``to`` (the
 *  pointer's spot), then it orbits on from there at the usual pace. */
export function angleAt(look: Look, now: number): number {
  const t = now - look.at
  if (t < LOOK_MS) return look.from + (look.to - look.from) * easeOut(t / LOOK_MS)
  return look.to + (ORBIT_DEG_PER_S * (t - LOOK_MS)) / 1000
}

/** The orbit with no pointer yet: from START_DEG at ``t0``. */
export function idle(t0: number): Look {
  return { from: START_DEG, to: START_DEG, at: t0 - LOOK_MS }
}
