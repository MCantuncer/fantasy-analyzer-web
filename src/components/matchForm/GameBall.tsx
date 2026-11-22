import { ArrowCounterClockwise, CaretLeft, CaretRight, Medal } from '@phosphor-icons/react'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { headshotUrl } from '../../lib/league'
import { HERO_LIGHT, dayDate, losersBest, nick, possessive, shootingPct, typeTag } from '../../lib/matchForm'
import type { FormGame, FormStar } from '../../lib/matchForm'
import { teamLight } from '../../lib/nbaTeams'
import { PlayerHead, TeamLogo } from '../PlayerHead'
import { TypeTag } from './BoxScores'

/** The Game Ball (Can 2026-11-22, "MVP of the match with his photo and stats"): the best Game Score on
 *  the winning side, face first, with his full line and the losing side's best under it. */
export function GameBall({
  team,
  other,
  game,
  picked,
  backLabel,
  onBack,
  onEarlier,
  onLater,
}: {
  /** The club whose list the game came from, and the other club tonight. */
  team: string
  other: string
  game: FormGame
  picked: boolean
  backLabel: string
  onBack: () => void
  onEarlier: (() => void) | null
  onLater: (() => void) | null
}) {
  const s = game.mvp
  const meeting = game.opponent === other
  const where = game.neutral ? 'vs' : game.home ? 'vs' : 'at'
  const kicker = meeting ? 'Last Meeting' : `${nick(team)} ${where} ${nick(game.opponent)}`
  const away = game.home ? game.opponent : team
  const home = game.home ? team : game.opponent
  const awayPts = game.home ? game.opponent_points : game.points
  const homePts = game.home ? game.points : game.opponent_points
  const tag = typeTag(game.kind, game.note)
  const lb = losersBest(game)
  const loser = game.won ? game.opponent : team
  const nav = (
    <>
      <button type="button" className="mf-nav" onClick={onEarlier ?? undefined} disabled={!onEarlier}>
        <CaretLeft size={15} weight="bold" aria-hidden="true" />
        Earlier
      </button>
      <button type="button" className="mf-nav" onClick={onLater ?? undefined} disabled={!onLater}>
        Later
        <CaretRight size={15} weight="bold" aria-hidden="true" />
      </button>
    </>
  )
  return (
    <section className="mf-gb" aria-label="Game Ball" aria-live="polite">
      <div className="mf-gb-top">
        <span className="mf-gb-kick">
          <Medal size={16} aria-hidden="true" />
          Game Ball · {kicker}
        </span>
        <span className="mf-gb-nav">{nav}</span>
      </div>
      {s ? (
        <div className="mf-gb-body" key={game.game_id}>
          <HeroFace star={s} />
          <div className="mf-gb-id">
            <p className="mf-gb-name">{s.name}</p>
            <span className="mf-gb-who">
              <b>{nick(s.team)}</b> · Game Score <span className="num">{s.game_score.toFixed(1)}</span>
            </span>
          </div>
          <div className="mf-gb-score">
            <span className="sc" aria-label={`${away} ${awayPts} at ${home} ${homePts}`}>
              <TeamLogo abbrev={away} size={22} fallback />
              <span className="ab">{away}</span>
              <b className={`num${awayPts > homePts ? ' w' : ''}`}>{awayPts}</b>
              <span className="at">@</span>
              <b className={`num${homePts > awayPts ? ' w' : ''}`}>{homePts}</b>
              <span className="ab">{home}</span>
              <TeamLogo abbrev={home} size={22} fallback />
            </span>
            <span>Final · {dayDate(game.date)}</span>
            {tag && <TypeTag kind={tag.variant} label={tag.label} detail={tag.detail} />}
          </div>
          <StatLine s={s} />
        </div>
      ) : (
        <p className="mf-none">No box score for this game.</p>
      )}
      <div className="mf-gb-other">
        {lb && (
          <>
            <PlayerHead player={{ id: lb.player_id, name: lb.name }} team={lb.team} size={34} />
            <span className="ot">
              {possessive(nick(loser))} best: <b>{lb.name}</b>{' '}
              <span className="nw">
                · <span className="num">{lb.reb}</span> REB
              </span>{' '}
              <span className="nw">
                · <span className="num">{lb.ast}</span> AST
              </span>{' '}
              <span className="nw">
                · <span className="num">{lb.pts}</span> PTS
              </span>
            </span>
          </>
        )}
        {picked && (
          <button type="button" className="mf-back" onClick={onBack}>
            <ArrowCounterClockwise size={15} aria-hidden="true" />
            {backLabel}
          </button>
        )}
      </div>
      <div className="mf-gb-nav-ph">{nav}</div>
    </section>
  )
}

/** The 184px face (112px on phones). The photo is clipped to the tile, above its 3px team edge;
 *  the club logo sits on the corner. */
function HeroFace({ star }: { star: FormStar }) {
  const [failed, setFailed] = useState(false)
  const light = HERO_LIGHT[star.team] ?? teamLight(star.team) ?? 'var(--track)'
  return (
    <span className="mf-gb-face" style={{ '--tc': light } as CSSProperties} aria-hidden="true">
      <span className="ph">
        {star.player_id > 0 && !failed ? (
        <img
          src={headshotUrl(star.player_id)}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg className="sil" viewBox="4 6 32 34" preserveAspectRatio="xMidYMax meet">
          <circle cx="20" cy="14.6" r="7.6" />
          <path d="M4.2 41c0-8.8 7-14.2 15.8-14.2S35.8 32.2 35.8 41z" />
        </svg>
        )}
      </span>
      <span className="lg">
        <TeamLogo abbrev={star.team} size={30} fallback />
      </span>
    </span>
  )
}

/** MIN FG FT 3PM REB AST STL BLK TO PTS, the house order, PTS last and biggest. */
function StatLine({ s }: { s: FormStar }) {
  const cells: [string, ReactNode, string?][] = [
    ['MIN', s.minutes],
    ['FG', <>{s.fgm}/{s.fga}<small>{shootingPct(s.fgm, s.fga)}</small></>, 'pair'],
    ['FT', <>{s.ftm}/{s.fta}<small>{shootingPct(s.ftm, s.fta)}</small></>, 'pair'],
    ['3PM', s.tpm],
    ['REB', s.reb],
    ['AST', s.ast],
    ['STL', s.stl],
    ['BLK', s.blk],
    ['TO', s.to],
    ['PTS', s.pts, 'pts'],
  ]
  return (
    <dl className="mf-stats">
      {cells.map(([k, v, cls]) => (
        <div key={k} className={`mf-stat${cls ? ` ${cls}` : ''}`}>
          <dt>{k}</dt>
          <dd className="num">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
