// A hot run, explained: the row's one line and the open row's / card's story with its table.
// Ink only: the verdict is an explanation, not an outcome, so no green, amber or gold. Coral marks
// only a part that went down. Copy comes from lib/hotRun.
import { CircleHalf, Flame, TrendUp } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import type { HotRun } from '../api/client'
import { keptLine, rowLine, runParts, runSentence, runWindow, VERDICT, type HotVerdict } from '../lib/hotRun'
import './HotRun.css'

/** A static Phosphor mark in ink; the words carry the meaning. */
export function VerdictIcon({ verdict, size }: { verdict: HotVerdict; size: number }) {
  const Icon = verdict === 'straw_fire' ? Flame : verdict === 'bigger_role' ? TrendUp : CircleHalf
  return <Icon className="hr-icon" size={size} weight="bold" aria-hidden="true" />
}

/** The FA row's third line: mark, verdict word, the one fact behind it. Screen readers get rowSaid. */
export function HotLine({ run }: { run: HotRun }) {
  const { word, reason } = rowLine(run)
  return (
    <span className="hr-line" aria-hidden="true">
      <VerdictIcon verdict={run.verdict} size={13} />
      <b>{word}</b>
      <span className="hr-reason">{reason}</span>
    </span>
  )
}

/** The usual → recent pair, read as "22 to 24". */
function Pair({ from, to }: { from: string; to: string }) {
  return (
    <span className="hr-pair num">
      <span className="hr-from">{from}</span>
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> to </span>
      <b>{to}</b>
    </span>
  )
}

/**
 * Headline (verdict, then how much should last), one sentence, then the table: one line per part
 * with usual → recent and a bar on a fixed scale whose solid start is the share that tends to last.
 */
export function HotStory({ run, place }: { run: HotRun; place: 'row' | 'card' }) {
  const parts = runParts(run)
  return (
    <div className="hr-wrap">
      <div className="hr-story" data-place={place}>
        <div className="hr-words">
          <p className="hr-head">
            <VerdictIcon verdict={run.verdict} size={20} />
            <span className="hr-head-text">
              <b className="hr-word">{VERDICT[run.verdict]}</b>
              <span className="hr-kept">{keptLine(run)}</span>
            </span>
            {place === 'row' && <span className="hr-window">{runWindow(run)}</span>}
          </p>
          <p className="hr-say">{runSentence(run)}</p>
        </div>
        <div className="hr-table">
          <ul className="hr-parts" aria-label="What the run was made of, against his usual">
            {parts.map((p) => (
              <li key={p.key} className="hr-part" data-down={p.down || undefined}>
                <span className="hr-label">{p.label}</span>
                {p.from != null && p.to != null && <Pair from={p.from} to={p.to} />}
                <span className="hr-track">
                  <span
                    className="hr-bar"
                    style={{ '--reach': p.reach, '--keep': p.keep } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span className="hr-keep" />
                  </span>
                  <span className="hr-note">{p.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="hr-foot">
            {place === 'row' ? 'His odds number already counts this.' : 'Our odds and trade numbers already count this.'}
          </p>
        </div>
      </div>
    </div>
  )
}
