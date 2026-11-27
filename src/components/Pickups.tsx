import { useState } from 'react'
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  CalendarBlank,
  CalendarX,
  CaretDown,
  CaretUp,
  HourglassMedium,
  Info,
  UserPlus,
} from '@phosphor-icons/react'
import type { AnalysisReport, PickupIdea } from '../api/client'
import { ImpactBars } from './ImpactBars'
import { InjuryBadges } from './InjuryBadges'
import { ordinal, pct, ptsDiff, signedInt } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import { PlayerChips, PlayerLink } from './PlayerCard'
import { PlayerInline } from './PlayerInline'
import { SpotDays } from './MoveTiming'
import { teamLogoUrl } from '../lib/league'
import {
  moveCopy,
  ticketSaid,
  todayCopy,
  todayGame,
  waits,
  type MoveCopy,
  type TodayCopy,
  type TodayGame,
} from '../lib/todayGame'
import { useTodayFeed, type TodaySource } from '../lib/useTodayFeed'
import { rowSaid } from '../lib/hotRun'
import { HotLine, HotStory } from './HotRun'
import { NextGameSwap } from './NextGameSwap'
import { ProLock } from './Pro'
import { useFeature } from '../lib/pro'
import './Pickups.css'

interface Props {
  pickups: PickupIdea[]
  faab: number | null | undefined
  /** Your place in the rolling waiver order, in leagues without FAAB. */
  waiverPriority?: number | null
  teams?: number
  /** This week's matchup: adds left in it. */
  week?: AnalysisReport['week']
  /** Where to read today's games from (the Scores feed). Left out, the rows show the move alone. */
  today?: TodaySource | null
}

/** The categories a pickup helps most (up to two), for the small tags on its row. */
function topCats(changes: Record<string, number>) {
  return Object.entries(changes)
    .filter(([, v]) => v >= 0.02)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([c]) => c)
}

const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i

/** The name with its injury or durability mark held to the last word, so a long name wraps
 *  between words and the mark never sits on a line of its own. */
function NameWithSignals({ player }: { player: PickupIdea['add'] }) {
  const words = player.name.split(' ')
  // "Williams III" and "Jaquez Jr." stay together: a suffix never starts a line.
  const tail = words.length > 2 && SUFFIX.test(words[words.length - 1]) ? 2 : 1
  const cut = player.name.length - words.slice(-tail).join(' ').length
  return (
    <>
      {player.name.slice(0, cut)}
      <span className="fa-name-end">
        {player.name.slice(cut)}
        <InjuryBadges players={[player]} />
      </span>
    </>
  )
}

/** Before the Scores feed answers: no game known. */
const NO_GAME: TodayGame = { state: 'none', game: null, opp: null, satOut: false, back: null, next: null }

const gain = (p: PickupIdea) => ptsDiff(p.playoff_pct_before, p.playoff_pct_after)
/** Rows shown before the list folds: the best few are the decision, the long tail is for browsing. */
const SHOW = 5

/** The opponent's logo at text size. ESPN logos can fail to load: the slot then closes up. */
function OppLogo({ abbrev }: { abbrev: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className="fa-logo"
      src={teamLogoUrl(abbrev)}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

/** Left of the slip: his game today, one line in ink ("Played today at ATL · Final"). */
function DayHalf({ c }: { c: TodayCopy | null }) {
  if (!c) {
    return (
      <span className="fa-day" data-tone="loading">
        <CalendarBlank className="fa-day-icon" size={16} aria-hidden="true" />
        <span className="fa-day-text">Checking today's games…</span>
      </span>
    )
  }
  const Icon = c.lead.startsWith('No game') || c.tone === 'bad' ? CalendarX : CalendarBlank
  return (
    <span className="fa-day" data-tone={c.tone}>
      {c.tone === 'live' ? <i className="fa-dot" /> : <Icon className="fa-day-icon" size={16} aria-hidden="true" />}
      <span className="fa-day-text">
        {c.lead}
        <span className="fa-day-rest">
          {c.opp && (
            <>
              {' '}
              {c.opp.word} <OppLogo abbrev={c.opp.abbrev} />
              <span className="fa-opp">{c.opp.abbrev}</span>
            </>
          )}
          {c.detail && <span className="fa-detail num"> · {c.detail}</span>}
        </span>
      </span>
    </span>
  )
}

/** Right of the slip: the move as a bare link to ESPN ("Claim now ↗"), its one reason under it. */
function MoveHalf({ m, href, name }: { m: MoveCopy; href: string | null; name: string }) {
  return (
    <span className="fa-move" data-move={m.kind}>
      {href ? (
        <a
          className="fa-verb"
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${m.verb} ${name} on ESPN${m.reason ? `, ${m.reason}` : ''}`}
        >
          {m.verb}
          <ArrowSquareOut size={14} aria-hidden="true" />
        </a>
      ) : (
        <span className="fa-verb">{m.verb}</span>
      )}
      {m.reason && <span className="fa-why">{m.reason}</span>}
    </span>
  )
}

export function Pickups({ pickups, faab, waiverPriority, teams, week, today }: Props) {
  const { feed, pending } = useTodayFeed(today ?? null)
  const adds = week?.adds_allowed != null ? Math.max(week.adds_allowed - week.adds_used, 0) : null
  const [open, setOpen] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const keepRow = useKeepRowInView(open)
  const showNext = useFeature('next_game')
  const shown = all ? pickups : pickups.slice(0, SHOW)
  // Most days every idea in view drops the same player from the same odds: say that once, not on every row.
  const first = shown[0]
  const sharedDrop =
    first && shown.length > 1 && shown.every((p) => !p.open_spot_by_trade && p.drop.id === first.drop.id)
      ? first.drop
      : null
  const sameStart = first && shown.every((p) => p.playoff_pct_before === first.playoff_pct_before)
  // The verb on each row opens ESPN's add page for this league (when we know the league).
  const espn = today ? `https://fantasy.espn.com/basketball/players/add?leagueId=${today.leagueId}` : null
  // Without the feed the timing still has today's date: its first day.
  const gameDate = feed?.date ?? first?.timing?.days[0]?.date ?? ''

  return (
    <section className="fa-panel pickups-panel" aria-labelledby="pickups-title">
      <h2 id="pickups-title" className="fa-title">
        <UserPlus size={20} aria-hidden="true" />
        FA Targets
      </h2>
      {(faab != null || waiverPriority != null || adds != null) && (
        <div className="fa-stats">
          {faab != null && (
            <span className="fa-stat fa-faab">
              <span className="fa-stat-v num">${faab}</span>
              <span className="fa-stat-k">FAAB left</span>
            </span>
          )}
          {faab == null && waiverPriority != null && (
            <span className="fa-stat fa-priority">
              <span className="fa-stat-v num">
                {ordinal(waiverPriority)}
                {teams ? <small> of {teams}</small> : null}
              </span>
              <span className="fa-stat-k">Waiver priority</span>
            </span>
          )}
          {adds != null && (
            <span className="fa-stat fa-adds">
              <span className="fa-stat-v num">
                {adds}
                <small> of {week?.adds_allowed}</small>
              </span>
              <span className="fa-stat-k">adds left this week</span>
            </span>
          )}
        </div>
      )}
      {pickups.length === 0 ? (
        <p className="fa-empty">
          <Info size={16} aria-hidden="true" />
          No free agent improves your team right now.
        </p>
      ) : (
        <>
          {sharedDrop && (
            <p className="pk-shared">
              <ArrowsLeftRight size={16} weight="bold" className="pk-shared-swap" aria-hidden="true" />
              <PlayerLink player={sharedDrop} decorative>
                <PlayerHead player={sharedDrop} size={24} team={sharedDrop.pro_team} />
              </PlayerLink>
              <span>
                <span className="sr-only">Each one replaces </span>
                <strong>
                  <PlayerLink player={sharedDrop} />
                </strong>
                {sameStart && <span className="pk-from num"> · from {pct(first.playoff_pct_before)}</span>}
              </span>
            </p>
          )}
          {!showNext && (
            <div className="pk-pro">
              <ProLock words="Next-game lines for these swaps" plural />
            </div>
          )}
          <ol className="fa-list" data-shared={sharedDrop ? '' : undefined} onClickCapture={keepRow}>
            {shown.map((p, i) => {
              const isOpen = open === p.add.id
              const addGame = feed ? todayGame(p.add, feed) : null
              const dropGame = feed ? todayGame(p.drop, feed) : null
              const day = addGame ? todayCopy(addGame, gameDate) : null
              const move = moveCopy(p, {
                gameDate,
                sharedDrop: !!sharedDrop,
                add: addGame ?? NO_GAME,
                drop: dropGame ?? NO_GAME,
              })
              const waiting = waits(p.timing, gameDate)
              const cats = topCats(p.category_changes)
              const run = p.add.hot_run ?? null
              const d = gain(p)
              return (
                <li key={p.add.id} id={`pickup-${i}`} className={isOpen ? 'fa-item open' : 'fa-item'}>
                  {/* The row is a box, not a button, so the name opens the player card and the verb opens
                      ESPN. The odds are the Details toggle, stretched over the rest of the row (Pickups.css). */}
                  <div className="move-row fa-row">
                    <span className="fa-rk num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="fa-face">
                      <PlayerLink player={p.add} decorative>
                        <PlayerHead player={p.add} size={44} team={p.add.pro_team} />
                      </PlayerLink>
                    </span>
                    <span className="fa-name">
                      <span className="sr-only">Add </span>
                      <PlayerLink player={p.add}>
                        <NameWithSignals player={p.add} />
                      </PlayerLink>
                    </span>
                    <span className="fa-sub">
                      <span className="fa-meta">
                        {[p.add.pro_team, p.add.positions.join('/')].filter(Boolean).join(' · ')}
                      </span>
                      {p.stream && <span className="fa-tag fa-stream">This week</span>}
                      {cats.map((c) => (
                        <span key={c} className="fa-tag">
                          {c}
                        </span>
                      ))}
                      {run && <HotLine run={run} />}
                    </span>
                    <button
                      type="button"
                      className="fa-odds"
                      aria-expanded={isOpen}
                      aria-controls={`pickup-${i}-detail`}
                      onClick={() => setOpen(isOpen ? null : p.add.id)}
                    >
                      <span className="sr-only">
                        Details. Playoff odds {pct(p.playoff_pct_before)} to {pct(p.playoff_pct_after)}
                        {move.ifMade ? `, ${move.ifMade}` : ''}
                      </span>
                      <span className="fa-after num" aria-hidden="true">
                        {pct(p.playoff_pct_after)}
                      </span>
                      <span className={`fa-delta num ${d >= 0 ? 'good' : 'bad'}`} aria-hidden="true">
                        {d !== 0 && <span className="fa-ar">{d > 0 ? '▲' : '▼'}</span>}
                        {signedInt(d)} pts
                      </span>
                      {isOpen && move.ifMade && (
                        <span className="fa-if" aria-hidden="true">
                          {move.ifMade}
                        </span>
                      )}
                    </button>
                    {(day || pending) && <DayHalf c={day} />}
                    <MoveHalf m={move} href={espn} name={p.add.name} />
                    <span className="sr-only">{day ? ticketSaid(day, move) : `${move.said}.`}</span>
                    {run && <span className="sr-only"> {rowSaid(run)}</span>}
                  </div>
                  {isOpen && (
                    <div className="move-detail fa-detail-box" id={`pickup-${i}-detail`}>
                      <div>
                        {waiting && p.timing && move.story && (
                          <div className="fa-story">
                            <p className="fa-story-say">
                              <HourglassMedium size={16} aria-hidden="true" />
                              <span>{move.story}</span>
                            </p>
                            {/* One day left (Sunday): the sentence says it all; the day grid would be one cell. */}
                            {p.timing.days.length > 1 && <SpotDays timing={p.timing} add={p.add} drop={p.drop} />}
                          </div>
                        )}
                        {/* His line next to the drop's takes the chips' place; their names still open the cards. */}
                        {p.add.next_game && showNext ? (
                          <NextGameSwap
                            add={p.add}
                            drop={p.drop}
                            byTrade={p.open_spot_by_trade}
                            live={addGame?.state === 'live'}
                          />
                        ) : (
                          <PlayerChips players={[p.add, p.drop]} label="Players in this move" />
                        )}
                        {run && <HotStory run={run} place="row" />}
                        <ul className="pk-facts" aria-label={`About ${p.add.name}`}>
                          <li>{p.add.positions.join('/')}</li>
                          <li>
                            <span className="num">{Math.round(p.add.percent_owned)}%</span> owned
                          </li>
                          <li className={p.availability === 'WAIVERS' ? 'pk-waivers' : 'pk-fa'}>
                            {p.availability === 'WAIVERS' ? 'On waivers' : 'Free agent'}
                          </li>
                        </ul>
                        <ul className="reasons">
                          {addGame?.state === 'out' && (
                            <li>
                              <PlayerInline player={p.add} /> is listed out
                              {addGame.back
                                ? `; expected back ${new Date(`${addGame.back}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`
                                : ''}
                              .{p.add.out_report ? ` ${p.add.out_report}` : ''}
                            </li>
                          )}
                          {p.availability === 'WAIVERS' && (
                            <li>
                              {move.kind === 'claim' && move.story
                                ? `${move.story} `
                                : 'A claim waits for waivers to process. '}
                              {faab == null &&
                                waiverPriority != null &&
                                `It uses your waiver priority (${ordinal(waiverPriority)}), and a successful one usually sends you to the back of the order.`}
                            </li>
                          )}
                          {p.open_spot_by_trade ? (
                            <li>
                              <PlayerInline player={p.drop} /> has trade value ({Math.round(p.drop.percent_owned)}%
                              owned), so don't release him: move him in a trade that brings back fewer players, then add{' '}
                              <PlayerInline player={p.add} tail="." />
                            </li>
                          ) : (
                            <li>
                              <ArrowsLeftRight size={14} aria-hidden="true" className="fa-swap" /> You drop{' '}
                              <PlayerLink player={p.drop} /> ({p.drop.positions.join('/')},{' '}
                              {Math.round(p.drop.percent_owned)}% owned): replaceable from free agency.
                            </li>
                          )}
                        </ul>
                      </div>
                      <ImpactBars
                        changes={p.category_changes}
                        label={
                          p.stream ? 'Your win chance per category this week' : 'Your weekly win chance per category'
                        }
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          {pickups.length > SHOW && (
            <button
              type="button"
              className="fa-more"
              aria-expanded={all}
              onClick={() => {
                // A row opened below the fold closes with it.
                if (all && open !== null && !pickups.slice(0, SHOW).some((p) => p.add.id === open)) setOpen(null)
                setAll(!all)
              }}
            >
              {all ? `Show top ${SHOW}` : `Show all ${pickups.length}`}
              {all ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
            </button>
          )}
        </>
      )}
    </section>
  )
}
