import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowsLeftRight,
  ArrowUUpLeft,
  Bandaids,
  CaretDown,
  ChartLineUp,
  Table,
  Target,
  User,
  UserPlus,
  X,
  type Icon,
} from '@phosphor-icons/react'
import type { AnalysisReport, ReportChange } from '../api/client'
import { pct } from '../lib/format'
import { teamColours } from '../lib/league'
import { lastName } from '../lib/moveTiming'
import { buildNews, type NewsItem, type NewsReason, type NewsRow, type NewsRowKind } from '../lib/newsSince'
import { percent } from '../lib/progress'
import { Delta } from './OddsChange'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { Spinner } from './Spinner'
import { TeamCrest } from './TeamCrest'
import './NewsSince.css'

export interface NewsSinceProps {
  changes: ReportChange[]
  /** The report that was on screen before this news (what the moves are compared with). */
  before?: AnalysisReport | null
  /** The report worked out with the news; leave out while it is still running. */
  after?: AnalysisReport | null
  /** True while the moves are being worked out again for this news. */
  running: boolean
  progress: number
  onDismiss: () => void
  /** Takes the reader to that part of Moves. */
  onGo?: (kind: NewsRowKind) => void
}

const ROW_ICONS: Record<NewsRowKind, Icon> = {
  best: Target,
  trades: ArrowsLeftRight,
  fa: UserPlus,
  odds: ChartLineUp,
}

function Tag({ tag }: { tag: string }) {
  return <span className={tag === 'Back' ? 'ns-tag ns-tag-back' : 'ns-tag'}>{tag}</span>
}

function Reason({ reason, colours }: { reason: NewsReason; colours: Map<number, string> }) {
  return (
    <span className="ns-reason">
      {reason.lead && <span>{reason.lead}</span>}
      {reason.team && (
        <span className="ns-team">
          <TeamCrest name={reason.team.name} colour={colours.get(reason.team.id)} size={18} />
          {reason.team.name}
        </span>
      )}
      {reason.tail && <span>{reason.tail}</span>}
      {reason.tag && <Tag tag={reason.tag} />}
    </span>
  )
}

function Row({ row, colours, onGo }: { row: NewsRow; colours: Map<number, string>; onGo?: (k: NewsRowKind) => void }) {
  const RowIcon = ROW_ICONS[row.kind]
  return (
    <li>
      <button type="button" className="ns-row" onClick={() => onGo?.(row.kind)} disabled={!onGo}>
        <span className="ns-face" aria-hidden="true">
          {row.player ? (
            <PlayerHead player={row.player} size={44} team={row.player.pro_team} />
          ) : (
            <span className="ns-face-icon">
              <RowIcon size={22} />
            </span>
          )}
        </span>
        <span className="ns-row-body">
          <span className="ns-row-top small">
            <span className="ns-label">
              <RowIcon size={14} aria-hidden="true" />
              {row.label}
            </span>
            {row.side && <span className="ns-side">{row.side}</span>}
          </span>
          <span className="ns-row-main">
            <span className="ns-row-title">{row.title}</span>
            {row.pending ? (
              <span className="ns-wait small">
                <span className="sr-only">, </span>Rechecking
              </span>
            ) : (
              row.before != null &&
              row.after != null && (
                <span className="ns-odds num">
                  <span className="sr-only">, playoff odds </span>
                  <span className="ns-odds-before">{pct(row.before)}</span>
                  <ArrowRight size={12} weight="bold" aria-label="to" />
                  <span className="ns-odds-after">{pct(row.after)}</span>
                  {row.delta != null && (
                    <span className={row.delta > 0 ? 'ns-delta good' : 'ns-delta bad'}>
                      <Delta value={row.delta} />
                      <span className="sr-only"> points</span>
                    </span>
                  )}
                </span>
              )
            )}
          </span>
          {row.reason && <Reason reason={row.reason} colours={colours} />}
        </span>
      </button>
    </li>
  )
}

/** A face with a short name under it and its tag or sign: opens the player's card. */
function Token({ item }: { item: NewsItem }) {
  return (
    <li>
      <PlayerLink player={item.player} className="ns-token">
        <span className="ns-token-face" aria-hidden="true">
          <PlayerHead player={item.player} size={44} team={item.player.pro_team} />
          {item.tag && <Tag tag={item.tag === 'Back' && item.change.text.endsWith('off IR') ? 'Off IR' : item.tag} />}
        </span>
        <span className="ns-token-name small" aria-hidden="true">
          {item.sign}
          {lastName(item.player.name)}
        </span>
        <span className="sr-only">{item.change.text}</span>
      </PlayerLink>
    </li>
  )
}

function summary(news: ReturnType<typeof buildNews>['league']) {
  const moves = news.moves.reduce((n, g) => n + g.items.length, 0)
  return [
    news.hurt.length ? `${news.hurt.length} hurt` : '',
    news.back.length ? `${news.back.length} back` : '',
    moves ? `${moves} ${moves === 1 ? 'move' : 'moves'}` : '',
  ].filter(Boolean)
}

/**
 * What the news since the last look changed in your moves: one row per part of Moves that
 * changed (a reason only where player and team ids prove it), your roster's own news on the
 * title line, and the rest of the league in one line that opens into lanes.
 */
export function NewsSince({
  changes,
  before = null,
  after = null,
  running,
  progress,
  onDismiss,
  onGo,
}: NewsSinceProps) {
  const [open, setOpen] = useState(false)
  const news = useMemo(() => buildNews(before, running ? null : after, changes), [before, after, running, changes])
  const ref = after ?? before
  const colours = useMemo(
    () =>
      ref
        ? teamColours(
            ref.season.map((r) => r.team_id),
            ref.team_id,
          )
        : new Map<number, string>(),
    [ref],
  )
  const { roster, rows, league } = news
  const counts = summary(league)
  const hasLanes = counts.length > 0
  const title = running
    ? 'Since your last look'
    : !before
      ? 'Your moves include this news'
      : rows.length === 0
        ? 'None of your moves changed'
        : rows.length === 1 && rows[0].kind === 'best'
          ? 'Your best move changed'
          : `${rows.length} of your moves changed`
  const bandFaces = [...league.hurt, ...league.back].slice(0, 3)
  const bandCrests = league.moves.slice(0, 4)

  return (
    <section className="card ns-card" aria-labelledby="ns-title" aria-busy={running}>
      <div className="ns-head">
        <h2 className="ns-title" id="ns-title">
          {title}
        </h2>
        {running ? (
          <span className="ns-status small" role="status">
            <Spinner />
            <span className="muted">Updating</span>
            <span className="tnum ns-pct">{percent(progress)}</span>
          </span>
        ) : (
          <button type="button" className="icon ns-close" aria-label="Dismiss" onClick={onDismiss}>
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {roster.length > 0 && (
        <div className="ns-roster">
          <User size={16} weight="bold" className="ns-you" aria-hidden="true" />
          <span className="sr-only">Your team: </span>
          <ul className="ns-roster-list">
            {roster.map((i) => (
              <li key={`${i.change.kind}-${i.player.id}`} className="ns-roster-item">
                <PlayerLink player={i.player} className="ns-roster-link">
                  <PlayerHead player={i.player} size={24} team={i.player.pro_team} />
                  <span aria-hidden="true">
                    {i.sign}
                    {lastName(i.player.name)}
                  </span>
                  {i.tag && <Tag tag={i.tag} />}
                  <span className="sr-only">{i.change.text}</span>
                </PlayerLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="ns-rows">
          {rows.map((r) => (
            <Row key={r.kind} row={r} colours={colours} onGo={onGo} />
          ))}
        </ul>
      )}

      {(hasLanes || league.games > 0) && (
        <div className="ns-league">
          <button
            type="button"
            className="ns-band"
            aria-expanded={hasLanes ? open : undefined}
            disabled={!hasLanes}
            onClick={() => setOpen(!open)}
          >
            {hasLanes && (
              <span className="ns-band-art" aria-hidden="true">
                {bandFaces.map((i) => (
                  <PlayerHead key={i.player.id} player={i.player} size={28} team={i.player.pro_team} />
                ))}
                {bandCrests.map((g) => (
                  <TeamCrest key={g.team.id} name={g.team.name} colour={colours.get(g.team.id)} size={22} />
                ))}
              </span>
            )}
            <span className="ns-band-text">
              <span className="ns-band-title">Around the league</span>
              <span className="ns-band-sum small">
                {counts.join(' · ')}
                {league.games > 0 && (
                  <span className={counts.length ? 'ns-band-games ns-band-extra' : 'ns-band-games'}>
                    {counts.length > 0 && ' · '}
                    {league.games} new games
                  </span>
                )}
              </span>
            </span>
            {hasLanes && <CaretDown size={16} weight="bold" className="ns-caret" aria-hidden="true" />}
          </button>

          {open && hasLanes && (
            <div className="ns-lanes">
              {league.moves.length > 0 && (
                <section className="ns-lane ns-lane-moves" aria-label="Roster moves">
                  <h3 className="ns-lane-title small">
                    <ArrowsLeftRight size={14} aria-hidden="true" />
                    Moves <span className="ns-count">{league.moves.reduce((n, g) => n + g.items.length, 0)}</span>
                  </h3>
                  {league.moves.map((g) => (
                    <div key={g.team.id} className="ns-team-row">
                      <div className="ns-team-name">
                        <TeamCrest name={g.team.name} colour={colours.get(g.team.id)} size={26} />
                        <span>
                          <span className="ns-team-title">{g.team.name}</span>
                          <span className="small muted">
                            {g.items.length} {g.items.length === 1 ? 'move' : 'moves'}
                          </span>
                        </span>
                      </div>
                      <ul className="ns-tokens">
                        {g.items.map((i) => (
                          <Token key={`${i.change.kind}-${i.player.id}`} item={i} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              )}
              {league.hurt.length > 0 && (
                <section className="ns-lane" aria-label="Hurt">
                  <h3 className="ns-lane-title small">
                    <Bandaids size={14} aria-hidden="true" />
                    Hurt <span className="ns-count">{league.hurt.length}</span>
                  </h3>
                  <ul className="ns-tokens">
                    {league.hurt.map((i) => (
                      <Token key={`h-${i.player.id}`} item={i} />
                    ))}
                  </ul>
                </section>
              )}
              {league.back.length > 0 && (
                <section className="ns-lane" aria-label="Back">
                  <h3 className="ns-lane-title small">
                    <ArrowUUpLeft size={14} aria-hidden="true" />
                    Back <span className="ns-count">{league.back.length}</span>
                  </h3>
                  <ul className="ns-tokens">
                    {league.back.map((i) => (
                      <Token key={`b-${i.player.id}`} item={i} />
                    ))}
                  </ul>
                </section>
              )}
              {league.games > 0 && (
                <section className="ns-lane ns-lane-games" aria-label="Box scores">
                  <h3 className="ns-lane-title small">
                    <Table size={14} aria-hidden="true" />
                    Box scores
                  </h3>
                  <p className="ns-games">
                    <span className="num ns-games-n">{league.games}</span>
                    <span className="small muted">player games of new stats, already in your odds</span>
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {running && (
        <span className="ns-progress" aria-hidden="true" style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
      )}
    </section>
  )
}
