import { ClockCounterClockwise, ListNumbers, Question, Scales, Ticket, TrendUp } from '@phosphor-icons/react'
import { usePro } from '../lib/pro'
import { ProMark } from './Pro'

const INSIDE = [
  { Icon: ListNumbers, name: 'Picks', line: "Tonight's picks, best first" },
  { Icon: Ticket, name: 'Kupons', line: 'Picks put together' },
  { Icon: Question, name: 'Why not', line: 'Lines we passed on, and why' },
  { Icon: TrendUp, name: 'Over the Price', line: 'Where the price runs past ours' },
  { Icon: ClockCounterClockwise, name: 'Lost picks', line: 'Every miss, kept in view' },
  { Icon: Scales, name: 'Sportsbook vs', line: "iddaa's lines beside ours, and our record" },
] as const

/**
 * Our Estimates for a Free account: what the page holds, and one way to Pro. No numbers, since the
 * API sends none. ``ended``: Pro ran out while the page was open (a 402 mid-visit).
 */
export function ProInside({
  ended = false,
  onBack,
  onHealth,
}: {
  ended?: boolean
  onBack: () => void
  onHealth?: () => void
}) {
  const { open } = usePro()
  return (
    <div className="ic stack pro-inside-page">
      <div className="ic-head">
        <div>
          <h1 className="page-title pro-inside-title">
            Our Estimates <ProMark size="md" />
          </h1>
          <p className="ic-note">
            Every player and game, our number beside the book's, judged against the result once the games end.
          </p>
        </div>
        <div className="ic-head-btns">
          {onHealth && (
            <button type="button" className="secondary" onClick={onHealth}>
              Site health
            </button>
          )}
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
      {ended && (
        <p className="pro-inside-ended" role="status">
          Your Pro has ended, so this page is locked again.
        </p>
      )}
      <section className="pro-inside" aria-labelledby="pro-inside-h">
        <h2 id="pro-inside-h">What's inside</h2>
        <ul>
          {INSIDE.map(({ Icon, name, line }) => (
            <li key={name}>
              <Icon size={20} aria-hidden="true" />
              <span>
                <b>{name}</b>
                <span>{line}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="pro-inside-cta">
        <button type="button" aria-haspopup="dialog" onClick={open}>
          See Pro
        </button>
        <p>7 days free, then $39 a year.</p>
      </div>
    </div>
  )
}
