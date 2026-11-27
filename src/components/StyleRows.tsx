import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import type { ManagerStyleRow, ManagerStyles } from '../api/client'
import { ACTIVITY_LABEL, LINEUP_LABEL, inOrder, pct, weeksWon } from '../lib/managerStyles'
import { catShare, strip, vsMedian, type Chip, type Strip } from '../lib/styleStrip'
import { TeamCrest } from './TeamCrest'
import './StyleRows.css'

/** Keep a label inside the strip when its dot is near an end. */
const side = (at: number) => (at < 0.15 ? ' l' : at > 0.85 ? ' r' : '')

/** A track of dots, one per manager, with a tick at the league median and this manager's dot in gold. */
function DotStrip({
  s,
  me,
  label,
  medianLabel,
  small = false,
}: {
  s: Strip
  me: number
  label?: string
  medianLabel?: string
  small?: boolean
}) {
  const mine = s.dots.find((d) => d.id === me)
  return (
    <div className={`sr-strip${small ? ' small' : ''}`} aria-hidden="true">
      <span className="sr-track" />
      <span className="sr-tick" style={{ left: `${s.medianAt * 100}%` } as CSSProperties} />
      {medianLabel && (
        <span className={`sr-tick-label${side(s.medianAt)}`} style={{ left: `${s.medianAt * 100}%` } as CSSProperties}>
          {medianLabel}
        </span>
      )}
      {s.dots
        .filter((d) => d.id !== me)
        .map((d) => (
          <span key={d.id} className="sr-dot" style={{ left: `${d.at * 100}%` } as CSSProperties} />
        ))}
      {mine && (
        <>
          <span className="sr-dot me" style={{ left: `${mine.at * 100}%` } as CSSProperties} />
          {label && (
            <span className={`sr-me-label${side(mine.at)}`} style={{ left: `${mine.at * 100}%` } as CSSProperties}>
              {label}
            </span>
          )}
        </>
      )}
    </div>
  )
}

function lineupNumber(t: ManagerStyleRow, med: ManagerStyles['medians']) {
  if (t.lineup === 'leaks_starts') return `${t.missed_starts} missed`
  if (t.lineup === 'low_volume') return `${t.starts_per_week.toFixed(1)}/wk vs ${med.starts_per_week.toFixed(1)}`
  if (t.lineup === 'steady') return pct(t.start_share)
  return null
}

function Readout({ data, t, chip, you }: { data: ManagerStyles; t: ManagerStyleRow; chip: Chip; you: boolean }) {
  const med = data.medians
  const who = you ? 'You' : t.abbrev
  const whose = you ? 'your' : 'their'
  const foot = `Each dot is one of the ${data.teams.length} managers; the tick is the league median; ${whose} dot is gold.`
  let body: ReactNode
  if (chip === 'activity') {
    body = (
      <>
        <p className="sr-read-head">
          <b>{ACTIVITY_LABEL[t.activity]}</b> · {who} <b>{t.adds_per_week.toFixed(1)}</b> adds/wk · median{' '}
          <b>{med.adds_per_week.toFixed(1)}</b> · <b>{vsMedian(t.adds_per_week, med.adds_per_week)}</b>
          {t.faab_spent > 0 && (
            <>
              {' '}
              · FAAB <b>${t.faab_spent}</b>
            </>
          )}
          {t.quick_drops > 0 && <> · {t.quick_drops} dropped within a week</>}
        </p>
        <DotStrip
          s={strip(data.teams, (x) => x.adds_per_week)}
          me={t.team_id}
          label={`${who} ${t.adds_per_week.toFixed(1)}/wk`}
          medianLabel={`median ${med.adds_per_week.toFixed(1)}/wk`}
        />
        <p className="sr-read-foot">{foot}</p>
      </>
    )
  } else if (chip === 'lineup') {
    body = (
      <>
        <p className="sr-read-head">
          <b>{LINEUP_LABEL[t.lineup]}</b> · {who} <b>{t.starts_per_week.toFixed(1)}</b> starts/wk · median{' '}
          <b>{med.starts_per_week.toFixed(1)}</b> · <b>{pct(t.start_share)}</b> of possible starts
          {t.missed_starts > 0 && <> · {t.missed_starts} left on the bench</>}
        </p>
        <DotStrip
          s={strip(data.teams, (x) => x.starts_per_week)}
          me={t.team_id}
          label={`${who} ${t.starts_per_week.toFixed(1)}/wk`}
          medianLabel={`median ${med.starts_per_week.toFixed(1)}/wk`}
        />
        <p className="sr-read-foot">{foot}</p>
      </>
    )
  } else if (chip === 'door') {
    body = (
      <p className="sr-read-head">
        {t.door === 'closed' ? (
          <>
            <b>Door closed</b> · turned down <b>{t.declined}</b> trade offers, made <b>{t.trades}</b> trades this
            season.
          </>
        ) : (
          <>
            <b>Door open</b> · made <b>{t.trades}</b> trade{t.trades === 1 ? '' : 's'} this season.
          </>
        )}
      </p>
    )
  } else {
    const cats = inOrder(chip === 'wins' ? t.wins : t.gives_away)
    body = (
      <>
        <p className="sr-read-head">
          <b>{chip === 'wins' ? 'Wins' : 'Gives away'}</b> · share of {data.weeks} finished weeks each manager won
        </p>
        <ul className="sr-cats">
          {cats.map((cat) => {
            const c = t.categories.find((x) => x.cat === cat)
            return (
              <li key={cat}>
                <span className="sr-cat">{cat}</span>
                <DotStrip s={strip(data.teams, (x) => catShare(x, cat), [0, 1])} me={t.team_id} small />
                <span className="sr-cat-num">{c ? weeksWon(c.won, c.weeks) : '–'}</span>
              </li>
            )
          })}
        </ul>
        <p className="sr-read-foot">{foot}</p>
      </>
    )
  }
  return <div className="sr-read">{body}</div>
}

/** Standings → Styles: each manager's labels as chips; tap one for its number against the league. */
export function StyleRows({
  data,
  order,
  colours,
  myTeamId,
  opponentId,
}: {
  data: ManagerStyles
  order: number[]
  colours: Map<number, string>
  myTeamId: number | null
  opponentId: number | null
}) {
  const [open, setOpen] = useState<{ team: number; chip: Chip } | null>(null)
  const base = useId()
  const rows = order.map((id) => data.teams.find((t) => t.team_id === id)).filter((t): t is ManagerStyleRow => !!t)
  return (
    <ol className="sr-rows" aria-label="How each manager plays">
      {rows.map((t, i) => {
        const you = t.team_id === myTeamId
        const readId = `${base}-${t.team_id}`
        const chip = (key: Chip, word: string, num?: ReactNode, quiet = false) => {
          const isOpen = open?.team === t.team_id && open.chip === key
          return (
            <button
              type="button"
              className={`sr-chip${quiet ? ' quiet' : ''}${isOpen ? ' open' : ''}`}
              aria-expanded={isOpen}
              aria-controls={readId}
              onClick={() => setOpen(isOpen ? null : { team: t.team_id, chip: key })}
            >
              <b>{word}</b>
              {num && <span className="sr-chip-num">{num}</span>}
            </button>
          )
        }
        const lineupNum = lineupNumber(t, data.medians)
        const isOpen = open?.team === t.team_id
        return (
          <li
            key={t.team_id}
            className={`sr-row${you ? ' mine' : ''}${t.team_id === opponentId ? ' rival' : ''}`}
            style={{ '--team': colours.get(t.team_id) } as CSSProperties}
          >
            <div className="sr-team">
              <span className="sr-rank num">{i + 1}</span>
              <TeamCrest name={t.name} colour={colours.get(t.team_id)} size={22} />
              <span className="sr-name">
                <b>{t.name}</b>
                <span className="sr-rec num">
                  {t.record}
                  {you && <span className="sr-you"> · You</span>}
                  {t.team_id === opponentId && ' · this week'}
                </span>
              </span>
            </div>
            <div className="sr-chips">
              {chip('activity', ACTIVITY_LABEL[t.activity])}
              {chip('lineup', LINEUP_LABEL[t.lineup], lineupNum)}
              {t.door === 'closed' && chip('door', 'Door closed', `declined ${t.declined}`)}
              {t.door === 'open' && chip('door', 'Door open', `traded ${t.trades}`)}
              {t.wins.length > 0 && chip('wins', 'Wins', inOrder(t.wins).join(' '), true)}
              {t.gives_away.length > 0 && chip('gives', 'Gives away', inOrder(t.gives_away).join(' '), true)}
            </div>
            <div id={readId} className="sr-read-wrap" hidden={!isOpen}>
              {isOpen && open && <Readout data={data} t={t} chip={open.chip} you={you} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
