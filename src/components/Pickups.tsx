import { useState } from 'react'
import {
  ArrowsLeftRight,
  CaretDown,
  CaretUp,
  ClockCountdown,
  Coins,
  HourglassMedium,
  UserPlus,
} from '@phosphor-icons/react'
import type { AnalysisReport, PickupIdea } from '../api/client'
import { ImpactBars } from './ImpactBars'
import { Sign } from './OddsChange'
import { InjuryBadges } from './InjuryBadges'
import { ordinal, pct, ptsDiff } from '../lib/format'
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

/** Left of the slip: his game today. */
function DayHalf({ c }: { c: TodayCopy | null }) {
  if (!c) {
    return (
      <span className="fa-day" data-tone="loading">
        <span className="fa-l1">Today</span>
        <span className="fa-l2">Checking games…</span>
      </span>
    )
  }
  return (
    <span className="fa-day" data-tone={c.tone}>
      <span className="fa-l1">
        {c.tone === 'live' && <i className="fa-dot" />}
        {c.lead}
      </span>
      <span className="fa-l2">
        {c.opp && (
          <>
            {c.opp.word} <OppLogo abbrev={c.opp.abbrev} />
            <span className="fa-opp">{c.opp.abbrev}</span>
          </>
        )}
        <span className="fa-detail num">{c.detail}</span>
      </span>
    </span>
  )
}

/** Right of the slip: when to make the move, and its one reason. */
function MoveHalf({ m }: { m: MoveCopy }) {
  const Glyph = m.kind === 'wait' ? HourglassMedium : m.kind === 'claim' ? ClockCountdown : null
  return (
    <span className="fa-move" data-move={m.kind}>
      <span className="fa-l1">
        {Glyph && <Glyph className="fa-glyph" size={14} weight="bold" />}
        {m.verb}
      </span>
      {m.reason && <span className="fa-l2">{m.reason}</span>}
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
  // Without the feed the timing still has today's date: its first day.
  const gameDate = feed?.date ?? first?.timing?.days[0]?.date ?? ''

  return (
    <section className="card flush pickups-panel" aria-labelledby="pickups-title">
      <div className="card-head">
        <h2 id="pickups-title" className="fa-title">
          <UserPlus size={20} aria-hidden="true" />
          FA Targets
        </h2>
        <span className="fa-right">
          {faab != null && (
            <span className="fa-faab">
              <Coins size={16} aria-hidden="true" />
              <b className="num">${faab}</b> FAAB left
            </span>
          )}
          {faab == null && waiverPriority != null && (
            <span className="small muted">
              Waiver priority {ordinal(waiverPriority)}
              {teams ? ` of ${teams}` : ''}
            </span>
          )}
          {adds != null && (
            <span className="fa-adds">
              <b className="num">{adds}</b> of {week?.adds_allowed} adds left
            </span>
          )}
        </span>
      </div>
      {pickups.length === 0 ? (
        <p className="empty">No free agent improves your team right now.</p>
      ) : (
        <>
          {sharedDrop && (
            <p className="pk-shared">
              <PlayerLink player={sharedDrop} decorative>
                <PlayerHead player={sharedDrop} size={28} team={sharedDrop.pro_team} />
              </PlayerLink>
              <span>
                Each one replaces{' '}
                <strong>
                  <PlayerLink player={sharedDrop} />
                </strong>
              </span>
              {sameStart && <span className="pk-from num">from {pct(first.playoff_pct_before)}</span>}
            </p>
          )}
          {!showNext && (
            <div className="pk-pro">
              <ProLock words="Next-game lines for these swaps" plural />
            </div>
          )}
          <ol className="move-list" onClickCapture={keepRow}>
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
              return (
                <li key={p.add.id} id={`pickup-${i}`} className={isOpen ? 'move open' : 'move'}>
                  <button
                    type="button"
                    className="move-row pickup-row fa-row"
                    aria-expanded={isOpen}
                    aria-controls={`pickup-${i}-detail`}
                    onClick={() => setOpen(isOpen ? null : p.add.id)}
                  >
                    <PlayerHead player={p.add} size={44} team={p.add.pro_team} />
                    <span className="fa-text">
                      <span className="fa-name">
                        <span className="sr-only">Add </span>
                        <NameWithSignals player={p.add} />
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
                      </span>
                      {run && <HotLine run={run} />}
                    </span>
                    <span className="fa-pts">
                      <span className="sr-only">Playoff odds {pct(p.playoff_pct_before)} to </span>
                      {move.ifMade && <span className="sr-only">{move.ifMade}, </span>}
                      <span className="fa-pts-n num good">
                        <Sign up={gain(p) >= 0} />
                        {Math.abs(gain(p))}
                      </span>
                      <span className="fa-pts-u">
                        odds pts<span className="fa-to-comma">,</span>{' '}
                        <span className="fa-to">to {pct(p.playoff_pct_after)}</span>
                      </span>
                      {isOpen && move.ifMade && <span className="fa-if">{move.ifMade}</span>}
                    </span>
                    <span className="fa-slip" data-solo={(!day && !pending) || undefined} aria-hidden="true">
                      {(day || pending) && <DayHalf c={day} />}
                      <MoveHalf m={move} />
                    </span>
                    <span className="sr-only">{day ? ticketSaid(day, move) : `${move.said}.`}</span>
                    {run && <span className="sr-only"> {rowSaid(run)}</span>}
                  </button>
                  {isOpen && (
                    <div className="move-detail" id={`pickup-${i}-detail`}>
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
                              <PlayerLink player={p.add} /> is listed out
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
                              <PlayerLink player={p.drop} /> has trade value ({Math.round(p.drop.percent_owned)}%
                              owned), so don't release him: move him in a trade that brings back fewer players, then add{' '}
                              <PlayerInline player={p.add} face={false} tail="." />
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
