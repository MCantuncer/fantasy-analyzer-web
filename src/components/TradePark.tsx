import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowClockwise,
  ArrowDown,
  ArrowRight,
  CaretDown,
  CaretUp,
  Coins,
  Lock,
  Plus,
  Target,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchShop, type AnalysisReport, type PlayerRef, type ShopDeal, type ShopReport, type ShopTeam } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { ordinal, pct, ptsDiff, signed, signedInt, tradeKey } from '../lib/format'
import { injuryShort } from '../lib/injury'
import { HeadStack, PlayerHead } from './PlayerHead'
import { AcceptChance } from './AcceptChance'
import { teamColours } from '../lib/league'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { EMPTY_DEAL, type CheckDeal } from '../lib/tradeCheck'
import {
  dashRecord,
  dealMatches,
  lastName,
  oddsToday,
  shopMarket,
  teamLows,
  wantedCategories,
  type DealFilter,
} from '../lib/tradeTable'
import { CatStrip } from './CatStrip'
import { MaybeHandshake } from './MaybeHandshake'
import { PlayerLink } from './PlayerCard'
import { PlayerInline, PlayerList } from './PlayerInline'
import { TeamCrest } from './TeamCrest'
import { EndLabel, OddsPlate, TheirSide, TradeTable, Wants } from './TradeTable'
import './TradePark.css'
import { shortValue, useRoundValues, valueTitle } from '../lib/tradeValue'

export const MAX_PICKS = 4

// Picking runs the search once the picks have stayed the same this long.
const SETTLE_MS = 700

// The sticky top bar and tab row: putting a deal on the table scrolls back under them.
const TOP_OFFSET = 128

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
  /** The players picked to shop, in the order picked (kept across tab switches). */
  picks: number[]
  onPicks: (ids: number[]) => void
  /** Opens Check a Trade filled in with a deal. */
  onCheck: (deal: CheckDeal) => void
}

function byId(ids: number[]) {
  return [...ids].sort((a, b) => a - b)
}

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

function lastNames(players: { name: string }[]) {
  return players.map((p) => lastName(p.name)).join(' + ')
}

/** The same "Allen + Mobley", each last name opening that player's card. */
function LastNames({ players, tail }: { players: PlayerRef[]; tail?: string }) {
  return <PlayerList players={players} sep=" + " name={(p) => lastName(p.name)} face={false} tail={tail} />
}

/** "15-21-0" -> 15 wins, for the Every team order. */
function wins(record: string) {
  return Number.parseInt(record, 10) || 0
}

/**
 * Trade Park: the trading table seen from your end. Your whole roster sits in the lit give end,
 * and picking a player runs the search (once the picks settle). Before a pick the get end shows
 * what your build wants back and where every team is low. On phones the roster folds into a rail
 * of picked faces when the first result lands, once; Add opens it again.
 */
export function TradePark({ report, keep, creds, picks, onPicks, onCheck }: Props) {
  const rounds = useRoundValues()
  const colours = teamColours(
    report.season.map((r) => r.team_id),
    report.team_id,
  )
  // A keeper can't be shopped, even one picked before it was kept.
  const shopping = picks.filter((id) => !keep.includes(id))
  const settled = useDebouncedValue(shopping, SETTLE_MS)
  const ids = useMemo(() => byId(settled), [settled])
  const shop = useQuery({
    queryKey: ['shop', report.league.id, report.league.season, report.team_id, ids, byId(keep), creds?.swid ?? null],
    queryFn: ({ signal }) => fetchShop(report.league.id, report.team_id, report.league.season, ids, keep, creds, signal),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 5 * 60_000,
  })

  // Phones: the roster folds into the rail once, when the first result lands; Add opens it again.
  const [folded, setFolded] = useState(false)
  const [hasFolded, setHasFolded] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const firstResult = shop.data != null && !shop.isPlaceholderData && ids.length > 0
  useEffect(() => {
    if (!firstResult || hasFolded) return
    const toggle = document.activeElement?.closest<HTMLElement>('[data-pick]')
    setHasFolded(true)
    setFolded(true)
    // Focus follows the player from his toggle to his chip, so it never falls to the page.
    if (toggle)
      requestAnimationFrame(() => {
        const rail = railRef.current
        const chip = rail?.querySelector<HTMLElement>(`[data-chip="${toggle.dataset.pick}"]`)
        ;(chip ?? rail?.querySelector<HTMLElement>('.park-add'))?.focus()
      })
  }, [firstResult, hasFolded])

  const toggle = (id: number) =>
    onPicks(
      picks.includes(id) ? picks.filter((p) => p !== id) : shopping.length < MAX_PICKS ? [...shopping, id] : picks,
    )

  const today = oddsToday(report.season, report.team_id)
  const wants = wantedCategories(report.categories)
  const pickedPlayers = shopping
    .map((id) => report.roster.find((p) => p.id === id))
    .filter((p): p is (typeof report.roster)[number] => p != null)
  const full = shopping.length >= MAX_PICKS

  // The last result that landed, so a failed update leaves it on screen.
  const [last, setLast] = useState<ShopReport | null>(null)
  if (shop.data && !shop.isPlaceholderData && shop.data !== last) setLast(shop.data)

  // What the table is doing: nothing picked, waiting for the picks to settle or the first answer,
  // updating a result on screen, showing one, or failing (with or without a result to keep).
  const failed = shopping.length > 0 && ids.length > 0 && shop.isError
  const held = failed && last && last.offered.some((p) => shopping.includes(p.id)) ? last : undefined
  const data = shopping.length > 0 && ids.length > 0 ? (shop.data ?? held) : undefined
  const shown = data ? data.offered.map((p) => p.id) : []
  const current = data != null && sameSet(shown, shopping) && !shop.isPlaceholderData
  const finding = shopping.length > 0 && !data && !failed
  const updating = data != null && !current && !failed
  const status = finding ? 'Finding deals' : updating ? 'Updating' : null
  const who = lastNames(pickedPlayers)
  const whoLinks = <LastNames players={pickedPlayers} />

  // The deal on the table: the best one, until a row below the table puts another there.
  const market = useMemo(() => (data ? shopMarket(data) : null), [data])
  const [chosen, setChosen] = useState<{ data: ShopReport; key: string } | null>(null)
  const deal =
    (market && chosen && chosen.data === data && market.deals.find((d) => tradeKey(d) === chosen.key)) ||
    market?.deals[0] ||
    null
  const dealIndex = deal && market ? market.deals.indexOf(deal) : -1
  const inDeal = new Set(deal?.give.map((p) => p.id) ?? [])
  const tableRef = useRef<HTMLDivElement>(null)
  const putOnTable = (d: ShopDeal) => {
    if (data) setChosen({ data, key: tradeKey(d) })
    const el = tableRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - TOP_OFFSET
    if (window.scrollY > top) window.scrollTo({ top })
  }

  // No deal: open the roster again and take focus to the first player you can still pick.
  const addPlayer = () => {
    setFolded(false)
    requestAnimationFrame(() =>
      tableRef.current?.querySelector<HTMLElement>('.park-tog[aria-pressed="false"]:not([aria-disabled])')?.focus(),
    )
  }
  const checkDeal = (d: ShopDeal) =>
    onCheck({
      partner: d.partner_team_id,
      give: d.give.map((p) => p.id),
      get: d.get.map((p) => p.id),
      mode: 'sending',
      cut: d.my_drop?.id ?? null,
    })

  const teams = report.builds
    .filter((b) => b.team_id !== report.team_id)
    .map((b) => {
      const row = report.season.find((r) => r.team_id === b.team_id)
      return { build: b, record: row?.current_record ?? '', lows: teamLows(b, report.season.length || 10) }
    })
    .sort((a, b) => wins(b.record) - wins(a.record))

  const roster = (
    <div className="park-roster">
      <div className="tt-list-head">
        <span className="tt-label">Your roster · {report.roster.length}</span>
        <span className="tt-label">Trade value</span>
      </div>
      <ul className="park-rows">
        {report.roster.map((p) => {
          const keeper = keep.includes(p.id)
          const n = shopping.indexOf(p.id)
          const on = n >= 0
          const off = !on && full
          const out = p.injury_status !== 'ACTIVE' ? injuryShort(p.injury_status) : null
          const goes = inDeal.has(p.id)
          return (
            <li key={p.id} className={['park-row', on && 'park-on', goes && 'park-in'].filter(Boolean).join(' ')}>
              <span className={on ? 'park-face park-you' : 'park-face'}>
                <PlayerHead player={p} size={40} team={p.pro_team} />
              </span>
              <span className="park-who">
                <span className="park-nm">
                  <PlayerLink player={p} />
                </span>
                <span className="park-mt">
                  {p.positions.join(', ')} · {p.pro_team}
                  {out && <span className="tt-tag tt-out">{out}</span>}
                  {keeper ? (
                    <span className="tt-status">
                      <Lock size={14} aria-hidden="true" />
                      Keeper
                    </span>
                  ) : (
                    p.tier === 'droppable' && (
                      <span className="tt-status">
                        <ArrowDown size={14} aria-hidden="true" />
                        Droppable
                      </span>
                    )
                  )}
                  {goes && (
                    <span className="park-goes">
                      In this deal
                      <ArrowRight size={12} aria-hidden="true" />
                    </span>
                  )}
                </span>
              </span>
              <span className="park-val num" title={valueTitle(rounds)}>
                {shortValue(p.perceived_value, rounds)}
              </span>
              {keeper ? (
                <span className="park-tog park-lock" title="Kept: change in My Team">
                  <Lock size={18} aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="park-tog"
                  data-pick={p.id}
                  aria-pressed={on}
                  aria-disabled={off || undefined}
                  aria-label={`Shop ${p.name}`}
                  title={off ? `Up to ${MAX_PICKS} players` : undefined}
                  onClick={() => {
                    if (!off) toggle(p.id)
                  }}
                >
                  <span className="park-ring num">{on ? n + 1 : <Plus size={18} aria-hidden="true" />}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  const rail = hasFolded && pickedPlayers.length > 0 && (
    <div className="park-rail" ref={railRef}>
      {pickedPlayers.map((p) => (
        <span key={p.id} className="park-chip">
          <PlayerLink player={p} decorative>
            <span className="park-face park-you">
              <PlayerHead player={p} size={32} team={p.pro_team} />
            </span>
          </PlayerLink>
          <PlayerLink player={p}>{lastName(p.name)}</PlayerLink>
          <button
            type="button"
            className="park-chip-x"
            data-chip={p.id}
            aria-label={`Stop shopping ${p.name}`}
            onClick={() => toggle(p.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="park-chip park-add"
        aria-expanded={!folded}
        onClick={() => setFolded(!folded)}
      >
        {folded ? <Plus size={16} aria-hidden="true" /> : <CaretUp size={16} aria-hidden="true" />}
        {folded ? 'Add' : 'Done'}
      </button>
    </div>
  )

  const announce =
    data && current
      ? deal
        ? `${dealIndex === 0 ? 'Best deal' : 'On the table'}: ${lastNames(deal.give)} for ${lastNames(deal.get)}, odds ${Math.round(deal.playoff_pct_before * 100)} to ${Math.round(deal.playoff_pct_after * 100)}`
        : `No deal for ${lastNames(data.offered)}`
      : failed && !data
        ? `Couldn't search trades for ${who}`
        : undefined

  let odds: ReactNode = null
  if (deal)
    odds = (
      <OddsPlate
        label="Playoffs"
        value={deal.playoff_pct_after}
        from={deal.playoff_pct_before}
        them={
          deal.partner_playoff_pct_before != null && deal.partner_playoff_pct_after != null
            ? { before: deal.partner_playoff_pct_before, after: deal.partner_playoff_pct_after }
            : null
        }
        status={status}
      />
    )
  else if (data) odds = <OddsPlate label="Playoffs" value={data.playoff_pct_before} sub="no deal yet" status={status} />
  else if (today)
    odds = (
      <OddsPlate
        label="Playoffs"
        value={today.pct}
        sub={shopping.length ? 'today' : `today · ${ordinal(today.rank)} best of ${today.teams}`}
        status={status}
      />
    )

  // "Aimed at AST 41% · REB 64% · BLK 72% weekly win": in the foot, or under the rail on phones.
  const aim = data && data.targets.length > 0 && (
    <>
      <Target size={16} aria-hidden="true" />
      <span>
        Aimed at{' '}
        {data.targets.map((t, i) => (
          <span key={t.category}>
            {i > 0 && ' · '}
            <b>{t.category}</b> <span className="num">{pct(t.win_pct)}</span>
          </span>
        ))}{' '}
        weekly win
      </span>
    </>
  )
  const faab =
    data && data.faab_remaining != null && (deal?.faab || data.faab_cap > 0) ? (
      <p className="park-line">
        <Coins size={16} aria-hidden="true" />
        <span>
          {deal && deal.faab > 0 ? (
            <>
              This deal adds <b className="num">${deal.faab}</b> of your <b className="num">${data.faab_remaining}</b>{' '}
              FAAB. It never comes back.
            </>
          ) : (
            <>
              Up to <b className="num">${data.faab_cap}</b> of your <b className="num">${data.faab_remaining}</b> FAAB can
              sweeten a deal
            </>
          )}
        </span>
      </p>
    ) : null

  // Their end: the deal, the honest empty, the error, or skeletons at the final height.
  let get: ReactNode
  if (shopping.length === 0) {
    get = (
      <>
        <EndLabel end="get" />
        {wants.length > 0 && (
          <div>
            <div className="tt-label park-block-h">What your build wants back</div>
            <Wants wants={wants} />
          </div>
        )}
        <div>
          <div className="tt-list-head">
            <span className="tt-label">Every team</span>
            <span className="tt-label">Low in</span>
          </div>
          <ul className="park-teams">
            {teams.map(({ build, record, lows }) => (
              <li key={build.team_id} className="park-team">
                <TeamCrest name={build.team_name} colour={colours.get(build.team_id)} size={32} />
                <span className="park-who">
                  <span className="park-tn">{build.team_name}</span>
                  {record && record !== '0-0-0' && <span className="park-rec num">{dashRecord(record)}</span>}
                </span>
                <span className="park-lows">
                  {lows.map((c) => (
                    <span key={c} className="tt-tag">
                      {c}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </>
    )
  } else if (!data && failed) {
    get = (
      <>
        <EndLabel end="get" />
        <div className="park-block tt-fade">
          <span className="park-block-h2">
            <WarningCircle size={18} aria-hidden="true" />
            Couldn't search trades
          </span>
          <p>{shop.error?.message}</p>
          <div className="tt-actions">
            <button type="button" className="tt-btn" onClick={() => shop.refetch()}>
              <ArrowClockwise size={18} aria-hidden="true" />
              Try Again
            </button>
          </div>
        </div>
      </>
    )
  } else if (!data) {
    get = (
      <>
        <EndLabel end="get" />
        <p className="park-note">
          Checking {teams.length} rosters for {whoLinks}
        </p>
        <div className="park-loading" aria-hidden="true">
          <span className="tt-skel" style={{ height: 48, width: '60%' }} />
          <span className="tt-skel" style={{ height: 64 }} />
          <span className="tt-skel" style={{ height: 136 }} />
          <span className="tt-skel" style={{ height: 160 }} />
        </div>
      </>
    )
  } else {
    const working = updating ? (
      <p className="park-note">
        Showing <LastNames players={data.offered} /> · updating for {whoLinks}
      </p>
    ) : failed ? (
      <div className="park-err" role="alert">
        <WarningCircle size={18} aria-hidden="true" />
        <span>
          Couldn't update for <LastNames players={pickedPlayers} tail="." /> {shop.error?.message}
        </span>
        <button type="button" className="tt-btn" onClick={() => shop.refetch()}>
          <ArrowClockwise size={18} aria-hidden="true" />
          Try Again
        </button>
      </div>
    ) : null
    const partnerTeam = deal ? data.teams.find((t) => t.team_id === deal.partner_team_id) : undefined
    get = deal ? (
      <>
        <EndLabel end="get">
          <AcceptChance p={deal.acceptance} className="park-accept" />
        </EndLabel>
        {working}
        <div className="park-get tt-fade" key={tradeKey(deal)}>
          <div className="park-partner">
            <TeamCrest name={deal.partner_team_name} colour={colours.get(deal.partner_team_id)} size={32} />
            <div>
              <div className="park-partner-nm">{deal.partner_team_name}</div>
              <div className="park-partner-mt num">
                {[
                  partnerTeam && partnerTeam.record !== '0-0-0' ? dashRecord(partnerTeam.record) : null,
                  `${dealIndex === 0 ? 'best deal' : 'deal'}, ${dealIndex + 1} of ${market!.deals.length}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
          {deal.get.map((p) => (
            <PlayerCardRow key={p.id} player={p} size={64} />
          ))}
          <DealNotes deal={deal} />
          <TheirSide
            partner={deal.partner_team_name}
            pitch={deal.pitch}
            needs={deal.pitch_needs}
            teams={report.season.length || undefined}
            valueGet={deal.value_they_get}
            valueGive={deal.value_they_give}
            theirCats={deal.their_cats_gain}
            rounds={rounds}
            actions={
              <button type="button" className="tt-btn" onClick={() => checkDeal(deal)}>
                <MaybeHandshake size={18} />
                Check This Trade
              </button>
            }
          />
        </div>
      </>
    ) : (
      <>
        <EndLabel end="get" />
        {working}
        <div className="park-block tt-fade">
          <span className="park-block-h2">
            No deal for <LastNames players={data.offered} />
          </span>
          <p>All {data.teams.length} rosters checked. None looks like a win for them and helps you.</p>
          <div className="tt-actions">
            {!full && (
              <button type="button" className="tt-btn" onClick={addPlayer}>
                <Plus size={18} aria-hidden="true" />
                Add a Player
              </button>
            )}
            <button type="button" className="tt-btn" onClick={() => onCheck(EMPTY_DEAL)}>
              <MaybeHandshake size={18} />
              Check a Trade
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={folded ? 'park-page park-folded' : 'park-page'}>
      <div ref={tableRef}>
        <TradeTable
          label={shopping.length ? `Shopping ${who}` : 'Trade Park'}
          lit="give"
          oddsFirst={shopping.length === 0}
          busy={updating || finding}
          announce={announce}
          odds={odds}
          give={
            <>
              <EndLabel end="give">
                <span className="tt-label">
                  {shopping.length === 0 ? (
                    `Pick up to ${MAX_PICKS}`
                  ) : (
                    <>
                      <span className="park-who-label">{whoLinks} · </span>
                      {shopping.length} of {MAX_PICKS}
                    </>
                  )}
                </span>
              </EndLabel>
              {rail}
              {deal && (
                <div className="park-give-deal">
                  {aim && <p className="park-line park-aim-rail">{aim}</p>}
                  <div className="park-give-cards">
                    {deal.give.map((p) => (
                      <PlayerCardRow key={p.id} player={p} size={56} />
                    ))}
                  </div>
                </div>
              )}
              {roster}
            </>
          }
          get={get}
          foot={
            deal && (
              <div className="park-foot">
                <div className="park-foot-give">
                  <CatStrip
                    changes={deal.category_changes}
                    categories={report.league.categories.length ? report.league.categories : undefined}
                    title="Your weekly win chance"
                    summary={
                      <>
                        <span className={`num park-sum ${deal.my_cats_gain > 0 ? 'good' : deal.my_cats_gain < 0 ? 'bad' : ''}`}>
                          {signed(deal.my_cats_gain)}
                        </span>{' '}
                        categories won a week
                      </>
                    }
                  />
                </div>
                <div className="park-foot-mid" aria-hidden="true" />
                <div className="park-foot-get">
                  {aim && <p className="park-line park-aim-foot">{aim}</p>}
                  {faab}
                </div>
              </div>
            )
          }
        />
      </div>

      {market && (
        <EveryTeam
          data={data!}
          market={market}
          onTable={deal}
          colours={colours}
          onPick={putOnTable}
        />
      )}
    </div>
  )
}

/** A player in the deal as a card: face, name, position · club · trade value, and an injury word. */
function PlayerCardRow({ player: p, size }: { player: PlayerRef; size: number }) {
  const rounds = useRoundValues()
  const out = p.injury_status !== 'ACTIVE' ? injuryShort(p.injury_status) : null
  return (
    <div className="park-card">
      <PlayerHead player={p} size={size} team={p.pro_team} />
      <div className="park-card-text">
        <div className="park-card-nm">
          <PlayerLink player={p} />
        </div>
        <div className="park-card-mt">
          {p.positions.join('/')} · {p.pro_team} ·{' '}
          <b className="num" title={valueTitle(rounds)}>
            {shortValue(p.perceived_value, rounds)}
          </b>{' '}
          trade value
          {out && <span className="tt-tag tt-out">{out}</span>}
        </div>
      </div>
    </div>
  )
}

/** The moves around the deal: your cut, a free agent to add, their likely cut, and any caveat. */
function DealNotes({ deal: d }: { deal: ShopDeal }) {
  const notes: ReactNode[] = []
  if (d.my_drop)
    notes.push(
      <>
        You drop <PlayerInline player={d.my_drop} /> to make room.
      </>,
    )
  if (d.my_add)
    notes.push(
      <>
        You send more than you get back: pick up <PlayerInline player={d.my_add} /> from free agency. The odds include
        him.
      </>,
    )
  if (d.their_drop)
    notes.push(
      <>
        They would likely drop <PlayerInline player={d.their_drop} tail="." />
      </>,
    )
  for (const w of d.warnings ?? []) notes.push(w)
  if (!notes.length) return null
  return (
    <ul className="park-notes">
      {notes.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
  )
}

/** "▲ +2 pts": a sign and an arrow, never colour alone. Up is the helps-you blue; down is an orange
 * arrow beside an ink figure. */
function Delta({ before, after }: { before: number; after: number }) {
  const diff = ptsDiff(before, after)
  return (
    <span className={`park-delta num ${diff > 0 ? 'park-delta-up' : diff < 0 ? 'park-delta-down' : ''}`}>
      {diff !== 0 && (
        <span className="park-delta-ar" aria-hidden="true">
          {diff > 0 ? '▲' : '▼'}
        </span>
      )}
      {signedInt(diff)} pts
    </span>
  )
}

function sideName(players: PlayerRef[]) {
  return players.length === 1 ? players[0].name : lastNames(players)
}

function sideMeta(players: PlayerRef[]) {
  return players.length === 1 ? `${players[0].positions.join(', ')} · ${players[0].pro_team}` : `${players.length} players`
}

interface EveryTeamProps {
  data: ShopReport
  market: NonNullable<ReturnType<typeof shopMarket>>
  onTable: ShopDeal | null
  colours: Map<number, string>
  onPick: (d: ShopDeal) => void
}

/**
 * Every team under the table, in the table's own three columns: each deal that holds up as a row
 * you can put on the table, the teams whose deals pass the checks but give you no lift, and one
 * fold row for the teams with nothing.
 */
function EveryTeam({ data, market, onTable, colours, onPick }: EveryTeamProps) {
  const [filter, setFilter] = useState<DealFilter>('all')
  const [open, setOpen] = useState(false)
  const offered = data.offered
  // A player filter outlives a new result only while that player is still offered.
  const f: DealFilter = typeof filter === 'number' && !offered.some((p) => p.id === filter) ? 'all' : filter
  const rows = market.deals.filter((d) => dealMatches(d, f))
  const many = offered.length > 1 && market.deals.length > 0
  const count = (x: DealFilter) => market.deals.filter((d) => dealMatches(d, x)).length
  const options: [DealFilter, string][] = many
    ? [
        ['all', 'All'],
        ['every', offered.length === 2 ? 'Both Go' : `All ${offered.length} Go`],
        ...offered.map<[DealFilter, string]>((p) => [p.id, lastName(p.name)]),
      ]
    : []
  const onTableKey = onTable ? tradeKey(onTable) : null

  return (
    <section className="park-market" aria-labelledby="park-every">
      <div className="park-market-h">
        <h2 id="park-every">Every team</h2>
        {many && (
          <div className="park-filter" role="group" aria-label="Show deals with">
            {options.map(([x, label]) => (
              <button key={String(x)} type="button" aria-pressed={f === x} onClick={() => setFilter(x)}>
                {label}
                <span className="park-filter-n num">{count(x)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="park-drows">
        {rows.map((d) => {
          const key = tradeKey(d)
          return (
            <li key={key}>
              <DealRow deal={d} on={key === onTableKey} onPick={() => onPick(d)} />
            </li>
          )
        })}
        {market.deals.length > 0 && rows.length === 0 && (
          <li className="park-dnone">No deal in this group. Pick another filter.</li>
        )}
        {market.noLift.map((t) => (
          <li key={t.team_id} className="park-drow park-dim">
            <span className="park-dg">
              <span className="head-stack">
                {offered.slice(0, 3).map((p) => (
                  <PlayerLink key={p.id} player={p} decorative>
                    <PlayerHead player={p} size={40} team={p.pro_team} />
                  </PlayerLink>
                ))}
              </span>
              <span className="park-dwho">
                <span className="park-dnm">
                  <PlayerList players={offered} sep=" or " name={(p) => lastName(p.name)} face={false} />
                </span>
                <span className="park-dmt num">
                  {t.deals_found} {t.deals_found === 1 ? 'deal passes' : 'deals pass'} the checks
                </span>
              </span>
            </span>
            <span className="park-dm">
              <span className="park-do num">{pct(data.playoff_pct_before)}</span>
              <span className="park-dmt">no lift for you</span>
            </span>
            <span className="park-dt">
              <TeamLine team={t} colour={colours.get(t.team_id)} />
            </span>
          </li>
        ))}
      </ul>
      {market.none.length > 0 && (
        <FoldRow teams={market.none} colours={colours} open={open} onToggle={() => setOpen(!open)} />
      )}
    </section>
  )
}

function TeamLine({ team: t, colour }: { team: ShopTeam; colour: string | undefined }) {
  return (
    <span className="park-dg">
      <TeamCrest name={t.team_name} colour={colour} size={32} />
      <span className="park-dwho">
        <span className="park-dnm">{t.team_name}</span>
        {t.record !== '0-0-0' && <span className="park-dmt num">{dashRecord(t.record)}</span>}
      </span>
    </span>
  )
}

/** One deal under the table: give | odds after | get, their team and the accept chance. A button. */
function DealRow({ deal: d, on, onPick }: { deal: ShopDeal; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className="park-drow" aria-current={on || undefined} onClick={onPick}>
      <span className="park-dg">
        <HeadStack players={d.give} size={40} />
        <span className="park-dwho">
          <span className="park-dnm">{sideName(d.give)}</span>
          <span className="park-dmt">
            {sideMeta(d.give)}
            {d.faab > 0 && ` + $${d.faab} FAAB`}
          </span>
        </span>
      </span>
      <span className="park-dm">
        <span className="sr-only">, your playoff odds </span>
        <span className="park-do num">{pct(d.playoff_pct_after)}</span>
        <Delta before={d.playoff_pct_before} after={d.playoff_pct_after} />
      </span>
      <span className="park-dt">
        <span className="park-dg">
          <span className="sr-only">, for </span>
          <HeadStack players={d.get} size={40} />
          <span className="park-dwho">
            <span className="park-dnm">{sideName(d.get)}</span>
            <span className="park-dmt">
              {d.partner_team_name}
              {on && (
                <>
                  {' · '}
                  <span className="park-ontable">On the table</span>
                </>
              )}
            </span>
          </span>
        </span>
        <span className="sr-only">, </span>
        <AcceptChance p={d.acceptance} className="park-dacc" icon={14} />
      </span>
    </button>
  )
}

/** The teams with nothing, folded into one row of crests; Show lists them. */
function FoldRow({
  teams,
  colours,
  open,
  onToggle,
}: {
  teams: ShopTeam[]
  colours: Map<number, string>
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="park-fold">
      <div className="park-fold-row">
        <span className="park-fold-crests" aria-hidden="true">
          {teams.slice(0, 8).map((t) => (
            <TeamCrest key={t.team_id} name={t.team_name} colour={colours.get(t.team_id)} size={24} />
          ))}
        </span>
        <span className="park-fold-t">
          {teams.length} {teams.length === 1 ? 'team' : 'teams'}: no deal that works for both
        </span>
        <button
          type="button"
          className="park-btn"
          aria-expanded={open}
          aria-controls="park-fold-list"
          onClick={onToggle}
        >
          {open ? 'Hide' : 'Show'}
          {open ? <CaretUp size={16} aria-hidden="true" /> : <CaretDown size={16} aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <ul className="park-fold-list" id="park-fold-list">
          {teams.map((t) => (
            <li key={t.team_id} className="park-drow park-dim">
              <span className="park-dt">
                <TeamLine team={t} colour={colours.get(t.team_id)} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
