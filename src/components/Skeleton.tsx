import { useEffect, useState } from 'react'
import './Skeleton.css'

/**
 * Loading placeholders shaped like the page that is coming, so the layout is there at
 * once and the content fills in where the grey blocks were. Screen readers hear one
 * status line instead of the blocks.
 */
export function Bone({ w = '100%', h = 12, round = false, className = '' }: { w?: number | string; h?: number; round?: boolean; className?: string }) {
  return <span className={`sk-bone${round ? ' sk-round' : ''} ${className}`} style={{ width: w, height: h }} aria-hidden="true" />
}

function useSlow(afterMs: number) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return seconds * 1000 >= afterMs ? seconds : null
}

/** One quiet line once a load runs long: the free server is probably waking up. */
function SlowNote() {
  const seconds = useSlow(6_000)
  if (seconds === null) return null
  return (
    <div className="sk-slow" role="status">
      <svg className="spinner" width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="30 20" />
      </svg>
      <span>Waking up the server · up to a minute</span>
      <span className="tnum sk-slow-s">{seconds}s</span>
    </div>
  )
}

function Frame({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`sk stack ${className}`} aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <SlowNote />
      {children}
    </div>
  )
}

export function ScoresSkeleton() {
  return (
    <Frame label="Loading the scoreboard">
      <div className="sk-row">
        <Bone w={40} h={40} className="sk-r8" />
        <Bone w={92} h={40} className="sk-r8" />
        <Bone w={92} h={40} className="sk-r8" />
        <Bone w={92} h={40} className="sk-r8" />
      </div>
      <div className="card sk-card">
        <Bone w="38%" h={10} />
        <Bone w="72%" h={16} />
        <div className="sk-stats">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="sk-stat">
              <Bone w={26} h={9} />
              <Bone w={34} h={18} />
            </span>
          ))}
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card sk-card">
          <div className="sk-between">
            <Bone w={44} h={10} />
            <Bone w={110} h={10} />
          </div>
          <div className="sk-between">
            <Bone w={52} h={14} />
            <Bone w={40} h={22} />
          </div>
          <div className="sk-between">
            <Bone w={64} h={14} />
            <Bone w={40} h={22} />
          </div>
          <Bone w="64%" h={10} />
        </div>
      ))}
    </Frame>
  )
}

export function NewsSkeleton() {
  return (
    <Frame label="Loading NBA news">
      <Bone w="100%" h={44} className="sk-r10" />
      <div className="sk-row">
        <Bone w={56} h={34} round />
        <Bone w={96} h={34} round />
        <Bone w={132} h={34} round />
      </div>
      <div className="card flush sk-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-story">
            <div className="sk-row sk-center">
              <Bone w={36} h={36} round />
              <span className="sk-col">
                <Bone w={120} h={13} />
                <Bone w={70} h={10} />
              </span>
              <Bone w={44} h={22} className="sk-r6 sk-end" />
            </div>
            <Bone w="88%" h={16} />
            <Bone w="62%" h={16} />
            <Bone w="94%" h={11} />
            <Bone w="48%" h={11} />
          </div>
        ))}
      </div>
    </Frame>
  )
}

// Team, added player and dropped player widths for the four line bones, so the wire isn't a stripe.
const FEED_LINES = [
  [110, 120, 96],
  [92, 100, 80],
  [118, 84, 104],
  [100, 112, 88],
]

/**
 * The league feed's shape while it loads: the filters, then the wire with its spine, a day
 * milestone and four move lines (crest on the spine, team, face and name, dropped name, bid).
 * No cards: the wire has none either.
 */
export function FeedSkeleton() {
  return (
    <Frame label="Loading the league feed" className="sk-feed">
      <div className="sk-feed-filters">
        <Bone w={112} h={36} className="sk-r12" />
        <Bone w={84} h={36} className="sk-r12" />
        <Bone w={92} h={36} className="sk-r12" />
      </div>
      <div className="sk-wire">
        <div className="sk-wire-day">
          <span className="sk-wire-ring" aria-hidden="true" />
          <Bone w={96} h={16} />
          <Bone w={110} h={10} className="sk-wire-sum" />
        </div>
        {FEED_LINES.map(([team, add, drop], i) => (
          <div key={i} className="sk-wire-line">
            <Bone w={24} h={24} className="sk-r8 sk-wire-node" />
            <Bone w={team} h={13} />
            <span className="sk-wire-add">
              <Bone w={28} h={28} className="sk-r8" />
              <Bone w={add} h={12} className="sk-wire-name" />
            </span>
            <Bone w={drop} h={11} className="sk-wire-drop" />
            <Bone w={28} h={14} className="sk-wire-bid" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

function TradeSideBones() {
  return (
    <span className="sk-col sk-side">
      <Bone w={90} h={10} />
      {[0, 1].map((i) => (
        <span key={i} className="sk-row sk-center">
          <Bone w={28} h={28} round />
          <span className="sk-col">
            <Bone w={i ? 84 : 112} h={12} />
            <Bone w={56} h={9} />
          </span>
        </span>
      ))}
    </span>
  )
}

/** Trade of the day's body while today's pick is worked out. */
export function TradeOfTheDaySkeleton() {
  return (
    <div className="sk stack" aria-hidden="true">
      <div className="sk-sides">
        <TradeSideBones />
        <TradeSideBones />
      </div>
      <div className="sk-row">
        <Bone w={96} h={36} className="sk-r8" />
        <Bone w={96} h={36} className="sk-r8" />
      </div>
    </div>
  )
}

/** My leagues while the account loads. */
export function LeaguesSkeleton() {
  return (
    <Frame label="Loading your account" className="sk-leagues">
      <Bone w={160} h={22} />
      <div className="card flush sk-list">
        {[0, 1].map((i) => (
          <div key={i} className="sk-story sk-row sk-center">
            <Bone w={40} h={40} className="sk-r8" />
            <span className="sk-col sk-grow-col">
              <Bone w={i ? 150 : 190} h={14} />
              <Bone w={110} h={10} />
            </span>
            <Bone w={16} h={16} className="sk-end" />
          </div>
        ))}
      </div>
      <Bone h={44} className="sk-r10" />
    </Frame>
  )
}
