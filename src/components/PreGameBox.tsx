import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { ApiError, fetchPregame } from '../api/client'
import type { Game, PregameBox, PregamePlayer, PregameSide } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { BOX_CATS } from '../lib/boxSort'
import { band } from '../lib/ourCall'
import { nickname, tipOff } from '../lib/scores'
import { teamLight } from '../lib/nbaTeams'
import { useFitsWidth } from '../lib/useFitsWidth'
import {
  WHY_COLS,
  countdown,
  headline,
  houseLight,
  initial,
  lineupNews,
  outShare,
  outcomes,
  people,
  place,
  rowNote,
  splitRotation,
  stepText,
  teamLine,
  whyLines,
  whySteps,
  type Side,
} from '../lib/pregame'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { QuarterStave } from './QuarterStave'
import { BenchBreak } from './StartersSplit'
import './PreGameBox.css'

/* The pre-game box ("Overture", Can 2026-11-20): a game that hasn't started opens like a box score.
   Our call drawn large in outline with why it is what it is, how games called this close have really
   ended, your players and your rival's, then every rotation player's line for the game in the live
   box's columns, each opening to its why. Before tip-off the box is alive with what changes: the
   countdown, the lineup-news window, the light coming up. Never betting words. */

/** The page's head (BoxTitle), given the team switch and the line under the title. */
export type PreGameHead = (teamSwitch: ((short: boolean) => ReactNode) | undefined, line: ReactNode) => ReactNode

/** "Tips in 2h 13m · Lineup news from 2:00 AM", once a minute. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function PreGameBox({
  game,
  day,
  leagueId,
  season,
  creds,
  teamId,
  rivalId,
  rivalColour,
  abbrev,
  head,
}: {
  game: Game
  day: number | null
  leagueId: number
  season: number
  creds: Credentials | null
  teamId: number
  rivalId: number | null
  rivalColour?: string
  abbrev: Map<number, string>
  head: PreGameHead
}) {
  const now = useMinute()
  const q = useQuery({
    queryKey: ['pregame', leagueId, season, game.id, creds?.swid ?? null],
    queryFn: () => fetchPregame(leagueId, season, game.id, day, creds),
    // 409: the day's box is still being built on the server; it's ready in a few seconds.
    retry: (n, e) => (e instanceof ApiError && e.status === 409 ? n < 12 : n < 1),
    retryDelay: 4_000,
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
  })
  const left = countdown(game.start, now)
  const news = lineupNews(game.start, now)
  const line = (
    <>
      {left ? (
        <>
          Tips in <b className="num">{left}</b>
        </>
      ) : (
        <>Tip-off</>
      )}
      <i />
      {news.state === 'later' ? (
        <>Lineup news from {tipOff(news.from.toISOString())}</>
      ) : news.state === 'now' ? (
        <span className="pg-news-now">Lineup news now</span>
      ) : (
        <>Lineups set</>
      )}
    </>
  )
  if (!q.data)
    return (
      <div className="sc-box sc-box-fetching" aria-busy={!q.isError}>
        {head(undefined, line)}
        <div className="sc-box-wait" role="status">
          {q.isError ? (
            <>
              <span>Couldn't build the pre-game box.</span>
              <button type="button" className="secondary" onClick={() => q.refetch()}>
                Try again
              </button>
            </>
          ) : (
            <span>Reading both rotations</span>
          )}
        </div>
      </div>
    )
  return (
    <Ready
      box={q.data}
      game={game}
      now={now}
      teamId={teamId}
      rivalId={rivalId}
      rivalColour={rivalColour}
      abbrev={abbrev}
      head={head}
      line={line}
    />
  )
}

function Ready({
  box: b,
  game,
  now,
  teamId,
  rivalId,
  rivalColour,
  abbrev,
  head,
  line,
}: {
  box: PregameBox
  game: Game
  now: number
  teamId: number
  rivalId: number | null
  rivalColour?: string
  abbrev: Map<number, string>
  head: PreGameHead
  line: ReactNode
}) {
  // It opens on the team with more of your players who play tonight (the away team on a tie).
  const active = (s: Side) => b[s].players.filter((p) => p.owner_team_id === teamId).length
  const [picked, setPicked] = useState<Side | null>(null)
  const sideKey: Side = picked ?? (active('home') > active('away') ? 'home' : 'away')
  const side = b[sideKey]
  const [open, setOpen] = useState<number | null>(null)
  const whyId = useId()
  // A table that fits its card sticks its header under the title; one too wide scrolls in its own window.
  const wrap = useRef<HTMLDivElement>(null)
  const fits = useFitsWidth(wrap)

  const goTo = (s: Side, playerId: number | null) => {
    setPicked(s)
    setOpen(playerId)
    if (playerId == null) return
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`.pg-box [data-player='${playerId}']`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
  }

  const teamSwitch = (short: boolean) => (
    <div className="segmented sc-team-switch" role="group" aria-label="Team">
      {(['away', 'home'] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={s === sideKey}
          onClick={() => setPicked(s)}
          style={{ '--tl': teamLight(b[s].abbrev) ?? 'var(--accent)' } as CSSProperties}
        >
          <TeamLogo abbrev={b[s].abbrev} size={20} />
          <span className="sc-team-label">{short ? nickname(b[s].name) : b[s].name}</span>
        </button>
      ))}
    </div>
  )

  const marked = [teamId, rivalId].flatMap((id) => (id != null && abbrev.has(id) ? [abbrev.get(id)!] : []))
  const { starters, bench } = splitRotation(side.players)
  const row = (p: PregamePlayer) => (
    <PlayerRows
      key={p.player_id}
      p={p}
      side={side}
      mine={p.owner_team_id === teamId}
      rival={rivalId != null && p.owner_team_id === rivalId}
      abbrev={abbrev}
      marked={marked}
      open={open === p.player_id}
      whyId={`${whyId}-${p.player_id}`}
      onToggle={() => setOpen((o) => (o === p.player_id ? null : p.player_id))}
    />
  )
  const style = {
    '--pg-house': houseLight(game.start, now),
    ...(rivalColour ? { '--rival': rivalColour } : {}),
  } as CSSProperties

  return (
    <div className="sc-box box-card pg-box" style={style}>
      {head(teamSwitch, line)}
      <CallPanel b={b} />
      <QuarterStave b={b} />
      <HowItCouldGo b={b} />
      <Stakes
        b={b}
        teamId={teamId}
        rivalId={rivalId}
        rivalAbbrev={rivalId != null ? abbrev.get(rivalId) : undefined}
        onGo={goTo}
      />
      <OutLine side={side} teamId={teamId} />
      <div
        ref={wrap}
        className={`table-wrap box-scroll pg-scroll${fits ? ' fits' : ''}`}
        {...(fits ? {} : { tabIndex: 0, role: 'region', 'aria-label': 'Estimated lines' })}
      >
        <table className="box pg-table">
          <thead>
            <tr>
              <th scope="col" className="left">
                PLAYER
              </th>
              <th scope="col" className="left" title="The fantasy team in this league that owns him">
                OWNER
              </th>
              <th scope="col">MIN</th>
              {BOX_CATS.map((c) => (
                <th key={c.key} scope="col">
                  <span className="sc-key pg-key">{c.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${sideKey}-starters`} className="sc-starters">
            {starters.map(row)}
          </tbody>
          {bench.length > 0 && (
            <tbody key={`${sideKey}-bench`} className="sc-bench">
              <BenchBreak count={bench.length} abbrev={side.abbrev} />
              {bench.map(row)}
            </tbody>
          )}
          {side.out.length > 0 && (
            <tbody key={`${sideKey}-out`} className="pg-out-rows">
              <tr className="pg-out-break">
                <th scope="rowgroup" colSpan={12}>
                  Out
                </th>
              </tr>
              {side.out.map((o) => (
                <tr key={o.player_id} className={o.owner_team_id === teamId ? 'mine pg-out' : 'pg-out'}>
                  <th scope="row">
                    <span className="box-player">
                      <PlayerLink player={{ id: o.player_id, name: o.name }} decorative>
                        <PlayerHead player={{ id: o.player_id, name: o.name }} size={24} />
                      </PlayerLink>
                      <s>
                        <PlayerLink player={{ id: o.player_id, name: o.name }} />
                      </s>
                      <span className="sr-only"> (out tonight)</span>
                    </span>
                  </th>
                  <td className="left sc-owner">
                    {o.owner_team_id == null ? 'FA' : (abbrev.get(o.owner_team_id) ?? '')}
                  </td>
                  <td colSpan={10} className="left pg-out-note muted">
                    Out tonight
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      <TeamFoot side={side} />
    </div>
  )
}

/** Our call drawn large in outline, the one-sentence why, and the margin piece by piece. */
function CallPanel({ b }: { b: PregameBox }) {
  const pct = Math.round(b.chance * 100)
  const W = place(b[b.pick])
  // Each club's light colours its own number, and the plate runs from one to the other.
  const clubs = {
    '--ca': teamLight(b.away.abbrev) ?? 'var(--text-2)',
    '--cb': teamLight(b.home.abbrev) ?? 'var(--text-2)',
    '--cw': teamLight(b[b.pick].abbrev) ?? 'var(--text-2)',
  } as CSSProperties
  return (
    <section className="pg-call" aria-label="Our call and why">
      <div className="pg-ledger" style={clubs}>
        <div className="pg-teams" aria-hidden="true">
          {(['away', 'home'] as const).map((s) => (
            <span key={s} className={`pg-team ${s}`}>
              <TeamLogo abbrev={b[s].abbrev} size={22} />
              {b[s].abbrev}
            </span>
          ))}
        </div>
        <div className="pg-plate" aria-hidden="true">
          {(['away', 'home'] as const).map((s) => (
            <span key={s} className={`pg-big ${s}${s === b.pick ? ' pg-pick' : ''}`}>
              {b[s].call}
              {/* Both cells are built the same: the caret shows on the pick only. */}
              <svg className="oc" viewBox="0 0 8 10" width="7" height="9" aria-hidden="true">
                <path d="M7.2 1v8L1 5z" />
              </svg>
            </span>
          ))}
        </div>
        <p className="pg-call-label">
          Our call · <b className="pg-winner">{W}</b> ·{' '}
          <span className="conf-band" data-band={band(pct)}>
            <span className="num">{pct}%</span>
          </span>
        </p>
        <span className="sr-only">
          Our call: {b.away.name} {b.away.call}, {b.home.name} {b.home.call}. {W} to win, {pct}% sure.
        </span>
      </div>
      <div className="pg-why">
        <p className="pg-headline">{headline(b)}</p>
        <dl className="pg-terms">
          {whyLines(b).map((w) => (
            <div key={w.kind} className={`pg-term${w.kind === 'total' ? ' total' : ''}${w.quiet ? ' quiet' : ''}`}>
              <dt>
                <span>{w.label}</span>
                <span className="num pg-pts">
                  {w.kind === 'total' ? w.points : w.points > 0 ? `+${w.points}` : w.points < 0 ? `−${-w.points}` : '0'}
                </span>
              </dt>
              <dd>{w.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** How games called about this close have really ended (Can, 2026-11-20: "any game cannot end with 35+
    difference"): five bands of the final margin with how often, from five seasons of games. */
function HowItCouldGo({ b }: { b: PregameBox }) {
  const { bands, blowout } = outcomes(b)
  const other = b.pick === 'away' ? 'home' : 'away'
  // The pick's side of the strip in its club's colour, the other side's in theirs; "Within 5" stays ink.
  const clubs = {
    '--cw': teamLight(b[b.pick].abbrev) ?? 'var(--text)',
    '--cl': teamLight(b[other].abbrev) ?? 'var(--text)',
  } as CSSProperties
  return (
    <section className="pg-how" aria-labelledby="pg-how-h" style={clubs}>
      <h3 id="pg-how-h">How it could go</h3>
      <div className="pg-bar" aria-hidden="true">
        {bands.map((x) => (
          <span key={x.tone} className={`pg-seg ${x.tone}`} style={{ flexGrow: x.times }} />
        ))}
      </div>
      <ul className="pg-bands">
        {bands.map((x) => (
          <li key={x.tone} className={x.tone}>
            <i aria-hidden="true" />
            <span className="pg-band-label">{x.label}</span>
            <span>
              <span className="num">{x.times}</span>
              <span className="pg-in"> in 100</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted">
        Games we called by about this much, over five seasons. One in {Math.max(2, Math.round(100 / blowout))} was
        decided by 20 or more.
      </p>
    </section>
  )
}

/** Your players and your rival's, both teams, each a button to his row. */
function Stakes({
  b,
  teamId,
  rivalId,
  rivalAbbrev,
  onGo,
}: {
  b: PregameBox
  teamId: number
  rivalId: number | null
  rivalAbbrev?: string
  onGo: (s: Side, playerId: number | null) => void
}) {
  const { mine, rival } = people(b, teamId, rivalId)
  if (mine.length === 0 && rival.length === 0) return null
  const chip = (x: (typeof mine)[number], who: 'you' | 'rival') => {
    const l = 'line' in x.p ? (x.p as PregamePlayer).line : null
    return (
      <li key={x.p.player_id}>
        <button type="button" className={`pg-chip ${who}`} onClick={() => onGo(x.side, x.out ? null : x.p.player_id)}>
          <PlayerHead player={{ id: x.p.player_id, name: x.p.name }} size={24} />
          <span className="pg-chip-name">{initial(x.p.name)}</span>
          <span className="pg-chip-team">{x.abbrev}</span>
          {x.out || !l ? (
            <span className="pg-chip-out">Out tonight</span>
          ) : (
            <span className="pg-chip-line">
              <b className="num">{Math.round(l.pts)}</b> pts · <b className="num">{Math.round(l.reb)}</b> reb ·{' '}
              <b className="num">{Math.round(l.ast)}</b> ast
            </span>
          )}
        </button>
      </li>
    )
  }
  return (
    <section className="pg-stakes" aria-label="Yours and your rival's tonight">
      {mine.length > 0 && (
        <div className="pg-stake">
          <h3>Yours tonight</h3>
          <ul>{mine.map((x) => chip(x, 'you'))}</ul>
        </div>
      )}
      {rival.length > 0 && (
        <div className="pg-stake">
          <h3>Rival{rivalAbbrev ? <span className="muted"> · {rivalAbbrev}</span> : null}</h3>
          <ul>{rival.map((x) => chip(x, 'rival'))}</ul>
        </div>
      )}
    </section>
  )
}

/** Who is out for the open team, and where their share went. */
function OutLine({ side, teamId }: { side: PregameSide; teamId: number }) {
  if (side.out.length === 0) return null
  const { share, gains } = outShare(side)
  return (
    <p className="pg-outline">
      <b>Out tonight</b>{' '}
      {side.out.map((o, i) => (
        <span key={o.player_id}>
          {i > 0 && ' '}
          {/* The comma stays with the name: a line can break right after the link. */}
          <span className="pg-keep">
            <s>
              <PlayerLink player={{ id: o.player_id, name: o.name }}>{initial(o.name)}</PlayerLink>
            </s>
            {o.owner_team_id === teamId && <span className="pg-yours"> (yours)</span>}
            {i < side.out.length - 1 && ','}
          </span>
        </span>
      ))}
      {share != null && gains.length > 0 ? (
        <>
          {' '}
          · <span className="num">{share}</span> a game to share:{' '}
          {gains.map((g, i) => (
            <span key={g.player_id}>
              {i > 0 && ' '}
              <span className="pg-keep">
                <PlayerLink player={{ id: g.player_id, name: g.full_name }}>{g.name}</PlayerLink>{' '}
                <span className="num">+{g.pts}</span>
                {i < gains.length - 1 && ','}
              </span>
            </span>
          ))}
        </>
      ) : (
        <span className="muted"> · Their absence doesn't move these lines.</span>
      )}
    </p>
  )
}

const whole = (n: number) => Math.round(n)

/** A player's row in whole numbers, and, opened, his line built step by step (one decimal). */
function PlayerRows({
  p,
  side,
  mine,
  rival,
  abbrev,
  marked,
  open,
  whyId,
  onToggle,
}: {
  p: PregamePlayer
  side: PregameSide
  mine: boolean
  rival: boolean
  abbrev: Map<number, string>
  marked: string[]
  open: boolean
  whyId: string
  onToggle: () => void
}) {
  const l = p.line
  const owner = p.owner_team_id == null ? 'FA' : (abbrev.get(p.owner_team_id) ?? '')
  const dtd = p.injury_status === 'DAY_TO_DAY' || p.injury_status === 'QUESTIONABLE'
  const pct = (made: number, att: number) => (att > 0 ? (made / att).toFixed(3).replace(/^0/, '') : '–')
  const cls = [mine && 'mine', rival && 'rival', open && 'pg-open'].filter(Boolean).join(' ') || undefined
  return (
    <>
      <tr className={cls} data-player={p.player_id}>
        <th scope="row">
          <span className="box-player pg-player">
            <PlayerLink player={{ id: p.player_id, name: p.name }} decorative>
              <PlayerHead player={{ id: p.player_id, name: p.name }} size={24} />
            </PlayerLink>
            <span className="pg-name">
              <PlayerLink player={{ id: p.player_id, name: p.name }} />
              {dtd && <span className="pg-dtd">Day-to-day</span>}
              <span className="pg-note">{rowNote(p, side)}</span>
            </span>
            <button
              type="button"
              className="pg-toggle"
              aria-expanded={open}
              aria-controls={open ? whyId : undefined}
              aria-label={`Why ${p.name}'s line`}
              onClick={onToggle}
            >
              <CaretDown size={14} weight="bold" aria-hidden="true" />
            </button>
          </span>
        </th>
        <td className="left sc-owner">
          {mine || rival ? (
            <span className="sc-owner-name">
              <span className="sc-owner-text">{owner}</span>
              {[...new Set(marked)].map((a) => (
                <span key={a} className="sc-owner-sizer" aria-hidden="true">
                  {a}
                </span>
              ))}
              <span className={`sc-owner-dot ${mine ? 'you' : 'rival'}`} aria-hidden="true" />
            </span>
          ) : (
            owner
          )}
          {mine && <span className="pg-who">You</span>}
          {rival && <span className="pg-who">Rival</span>}
        </td>
        <td className="muted">{whole(l.minutes)}</td>
        {BOX_CATS.map(({ key }) =>
          key === 'fg' || key === 'ft' ? (
            <td key={key} className="shot-cell">
              <span className="shot-split">
                <span className="shot-split-ma">{key === 'fg' ? pct(l.fgm, l.fga) : pct(l.ftm, l.fta)}</span>
                <span className="shot-split-pct">{whole(key === 'fg' ? l.fga : l.fta)} att</span>
              </span>
            </td>
          ) : (
            <td key={key}>
              {key === 'pts' ? <strong>{whole(l.pts)}</strong> : whole(key === 'tpm' ? l.three_pm : l[key])}
            </td>
          ),
        )}
      </tr>
      {open && <WhyRows p={p} id={whyId} />}
    </>
  )
}

function WhyRows({ p, id }: { p: PregamePlayer; id: string }) {
  const steps = whySteps(p.line)
  return (
    <>
      {steps.map((s, i) => (
        <tr key={`${s.kind}-${i}`} id={i === 0 ? id : undefined} className={`pg-step ${s.kind}`}>
          <th scope="row">
            <span className="pg-step-label">{s.label}</span>
          </th>
          <td />
          {WHY_COLS.map((k) => (
            <td key={k} className="num">
              {stepText(k, s.values[k], s.kind === 'reason' || s.kind === 'lean')}
            </td>
          ))}
        </tr>
      ))}
      <tr className="pg-step pg-step-note">
        <th scope="row" colSpan={12}>
          <span className="pg-step-note-text">
            One decimal here so the steps add up; the row above rounds to whole numbers.
          </span>
        </th>
      </tr>
    </>
  )
}

/** One quiet line under the table: these lines and the rest of the team against Our call. */
function TeamFoot({ side }: { side: PregameSide }) {
  const t = teamLine(side)
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="pg-foot">
      <p>
        {t.rest >= 0.5 ? (
          <>
            <span className="num">{t.listed}</span> players <span className="num">{t.shown.toFixed(1)}</span> + rest of
            team <span className="num">{t.rest.toFixed(1)}</span> = <b className="num">{t.total.toFixed(1)}</b>
          </>
        ) : (
          <>
            These <span className="num">{t.listed}</span> lines add up to <b className="num">{t.total.toFixed(1)}</b>
          </>
        )}
        <span className="pg-dot">·</span>Our call <b className="num">{t.call.toFixed(1)}</b>
        <button
          type="button"
          className="pg-gap-btn"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {Math.abs(t.gap) < 3 ? 'How it adds up' : 'Why the gap?'}
          <CaretDown size={12} weight="bold" aria-hidden="true" />
        </button>
      </p>
      <div id={id} className="pg-gap" hidden={!open}>
        {t.why.map((w) => (
          <p key={w}>{w}</p>
        ))}
      </div>
    </div>
  )
}
