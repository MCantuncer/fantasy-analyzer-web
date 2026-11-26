import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import {
  fetchManagerStyles,
  retryDropped,
  retryDroppedDelay,
  type LeagueRef,
  type ManagerStyleRow,
  type ManagerStyles,
} from '../api/client'
import type { Credentials } from '../lib/credentials'
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

function notesFor(data: ManagerStyles, me: ManagerStyleRow, board: BoardCell[]): ScoutNote[] {
  const lock = board.filter((c) => c.band === 'lock')
  const swing = board.filter((c) => c.band === 'swing')
  const path = data.win_path!
  const med = data.medians
  const notes: ScoutNote[] = []
  if (lock.length) {
    const every = lock.every((c) => c.won === c.weeks)
    notes.push({
      key: 'lock',
      text: (
        <>
          <b>
            {listCats(lock.map((c) => c.cat))} {lock.length > 1 ? 'are' : 'is'} ours {every ? 'every week' : 'most weeks'}.
          </b>{' '}
          Adds don't need to go there.
        </>
      ),
      number: every ? `${lock[0].weeks} of ${lock[0].weeks}` : pct(Math.min(...lock.map((c) => c.share))),
      caption: every ? 'weeks won' : 'of weeks, at least',
      tone: 'good',
    })
  }
  if (swing.length) {
    notes.push({
      key: 'swing',
      text: (
        <>
          <b>{listCats(swing.map((c) => c.cat))} are the coin flips.</b> Push them to {pct(SWING_TARGET)} of weeks.
        </>
      ),
      number: `+${swingGain(board).toFixed(1)}`,
      caption: 'cat wins a week',
    })
  }
  if (path.adds_bring.length) {
    const need = inOrder(path.adds_should_bring)
    const bring = inOrder(path.adds_bring)
    notes.push({
      key: 'adds',
      text: need.length ? (
        <>
          <b>Our adds bring {listCats(bring)}.</b> The path needs {listCats(need)}.
        </>
      ) : (
        <>
          <b>Our adds bring {listCats(bring)}</b>, right where the path needs them.
        </>
      ),
      number: bring.join(' · '),
      caption: 'what pickups brought',
      words: true,
    })
  }
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
  const majority = Math.floor(board.length / 2) + 1
  const gain = swingGain(board)
  const need = inOrder(path.adds_should_bring.length ? path.adds_should_bring : swing.map((c) => c.cat))
  return (
    <section className="card wp" aria-labelledby="wp-title">
      <span className="wp-mark" aria-hidden="true">
        {me.abbrev}
      </span>
      <div className="wp-head">
        <p className="eyebrow">
          Self-scout · {data.weeks} week{data.weeks === 1 ? '' : 's'} on file
        </p>
        <h2 id="wp-title">Your win path</h2>
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
      <p className="wp-sub">
        {majority} of {board.length} categories wins the week.{' '}
        {lock.length > 0 && `We own ${lock.length} most weeks; `}the {swing.length} swings are the ones adds can tilt. Read
        from {data.weeks} finished week{data.weeks === 1 ? '' : 's'}.
      </p>

      <ScoutBoard
        label="Your nine categories, by how often you win them"
        cats={CATEGORY_ORDER}
        bands={BANDS}
        catHint={(cat) => (cat === 'TO' ? 'lower wins' : undefined)}
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
  const q = useQuery({
    queryKey: ['manager-styles', leagueRef.leagueId, leagueRef.season, creds?.swid ?? null],
    queryFn: () => fetchManagerStyles(leagueRef, creds),
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 30 * 60_000,
  })
  if (!q.data) return null
  return <WinPathView data={q.data} />
}
