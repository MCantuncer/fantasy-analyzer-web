import { GlobeSimple, Trophy } from '@phosphor-icons/react'
import { useId } from 'react'
import type { CSSProperties } from 'react'
import { LAST_GAMES, lastName, marginOf, nick, shortDate, signedMargin, typeTag } from '../../lib/matchForm'
import type { FormGame, Side, TeamForm } from '../../lib/matchForm'
import { teamLight } from '../../lib/nbaTeams'
import { PlayerHead, TeamLogo } from '../PlayerHead'

/** The last ten games of one team, newest first, as a readable list: result, where, score and margin,
 *  the kind of game, and the game's MVP with his face. Pacers | Knicks tabs pick the team. */
export function BoxScores({
  away,
  home,
  side,
  onSide,
  shown,
  venue,
}: {
  away: TeamForm
  home: TeamForm
  side: Side
  onSide: (s: Side) => void
  /** Each side's games in view (all, or tonight's venue), newest first. */
  shown: Record<Side, FormGame[]>
  venue: boolean
}) {
  const tabsId = useId()
  const team = side === 'away' ? away : home
  const games = shown[side].slice(0, LAST_GAMES)
  const where = venue ? (side === 'home' ? ' at home' : ' on the road') : ''
  return (
    <section className="mf-log" aria-labelledby={`${tabsId}-h`}>
      <div className="mf-blk-h">
        <h3 id={`${tabsId}-h`}>Last {LAST_GAMES}</h3>
        <p>Newest first. Game Ball: the best Game Score on the winning side.</p>
      </div>
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
            aria-controls={`${tabsId}-list`}
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
      {games.length ? (
        <ol id={`${tabsId}-list`} className="mf-rows" role="tabpanel" aria-label={`${team.name}, last ${games.length}${where}`}>
          {games.map((g) => (
            <Row key={g.game_id} g={g} team={team.abbrev} />
          ))}
        </ol>
      ) : (
        <p id={`${tabsId}-list`} className="mf-none" role="tabpanel">
          No games{where} yet this season.
        </p>
      )}
    </section>
  )
}

function Row({ g, team }: { g: FormGame; team: string }) {
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
    <li className="mf-row" aria-label={label}>
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
