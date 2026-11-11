import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Pause } from '@phosphor-icons/react'
import type { Game } from '../api/client'
import { heatOf, isClutch, parseClock, periodSpoken, type GameClock } from '../lib/gameClock'
import { tipOff } from '../lib/scores'
import './GameTime.css'

/** How a game burns on its card: run (clock running), break, final, pre (not started), unknown (live, no clock). */
export type EmberState = 'run' | 'break' | 'final' | 'pre' | 'unknown'

export type Ember = {
  state: EmberState
  clock: GameClock | null
  /** Share of the game played, 0..1; null when a live game has no clock to read. */
  progress: number | null
  heat: number
  clutch: boolean
  /** Live at 0-0 with no clock yet. */
  tipping: boolean
}

export function emberOf(game: Game): Ember {
  if (game.status === 'scheduled') {
    return { state: 'pre', clock: null, progress: 0, heat: 0, clutch: false, tipping: false }
  }
  if (game.status === 'final') {
    return { state: 'final', clock: null, progress: 1, heat: 0, clutch: false, tipping: false }
  }
  const away = game.away.score ?? 0
  const home = game.home.score ?? 0
  const clock = parseClock(game.clock)
  const tipping = !clock && !away && !home
  if (!clock) {
    return tipping
      ? { state: 'run', clock, progress: 0, heat: 0.15, clutch: false, tipping }
      : { state: 'unknown', clock, progress: null, heat: 0, clutch: false, tipping }
  }
  return {
    state: clock.isBreak ? 'break' : 'run',
    clock,
    progress: clock.progress,
    heat: heatOf(clock, away, home),
    clutch: isClutch(clock, away, home),
    tipping,
  }
}

/** The data attributes and custom properties that light an element's burn layer. */
export function emberAttrs(e: Ember, style?: CSSProperties, tick = false) {
  return {
    'data-ember': e.state,
    'data-clutch': e.clutch ? '' : undefined,
    'data-tick': tick ? '' : undefined,
    style: {
      ...style,
      ...(e.progress != null ? { '--gt-p': e.progress.toFixed(4) } : {}),
      '--gt-heat': e.heat.toFixed(3),
    } as CSSProperties,
  }
}

/** The burn layer: the first child of a .sc-ember element, behind its content. */
export function Burn() {
  return <span className="sc-burn" aria-hidden="true" />
}

/** True for a moment after the clock changes (not on first render): the light catches once per refresh. */
export function useClockTick(clock: string | null | undefined, ms = 800): boolean {
  const last = useRef(clock)
  const [tick, setTick] = useState(false)
  useEffect(() => {
    if (last.current === clock) return
    last.current = clock
    const on = setTimeout(() => setTick(true), 0)
    const off = setTimeout(() => setTick(false), ms)
    return () => {
      clearTimeout(on)
      clearTimeout(off)
    }
  }, [clock, ms])
  return tick
}

/** The time block: the clock as the hero number while it runs, a paused word at a break, tip time, or Final. */
export function GameTime({ game, ember }: { game: Game; ember: Ember }) {
  if (game.status === 'scheduled') {
    const [hm, ap] = tipOff(game.start).split(' ')
    return (
      <span className="gt gt-pre">
        <span className="gt-tip num">{hm}</span>
        {ap && <span className="gt-ap">{ap}</span>}
      </span>
    )
  }
  if (game.status === 'final') {
    return (
      <span className="gt gt-final">
        <span className="gt-word">Final</span>
      </span>
    )
  }
  const c = ember.clock
  if (!c) {
    return (
      <span className="gt gt-run">
        {ember.tipping && <span className="sr-only">Live, </span>}
        <span className="gt-word">{ember.tipping ? 'Tip-off' : 'Live'}</span>
      </span>
    )
  }
  if (c.isBreak) {
    return (
      <>
        <span className="gt gt-break" aria-hidden="true">
          <Pause weight="fill" className="gt-ico" />
          <span className="gt-word">{c.word}</span>
        </span>
        <span className="sr-only">Live, {c.word === 'Half' ? 'halftime' : `end of the ${periodSpoken(c.period)}`}</span>
      </>
    )
  }
  return (
    <>
      <span className="gt gt-run" aria-hidden="true">
        <span className="gt-per num">{c.label}</span>
        <span className="gt-clock num">{c.time}</span>
        {ember.clutch && <span className="gt-clutch">Clutch</span>}
      </span>
      <span className="sr-only">
        Live, {c.time} left in the {periodSpoken(c.period)}
        {ember.clutch ? ', clutch time' : ''}
      </span>
    </>
  )
}
