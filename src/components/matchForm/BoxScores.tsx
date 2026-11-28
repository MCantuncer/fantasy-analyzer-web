import { GlobeSimple, Trophy } from '@phosphor-icons/react'
import { useId } from 'react'
import type { CSSProperties } from 'react'
import { LAST_GAMES, lastName, marginOf, nick, shortDate, signedMargin, typeTag } from '../../lib/matchForm'
import type { FormGame, Side, TeamForm } from '../../lib/matchForm'
import { teamLight } from '../../lib/nbaTeams'
import { PlayerHead, TeamLogo } from '../PlayerHead'

/** Pacers | Knicks tabs above the Game Ball (Can 2026-11-28): the team picks both the Game Ball and
 *  the Last 10 list under it, so both turn on the same tap. */
export function TeamTabs({
  away,
  home,
  side,
  onSide,
  panel,
}: {
  away: TeamForm
  home: TeamForm
  side: Side
  onSide: (s: Side) => void
  /** The id of the panel the tabs control (Game Ball + Last 10). */
  panel: string
}) {
  return (
    <div
      className="mf-tabs"
      role="tablist"
      aria-label="Team"
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
        e.preventDefault()
        const next: Side = e.key === 'Home' ? 'away' : e.key === 'End' ? 'home' : side === 'away' ? 'home' : 'away'
        onSide(next)
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-side="${next}"]`)?.focus()
      }}
    >
      {([
        ['away', away],
        ['home', home],
      ] as const).map(([s, t]) => (
        <button
          key={s}
          type="button"
          role="tab"
          data-side={s}
          className="mf-tab"
          aria-selected={side === s}
          aria-controls={panel}
          tabIndex={side === s ? 0 : -1}
          style={{ '--tl': teamLight(t.abbrev) ?? 'var(--border)' } as CSSProperties}
          onClick={() => onSide(s)}
        >
          <TeamLogo abbrev={t.abbrev} size={22} fallback />
          {nick(t.abbrev)}
          <span className="num">
            {t.wins}-{t.losses}
          </span>
        </button>
      ))}
    </div>
  )
}

/** The last ten games of the team the tabs show, newest first, as a readable list: result, where,
 *  score and margin, the kind of game, and the game's MVP with his face. */
export function BoxScores({
  team,
  games: all,
  where,
  picked,
  onPick,
}: {
  team: TeamForm
  /** The team's games in view (all, or tonight's venue), newest first. */
  games: FormGame[]
  /** " at home" / " on the road" under the venue switch, else "". */
  where: string
  /** The game on the Game Ball, and how a row puts its game there. */
  picked: number | null
  onPick: (gameId: number) => void
}) {
  const headId = useId()
  const games = all.slice(0, LAST_GAMES)
  return (
    <section className="mf-log" aria-labelledby={headId}>
      <div className="mf-blk-h">
        <h3 id={headId}>Last {LAST_GAMES}</h3>
      </div>
      {games.length ? (
        <ol className="mf-rows" aria-label={`${team.name}, last ${games.length}${where}`}>
          {games.map((g) => (
            <Row
              key={g.game_id}
              g={g}
              team={team.abbrev}
              picked={g.game_id === picked}
              onPick={() => onPick(g.game_id)}
            />
          ))}
        </ol>
      ) : (
        <p className="mf-none">No games{where} yet this season.</p>
      )}
    </section>
  )
}

function Row({ g, team, picked, onPick }: { g: FormGame; team: string; picked: boolean; onPick: () => void }) {
  const tag = typeTag(g.kind, g.note)
  const m = g.mvp
  const va = g.neutral ? 'at' : g.home ? 'vs' : '@'
  const label = [
    shortDate(g.date),
    `${g.neutral ? 'neutral site, ' : g.home ? 'vs ' : 'at '}${g.opponent_name || g.opponent}`,
    `${g.won ? 'won' : 'lost'} ${g.points}-${g.opponent_points}`,
    tag ? [tag.label, tag.detail].filter(Boolean).join(', ') : null,
    m ? `Game Ball ${m.name}, ${m.pts} points` : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <li className={picked ? 'sel' : undefined}>
      <button type="button" className="mf-row" aria-label={label} aria-pressed={picked} onClick={onPick}>
      <span className={`mf-wl ${g.won ? 'w' : 'l'}`} aria-hidden="true">
        {g.won ? 'W' : 'L'}
      </span>
      <span className="mf-r-dt" aria-hidden="true">
        {shortDate(g.date)}
        {tag && tag.variant !== 'quiet' && (
          <span className="ph">
            <TypeTag kind={tag.variant} label={tag.label} detail={tag.detail} />
          </span>
        )}
      </span>
      <span className="mf-r-opp" aria-hidden="true">
        <span className="va">{g.neutral ? <GlobeSimple size={13} /> : va}</span>
        <TeamLogo abbrev={g.opponent} size={22} fallback />
        <b>{g.opponent}</b>
        <span className="sc2 num">
          {g.points}-{g.opponent_points}
          <span className="mg">{signedMargin(marginOf(g))}</span>
        </span>
      </span>
      <span className="mf-r-sc" aria-hidden="true">
        <span className="num">
          {g.points}-{g.opponent_points}
        </span>
        <span className="mg num">{signedMargin(marginOf(g))}</span>
      </span>
      <span className="mf-r-ty" aria-hidden="true">
        {tag && <TypeTag kind={tag.variant} label={tag.label} detail={tag.detail} />}
      </span>
      <span className="mf-r-mvp" aria-hidden="true">
        {m ? (
          <>
            <PlayerHead player={{ id: m.player_id, name: m.name }} team={m.team} size={34} />
            <span className="t">
              <b>
                <span className="fn">{m.name}</span>
                <span className="ln">{lastName(m.name)}</span>
              </b>
              <span>
                {m.team === team ? '' : `${m.team} · `}
                <span className="num">{m.pts}</span> PTS
              </span>
            </span>
          </>
        ) : (
          <span className="mf-dash">–</span>
        )}
      </span>
      </button>
    </li>
  )
}

export function TypeTag({ kind, label, detail }: { kind: 'quiet' | 'cup' | 'post'; label: string; detail?: string | null }) {
  return (
    <span className={`mf-gt ${kind}`} title={detail ? `${label} · ${detail}` : undefined}>
      {kind === 'cup' && <Trophy size={13} aria-hidden="true" />}
      {label}
    </span>
  )
}
