import { useQuery } from '@tanstack/react-query'
import { CaretRight, Ticket } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { fetchBookCompare } from '../api/client'
import { STAT_NAME, linesOf, nightLabel, num, ranked, signed, tallyOf, type Line } from '../lib/iddaaCompare'
import { useFeature } from '../lib/pro'
import { PlayerHead } from './PlayerHead'
import { ProMark } from './Pro'
import './EstimatesTeaser.css'

/** One side's number in words: "GS 62%", "BOS by 4.5", "108", "7.0". */
function said(l: Line, which: 'ours' | 'book'): string {
  const v = l[which]
  if (v == null) return '–'
  switch (l.stat) {
    case 'WIN':
      return `${l.team} ${Math.round(v * 100)}%`
    case 'MAR':
      return v >= 0 ? `${l.team} by ${num(v)}` : `${l.other} by ${num(-v)}`
    case 'TEAM':
    case 'TOT':
      return num(v)
    default:
      return v.toFixed(1)
  }
}

/**
 * The way in from My leagues: one row under a small "Tonight" label. Tonight's biggest gap above the
 * book ("BOS @ GS · GS points: ours 108, the book 101.5" and "+6.5 biggest gap"), or last night's
 * tally once it is settled. The whole row opens Our Estimates.
 */
export function EstimatesTeaser({ onOpen }: { onOpen: () => void }) {
  const allowed = useFeature('estimates')
  const q = useQuery({
    queryKey: ['book-compare', null],
    queryFn: () => fetchBookCompare(null),
    retry: false,
    enabled: allowed,
  })
  const data = q.data
  const lines = useMemo(() => (data ? linesOf(data, new Date()) : []), [data])
  const settled = !!data && data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const top = ranked(
    lines.filter((l) => !l.tipped || settled),
    true,
  ).above[0]
  const t = tallyOf(lines)

  if (!allowed)
    return (
      <div className="et">
        <button
          type="button"
          className="et-row"
          aria-label="Our Estimates, Pro feature. Picks and Sportsbook vs"
          onClick={onOpen}
        >
          <span className="et-ic" aria-hidden="true">
            <Ticket />
          </span>
          <span className="et-text">
            <span className="et-nm">
              Our Estimates
              <ProMark label={false} />
            </span>
            <span className="et-s">Picks and Sportsbook vs</span>
          </span>
          <CaretRight className="et-go" aria-hidden="true" />
        </button>
      </div>
    )

  const tonight = !!data && !settled && data.games.length > 0
  const gap = top && !settled ? top : null
  return (
    <div className="et">
      {(tonight || settled) && (
        <p className="et-k">
          {tonight && <span className="et-live" aria-hidden="true" />}
          {settled ? nightLabel(data.date) : 'Tonight'}
        </p>
      )}
      <button type="button" className={`et-row${gap ? ' et-has-gap' : ''}`} onClick={onOpen}>
        <span className="et-ic" aria-hidden="true">
          {gap?.kind === 'player' ? (
            <PlayerHead player={{ id: gap.playerId ?? 0, name: gap.name }} team={gap.team} size={40} />
          ) : (
            <Ticket />
          )}
        </span>
        <span className="et-text">
          <span className="et-nm">Our Estimates</span>
          {settled ? (
            <span className="et-s">
              We won <b>{t.oursCloser}</b> of <b>{t.judged}</b> · Book won <b>{t.bookCloser}</b>
            </span>
          ) : gap ? (
            <span className="et-s">
              {gap.kind === 'player' ? gap.name : gap.gameLabel} ·{' '}
              {gap.stat === 'TEAM' ? `${gap.team} points` : STAT_NAME[gap.stat]}: ours <b>{said(gap, 'ours')}</b>, the
              book <b>{said(gap, 'book')}</b>
            </span>
          ) : null}
        </span>
        {gap && (
          <span className="et-gap">
            <b>{signed(gap.gap ?? 0, gap.stat)}</b>
            <span>biggest gap</span>
          </span>
        )}
        <CaretRight className="et-go" aria-hidden="true" />
      </button>
    </div>
  )
}
