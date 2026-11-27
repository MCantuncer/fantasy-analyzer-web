import type { CSSProperties } from 'react'
import { Path } from '@phosphor-icons/react'
import {
  type LeagueRef,
  type ManagerStyleRow,
  type ManagerStyles,
} from '../api/client'
import type { Credentials } from '../lib/credentials'
import { useManagerStyles } from '../lib/useManagerStyles'
import {
  ACTIVITY_LABEL,
  inOrder,
  LINEUP_LABEL,
  SWING_TARGET,
  listCats,
  lookFor,
  pathBoard,
  pct,
  swingGain,
  weeksWon,
  type BoardCell,
} from '../lib/managerStyles'
import { CATEGORY_ORDER } from '../lib/statOrder'
import { ScoutBoard, ScoutLabel, ScoutNotes, type ScoutNote } from './ScoutBoard'
import './WinPath.css'

const OPENER: Record<ManagerStyleRow['activity'], string> = {
  waiver_hawk: 'We win on the wire.',
  streamer: 'We win by streaming.',
  steady_hands: 'We win with steady hands.',
  draft_loyalist: 'We win with our draft.',
  set_and_forget: 'We let the roster run.',
}

const BANDS = [
  { key: 'lock', label: 'Lock', hint: 'won most weeks' },
  { key: 'swing', label: 'Swing', hint: `push to ${pct(SWING_TARGET)}`, focus: true },
  { key: 'let_go', label: 'Let go', hint: "don't pay for it" },
]

/**
 * The read on us: only what the board, the headline and the adds panel don't already show (how often we
 * add, how we set lineups, what never came home).
 */
function notesFor(data: ManagerStyles, me: ManagerStyleRow, board: BoardCell[]): ScoutNote[] {
  const med = data.medians
  const notes: ScoutNote[] = []
  notes.push({
    key: 'activity',
    text: (
      <>
        <b>{me.adds} adds this season</b>, {me.quick_drops} of them dropped again within a week.
      </>
    ),
    number: me.adds_per_week.toFixed(1),
    caption: `adds/wk · median ${med.adds_per_week.toFixed(1)}`,
  })
  notes.push({
    key: 'lineup',
    text:
      me.missed_starts > 0 ? (
        <>
          <b>{me.missed_starts} starts left on the bench</b> so far this season.
        </>
      ) : (
        <>
          <b>No start left on the bench</b> all season.
        </>
      ),
    number: me.starts_per_week.toFixed(1),
    caption: `starts/wk · median ${med.starts_per_week.toFixed(1)}`,
  })
  const never = board.filter((c) => c.band === 'let_go' && c.won === 0)
  if (never.length) {
    notes.push({
      key: 'never',
      text: (
        <>
          <b>{listCats(never.map((c) => c.cat))} never came home.</b> Stop paying for {never.length > 1 ? 'them' : 'it'}.
        </>
      ),
      number: `0 of ${never[0].weeks}`,
      caption: 'weeks won',
      tone: 'bad',
    })
  }
  return notes
}

export function WinPathView({ data }: { data: ManagerStyles }) {
  const me = data.teams.find((t) => t.mine)
  if (!me || !data.win_path || data.weeks === 0) return null
  const board = pathBoard(data, me)
  const path = data.win_path
  const lock = board.filter((c) => c.band === 'lock').map((c) => c.cat)
  const swing = board.filter((c) => c.band === 'swing')
  const gain = swingGain(board)
  const need = inOrder(path.adds_should_bring.length ? path.adds_should_bring : swing.map((c) => c.cat))
  return (
    <section className="wp" aria-labelledby="wp-title">
      <div className="wp-head">
        <h2 id="wp-title" className="wp-title">
          <Path size={22} aria-hidden="true" />
          Your win path
        </h2>
        <div className="sb-labels">
          <ScoutLabel word={ACTIVITY_LABEL[me.activity]}>
            {me.adds_per_week.toFixed(1)}/wk · median {data.medians.adds_per_week.toFixed(1)}
          </ScoutLabel>
          <ScoutLabel word={LINEUP_LABEL[me.lineup]}>{pct(me.start_share)} of starts</ScoutLabel>
          {me.wins.length > 0 && <ScoutLabel word="Wins">{inOrder(me.wins).join(' ')}</ScoutLabel>}
          {me.chases.length > 0 && <ScoutLabel word="Chases">{inOrder(me.chases).join(' ')}</ScoutLabel>}
        </div>
      </div>

      <p className="wp-headline">
        {OPENER[me.activity]} {lock.length > 0 && <span className="wp-gold">Lock {listCats(lock)}, </span>}
        {swing.length > 0 && <>swing {listCats(swing.map((c) => c.cat))}, </>}
        <span className="wp-quiet">let the rest go.</span>
      </p>

      <ScoutBoard
        label="Your nine categories, by how often you win them"
        cats={CATEGORY_ORDER}
        bands={BANDS}
        catLabel={(cat) =>
          cat === 'TO' ? (
            <>
              <span aria-hidden="true">TO↓</span>
              <span className="sr-only">turnovers, lower wins</span>
            </>
          ) : (
            cat
          )
        }
        magnets={board.map((c) => ({
          cat: c.cat,
          band: c.band,
          big: pct(c.share),
          small: c.band === 'swing' ? `→ ${pct(SWING_TARGET)}` : `${weeksWon(c.won, c.weeks)} wks`,
          dim: c.band === 'let_go',
        }))}
      />
      <p className="wp-foot">
        <b>Lock</b> {lock.length} + <b>Swing</b> {swing.length} = {lock.length + swing.length} of {board.length}
      </p>

      <div className="wp-cols">
        <div>
          <h3 className="wp-h3">The read on us</h3>
          <ScoutNotes notes={notesFor(data, me, board)} label="The read on us" />
        </div>
        <div className="wp-adds">
          <p className="wp-kick">Where your adds go</p>
          <p className="wp-lead">{lookFor(need)}</p>
          {path.adds_bring.length > 0 && (
            <dl className="wp-bring">
              <dt>Your adds bring</dt>
              <dd>{inOrder(path.adds_bring).join(' · ')}</dd>
              {path.adds_should_bring.length > 0 && (
                <>
                  <dt>Your path needs</dt>
                  <dd className="wp-gold">{inOrder(path.adds_should_bring).join(' · ')}</dd>
                </>
              )}
            </dl>
          )}
          <ul className="wp-climb">
            {swing.map((c) => (
              <li key={c.cat}>
                <span className="wp-climb-cat">{c.cat}</span>
                <span
                  className="wp-meter"
                  style={{ '--now': pct(c.share), '--goal': pct(SWING_TARGET) } as CSSProperties}
                  aria-hidden="true"
                >
                  <i />
                  <s />
                </span>
                <span className="wp-climb-num">
                  {pct(c.share)} → <b>{pct(SWING_TARGET)}</b>
                </span>
              </li>
            ))}
          </ul>
          {gain > 0 && (
            <p className="wp-sum">
              <span>All {swing.length === 1 ? 'of it' : swing.length === 2 ? 'both' : swing.length} to {pct(SWING_TARGET)}</span>
              <span className="wp-sum-num">+{gain.toFixed(1)} cats/wk</span>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/** My Team: how you play, and the categories your moves should chase. */
export function WinPath({ leagueRef, creds }: { leagueRef: LeagueRef; creds: Credentials | null }) {
  const q = useManagerStyles(leagueRef, creds)
  if (!q.data) return null
  return <WinPathView data={q.data} />
}
