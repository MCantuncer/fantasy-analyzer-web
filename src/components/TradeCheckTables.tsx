import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import type { OfferCheck } from '../api/client'
import { inCategoryOrder, pointChange, weekSpan } from '../lib/tradeCheck'
import { ChangeDot } from './ChangeDot'
import { TeamCrest } from './TeamCrest'
import './TradeCheckTables.css'

const signed = (n: number, digits = 0) => {
  const v = digits ? Number(n.toFixed(digits)) : n
  const text = Math.abs(v).toFixed(digits)
  return v > 0 ? `+${text}` : v < 0 ? `−${text}` : '±0'
}
const words = (n: number, unit = '') => (n > 0 ? `up ${n}${unit}` : n < 0 ? `down ${-n}${unit}` : 'no change')

/** One side of a category row: today → after, the signed change, and the dumbbell. */
function Cell({
  before,
  after,
  side,
  who,
  category,
  punt,
}: {
  before: number
  after: number
  side: 'me' | 'them'
  who: string
  category: string
  punt: boolean
}) {
  const b = Math.round(before * 100)
  const a = Math.round(after * 100)
  const moved = pointChange(before, after)
  const tone = side === 'them' ? 'them' : moved > 0 ? 'up' : moved < 0 ? 'down' : 'flat'
  return (
    <td className={`tck-tb-cell ${side}${punt ? ' punt' : ''}`}>
      <span className="sr-only">
        {category}, {who}: {b} to {a} percent, {words(moved)}
        {punt ? ', punted' : ''}.
      </span>
      <span className="tck-tb-nums num" aria-hidden="true">
        <span className="tck-tb-before">{b}</span>
        <span className="tck-tb-to">→</span>
        <b>{a}</b>
        <span className={`tck-tb-delta ${tone}${Math.abs(moved) >= 5 ? ' big' : ''}`}>{signed(moved)}</span>
      </span>
      <ChangeDot before={before} after={after} side={side} />
    </td>
  )
}

/** A playoff-week or finish cell: numbers only, one decimal, no bars. */
function Figure({
  before,
  after,
  side,
  lowerIsBetter = false,
  label,
}: {
  before: number
  after: number
  side: 'me' | 'them'
  lowerIsBetter?: boolean
  label: string
}) {
  const b = before.toFixed(1)
  const a = after.toFixed(1)
  const moved = Number((after - before).toFixed(1))
  const better = lowerIsBetter ? moved < 0 : moved > 0
  const tone = side === 'them' ? 'them' : moved === 0 ? 'flat' : better ? 'up' : 'down'
  const Arrow = lowerIsBetter && moved !== 0 ? (better ? ArrowUp : ArrowDown) : null
  const change = lowerIsBetter
    ? moved === 0
      ? 'no change'
      : `${better ? 'up' : 'down'} ${Math.abs(moved).toFixed(1)}`
    : words(moved)
  return (
    <td className={`tck-tb-fig ${side}`}>
      <span className="sr-only">
        {label}: {b} to {a}, {change}.
      </span>
      <span className="tck-tb-nums num" aria-hidden="true">
        <span className="tck-tb-before">{b}</span>
        <span className="tck-tb-to">→</span>
        <b>{a}</b>
        <span className={`tck-tb-delta ${tone}`}>
          {Arrow && <Arrow size={11} weight="bold" />}
          {Arrow ? Math.abs(moved).toFixed(1) : signed(moved, 1)}
        </span>
      </span>
    </td>
  )
}

function Heads({
  myName,
  partnerName,
  partnerColour,
}: {
  myName: string
  partnerName: string
  partnerColour?: string
}) {
  return (
    <thead>
      <tr>
        <th scope="col" className="tck-tb-who me">
          <TeamCrest name={myName} colour="var(--gold)" size={20} /> You
        </th>
        <th scope="col" className="tck-tb-spine">
          <span className="sr-only">Category</span>
        </th>
        <th scope="col" className="tck-tb-who them">
          <span className="tck-tb-name">{partnerName}</span>{' '}
          <TeamCrest name={partnerName} colour={partnerColour} size={20} />
        </th>
      </tr>
    </thead>
  )
}

interface Props {
  check: OfferCheck
  myName: string
  partnerName: string
  partnerColour?: string
}

/**
 * Category by category, then the fantasy playoff weeks and the finish: real tables mirrored about the
 * spine, yours growing left and theirs right. Win chances are weekly, in the site's fixed category order.
 */
export function TradeCheckTables({ check, myName, partnerName, partnerColour }: Props) {
  const idea = check.idea
  const rows = inCategoryOrder(idea.category_detail ?? [])
  const myPunts = new Set(check.my_punts ?? [])
  const theirPunts = new Set(check.partner_punts ?? [])
  const punts = [...myPunts].length || [...theirPunts].length
  const weeks = idea.playoff_weeks ?? []
  const finish =
    idea.finish_before != null && idea.finish_after != null
      ? {
          mine: [idea.finish_before, idea.finish_after] as const,
          theirs:
            idea.partner_finish_before != null && idea.partner_finish_after != null
              ? ([idea.partner_finish_before, idea.partner_finish_after] as const)
              : null,
        }
      : null
  const heads = <Heads myName={myName} partnerName={partnerName} partnerColour={partnerColour} />

  return (
    <>
      {rows.length > 0 && (
        <section className="card tck-tb" aria-labelledby="tck-tb-cats">
          <div className="tck-tb-head">
            <h3 id="tck-tb-cats">Category by category</h3>
            <span className="tck-tb-legend" aria-hidden="true">
              <span className="tck-tb-ring" /> today <span className="tck-tb-dot" /> after · weekly win chance, %
            </span>
          </div>
          <table className="tck-tb-table">
            <caption className="sr-only">
              How often each team wins each category in a week, today and after the trade, in percent
            </caption>
            {heads}
            <tbody>
              {rows.map((r) => (
                <tr key={r.category}>
                  <Cell
                    before={r.my_win_before}
                    after={r.my_win_after}
                    side="me"
                    who="You"
                    category={r.category}
                    punt={myPunts.has(r.category)}
                  />
                  <th scope="row" className="tck-tb-spine">
                    {r.category}
                    {r.category === 'TO' && (
                      <small aria-label="fewer turnovers wins">
                        <ArrowDown size={9} weight="bold" aria-hidden="true" /> fewer
                      </small>
                    )}
                    {(myPunts.has(r.category) || theirPunts.has(r.category)) && (
                      <small className="tck-tb-punt">
                        {myPunts.has(r.category) && theirPunts.has(r.category)
                          ? 'Both punt'
                          : myPunts.has(r.category)
                            ? '← Punt'
                            : 'Punt →'}
                      </small>
                    )}
                  </th>
                  <Cell
                    before={r.their_win_before}
                    after={r.their_win_after}
                    side="them"
                    who={partnerName}
                    category={r.category}
                    punt={theirPunts.has(r.category)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tck-tb-note">
            Changes of 5 pts or more are bold.{' '}
            {punts ? 'A punted category is faded on that side.' : 'Neither team punts a category here.'}
          </p>
        </section>
      )}

      {(weeks.length > 0 || finish) && (
        <section className="card tck-tb" aria-labelledby="tck-tb-weeks">
          <div className="tck-tb-head">
            <h3 id="tck-tb-weeks">Fantasy playoff weeks</h3>
            <span className="tck-tb-legend">categories won, of 9 · finish is the average final place</span>
          </div>
          <table className="tck-tb-table weeks">
            <caption className="sr-only">
              Categories won in each fantasy playoff week, of 9, and the average final place, today and after the trade
            </caption>
            {heads}
            <tbody>
              {weeks.map((w) => (
                <tr key={w.period}>
                  <Figure before={w.my_cats_before} after={w.my_cats_after} side="me" label="You" />
                  <th scope="row" className="tck-tb-spine">
                    Wk {w.period}
                    <small>{weekSpan(w.starts_on, w.ends_on)}</small>
                  </th>
                  <Figure before={w.their_cats_before} after={w.their_cats_after} side="them" label={partnerName} />
                </tr>
              ))}
              {finish && (
                <tr className="tck-tb-finish">
                  <Figure before={finish.mine[0]} after={finish.mine[1]} side="me" label="You" lowerIsBetter />
                  <th scope="row" className="tck-tb-spine">
                    Finish
                    <small>avg place</small>
                  </th>
                  {finish.theirs ? (
                    <Figure
                      before={finish.theirs[0]}
                      after={finish.theirs[1]}
                      side="them"
                      label={partnerName}
                      lowerIsBetter
                    />
                  ) : (
                    <td />
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
