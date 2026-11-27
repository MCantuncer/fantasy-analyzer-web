import { type LeagueRef, type ManagerStyleRow, type ManagerStyles } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { useManagerStyles } from '../lib/useManagerStyles'
import { ACTIVITY_LABEL, LINEUP_LABEL, inOrder, listCats, pct } from '../lib/managerStyles'
import { gamePlan, matchBoard, matchHeadline, weeksIn, type MatchCell } from '../lib/matchupScout'
import { CATEGORY_ORDER } from '../lib/statOrder'
import { ScoutBoard, ScoutLabel, ScoutNotes, type ScoutNote } from './ScoutBoard'
import './MatchupScout.css'

const BANDS = [
  { key: 'hold', label: 'Hold', hint: 'we lead' },
  { key: 'go', label: 'Go after', hint: 'cheapest flips', focus: true },
  { key: 'let_go', label: 'Let go', hint: 'not worth it' },
]

const share = (c: MatchCell) => (c.weeks ? c.theirWon / c.weeks : 0)
const tone = (margin: string): ScoutNote['tone'] =>
  margin.startsWith('+') ? 'good' : margin.startsWith('−') ? 'bad' : undefined
const vs = (c: MatchCell) => c.totals.replace(' · ', ' vs ')
const them1 = (n: number) => (n === 1 ? 'it' : n === 2 ? 'both' : 'all of them')

function notesFor(board: MatchCell[]): ScoutNote[] {
  const notes: ScoutNote[] = []
  const go = board.filter((c) => c.band === 'go')
  const hold = board.filter((c) => c.band === 'hold')
  const letGo = board.filter((c) => c.band === 'let_go')
  for (const c of go) {
    const tied = c.margin === '±0'
    notes.push({
      key: `go-${c.cat}`,
      text: (
        <>
          <b>
            {c.theirWon === 0
              ? `They have never won ${c.cat}.`
              : `They lose ${c.cat} ${weeksIn(c.weeks - c.theirWon, c.weeks)}.`}
          </b>{' '}
          {tied
            ? 'Tied right now: the cheapest flip on the board.'
            : c.status === 'not_started'
              ? 'The cheapest place to win a category this week.'
              : `We're ${c.margin.replace('−', '')} back: the cheapest gap to close.`}
        </>
      ),
      number: tied || c.status === 'not_started' ? `${c.theirWon} of ${c.weeks}` : c.margin,
      caption: tied || c.status === 'not_started' ? `weeks they won ${c.cat}` : vs(c),
      tone: tied ? undefined : tone(c.margin),
    })
  }
  const never = hold.filter((c) => c.theirWon === 0)
  for (const c of never) {
    notes.push({
      key: `never-${c.cat}`,
      text: (
        <>
          <b>They never win {c.cat}</b>
          {c.cat === 'TO' ? ' (lower wins)' : ''}. We lead it; don't hand it back.
        </>
      ),
      number: c.margin,
      caption: `${vs(c)}${c.cat === 'TO' ? ', lower wins' : ''}`,
      tone: tone(c.margin),
    })
  }
  const contested = hold.filter((c) => c.theirWon > 0 && share(c) >= 0.6)
  if (contested.length) {
    const first = contested[0]
    notes.push({
      key: 'contested',
      text: (
        <>
          They own {listCats(contested.map((c) => c.cat))} most weeks.{' '}
          <b>We lead {them1(contested.length)} today: hold, don't chase.</b>
        </>
      ),
      number: first.margin,
      caption: `${first.cat}, ${vs(first)}`,
      tone: tone(first.margin),
    })
  }
  const theirs = letGo.filter((c) => share(c) >= 0.8)
  if (theirs.length) {
    const first = theirs[0]
    notes.push({
      key: 'theirs',
      text: (
        <>
          <b>
            {listCats(theirs.map((c) => c.cat))} {theirs.length > 1 ? 'are' : 'is'} theirs{' '}
            {weeksIn(first.theirWon, first.weeks)}.
          </b>{' '}
          Not worth chasing.
        </>
      ),
      number: first.margin,
      caption: vs(first),
      tone: tone(first.margin),
    })
  }
  const rest = letGo.filter((c) => !theirs.includes(c))
  if (rest.length) {
    notes.push({
      key: 'rest',
      text: (
        <>
          <b>Let {listCats(rest.map((c) => c.cat))} go.</b>{' '}
          {go.length
            ? `Every add there is one not spent on ${listCats(go.map((c) => c.cat))}.`
            : 'Spend the adds on the leads.'}
        </>
      ),
      number: rest.map((c) => c.margin).join(' · '),
      caption: rest.map((c) => c.cat).join(' · '),
      tone: rest.every((c) => c.margin.startsWith('−')) ? 'bad' : undefined,
    })
  }
  return notes
}

function doorLabel(t: ManagerStyleRow) {
  if (t.door === 'closed') return <ScoutLabel word="Door closed">declined {t.declined}</ScoutLabel>
  if (t.door === 'open') return <ScoutLabel word="Door open">traded {t.trades}</ScoutLabel>
  return null
}

export function MatchupScoutView({ data, opponentId }: { data: ManagerStyles; opponentId: number }) {
  const them = data.teams.find((t) => t.team_id === opponentId)
  if (!them || !data.matchup || data.matchup.opponent_id !== opponentId || data.matchup.calls.length === 0) return null
  const board = matchBoard(data, them)
  const head = matchHeadline(board)
  const hold = board.filter((c) => c.band === 'hold')
  const go = board.filter((c) => c.band === 'go')
  const letGo = board.filter((c) => c.band === 'let_go')
  const majority = Math.floor(board.length / 2) + 1
  const spare = hold.length + go.length - majority
  const plays = gamePlan(board)
  return (
    <section className="card ms" aria-labelledby="ms-title">
      <span className="ms-mark" aria-hidden="true">
        {them.abbrev}
      </span>
      <div className="ms-head">
        <p className="eyebrow">Scouting report · week {data.matchup.matchup_period}</p>
        <h2 id="ms-title">How to beat {them.name}</h2>
        <div className="sb-labels">
          <ScoutLabel word={ACTIVITY_LABEL[them.activity]}>
            {them.adds_per_week.toFixed(1)}/wk · median {data.medians.adds_per_week.toFixed(1)}
          </ScoutLabel>
          <ScoutLabel word={LINEUP_LABEL[them.lineup]}>{pct(them.start_share)} of starts</ScoutLabel>
          {them.wins.length > 0 && <ScoutLabel word="Wins">{inOrder(them.wins).join(' ')}</ScoutLabel>}
          {them.gives_away.length > 0 && (
            <ScoutLabel word="Gives away">{inOrder(them.gives_away).join(' ')}</ScoutLabel>
          )}
          {doorLabel(them)}
        </div>
      </div>

      <p className="ms-headline">
        {head.plan}
        {head.plan && head.go ? ' ' : ''}
        {head.go && <span className="ms-gold">{head.go}</span>}
        <span className="ms-quiet">{head.result}</span>
      </p>

      <ScoutBoard
        label={`This week's nine categories against ${them.name}`}
        cats={CATEGORY_ORDER}
        bands={BANDS}
        catHint={(cat) => (cat === 'TO' ? 'lower wins' : undefined)}
        magnets={board.map((c) => ({
          cat: c.cat,
          band: c.band,
          big: c.margin,
          small: c.totals,
          tone: c.margin.startsWith('+') ? 'lead' : c.margin.startsWith('−') ? 'trail' : undefined,
          dim: c.band === 'let_go',
          tag: c.call === 'flip' ? 'Flip' : undefined,
        }))}
      />
      <p className="ms-foot">
        <span>
          <b>Hold</b> {hold.length}
        </span>
        <span>
          <b>Go after</b> {go.length} = {hold.length + go.length}
          {spare > 0 ? ', one spare' : ''}
        </span>
        <span>
          <b>Let go</b> {letGo.length}
        </span>
      </p>

      <div className="ms-cols">
        <div>
          <h3 className="ms-h3">Scout's notes</h3>
          <ScoutNotes notes={notesFor(board)} label="Scout's notes" />
        </div>
        {plays.length > 0 && (
          <div>
            <h3 className="ms-h3">Game plan this week</h3>
            <ol className="ms-plays">
              {plays.map((p, i) => (
                <li key={p.title} className={i === 0 ? 'go' : undefined}>
                  <span className="ms-play-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <b>{p.title}</b>
                    <p>{p.body}</p>
                    <span className="ms-chips">
                      {p.cats.map((c) => (
                        <span key={c} className="ms-chip">
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

/** League → Your matchup: how this manager plays, and the cheapest way to beat them this week. */
export function MatchupScout({
  leagueRef,
  creds,
  opponentId,
}: {
  leagueRef: LeagueRef
  creds: Credentials | null
  opponentId: number
}) {
  const q = useManagerStyles(leagueRef, creds)
  if (!q.data) return null
  return <MatchupScoutView data={q.data} opponentId={opponentId} />
}
