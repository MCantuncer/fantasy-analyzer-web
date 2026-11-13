import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TradeOfTheDaySkeleton } from './Skeleton'
import { Spinner } from './Spinner'
import { percent, useSmoothProgress } from '../lib/progress'
import { useState } from 'react'
import { ApiError, fetchTradeOfTheDay, voteTradeOfTheDay } from '../api/client'
import type { TradeOfTheDay as Pick, TradeSide } from '../api/client'
import type { Credentials } from '../lib/credentials'
import type { CSSProperties } from 'react'
import { ordinal, pct, ptsDiff, signedInt } from '../lib/format'
import { teamColours } from '../lib/league'
import { Delta } from './OddsChange'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import './TradeOfTheDay.css'
import { gainTiles, loadVote, pickKey, shareText, storeVote, voterId } from '../lib/tradeOfTheDay'
import type { GainTile as Tile } from '../lib/tradeOfTheDay'
import { PlayerLink } from './PlayerCard'

interface Props {
  leagueId: number
  season: number
  leagueName: string
  myTeamId: number
  /** Every team in the league, so each side gets the same colour as on the League page. */
  teamIds: number[]
  creds: Credentials | null
}

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function Poll({
  side,
  pick,
  onVote,
  busy,
}: {
  side: TradeSide
  pick: Pick
  onVote: (take: boolean) => void
  busy: boolean
}) {
  const mine = loadVote(pick.league_id, pickKey(pick), side.team_id)
  const tally = pick.votes?.[side.team_id] ?? { yes: 0, no: 0 }
  const total = tally.yes + tally.no
  return (
    <div className="totd-poll">
      <div className="totd-poll-q">Would {side.team_name} take it?</div>
      <div className="row totd-poll-buttons" role="group" aria-label={`Would ${side.team_name} take it?`}>
        <button
          type="button"
          className="secondary"
          aria-pressed={mine === true}
          disabled={busy}
          onClick={() => onVote(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className="secondary"
          aria-pressed={mine === false}
          disabled={busy}
          onClick={() => onVote(false)}
        >
          No
        </button>
      </div>
      {mine !== null && total > 0 && (
        <div className="totd-tally">
          <div className="meter" aria-hidden="true">
            <span className="fill-good" style={{ width: pct(tally.yes / total) }} />
          </div>
          <div className="small muted tnum">
            {pct(tally.yes / total)} say yes · {total} {total === 1 ? 'vote' : 'votes'}
          </div>
        </div>
      )}
    </div>
  )
}

function Side({
  side,
  gets,
  isMe,
  colour,
  pick,
  onVote,
  busy,
  teams,
}: {
  side: TradeSide
  gets: TradeSide
  teams: number
  isMe: boolean
  colour: string | undefined
  pick: Pick
  onVote: (take: boolean) => void
  busy: boolean
}) {
  const diff = ptsDiff(side.playoff_pct_before, side.playoff_pct_after)
  return (
    <div className={isMe ? 'totd-side me' : 'totd-side'} style={{ '--team': colour ?? 'var(--muted)' } as CSSProperties}>
      <div className="totd-team">
        <TeamCrest name={side.team_name} colour={colour} size={28} tilt />
        <span className="totd-team-name">{side.team_name}</span>
        {isMe && <span className="badge totd-you">You</span>}
      </div>
      <div>
        <div className="kpi-label">Gets</div>
        <div className="totd-players">
          {gets.sends.map((p) => (
            <div key={p.id} className="totd-player">
              <PlayerLink player={p} decorative>
                <PlayerHead player={p} size={44} team={p.pro_team} />
              </PlayerLink>
              <span>
                <PlayerLink player={p} /> <span className="totd-pos">{p.positions.join('/')}</span>
              </span>
            </div>
          ))}
        </div>
        {side.drop && (
          <div className="small muted totd-drop">
            <PlayerHead player={side.drop} size={20} team={side.drop.pro_team} />
            and drops <PlayerLink player={side.drop} />
          </div>
        )}
      </div>
      {/* A trade that doesn't move the odds has nothing to say here: "4% → 4% ±0" is noise. */}
      {diff !== 0 && (
        <div className="totd-odds">
          <span className="kpi-label">Playoff odds</span>
          <span className="num totd-odds-figures">
            <span className="muted">{pct(side.playoff_pct_before)}</span>
            <span className="muted" aria-label="to">
              →
            </span>
            <strong>{pct(side.playoff_pct_after)}</strong>
            <span className={diff > 0 ? 'totd-delta good' : 'totd-delta bad'}>
              <Delta value={diff} />
              <span className="sr-only"> points</span>
            </span>
          </span>
        </div>
      )}
      <WhyYes side={side} teams={teams} />
      <Poll side={side} pick={pick} onVote={onVote} busy={busy} />
    </div>
  )
}

// What the per-game number counts.
const UNIT: Record<string, string> = {
  PTS: 'points',
  REB: 'rebounds',
  AST: 'assists',
  STL: 'steals',
  BLK: 'blocks',
  '3PM': '3s',
  TO: 'turnovers',
}

function perGameText(t: Tile): string | null {
  if (t.perGame == null) return null
  // per_game is the gain, already flipped for TO: shown as fewer turnovers.
  const turnover = t.category === 'TO'
  const what = UNIT[t.category] ? `${UNIT[t.category]} a game` : 'a game'
  return `${turnover ? '−' : '+'}${t.perGame.toFixed(1)} ${what}`
}

/** "9th of 10": their rank in the category today, before the trade. */
function rankText(t: Tile, teams: number): string | null {
  if (t.rank == null) return null
  return teams > 0 ? `${ordinal(t.rank)} of ${teams}` : ordinal(t.rank)
}

/** One category: the weekly win-chance gain, big, with their rank now and what it adds a game. */
function GainTile({ tile: t, teams }: { tile: Tile; teams: number }) {
  const per = perGameText(t)
  const rank = rankText(t, teams)
  return (
    <li>
      <span className="sr-only">
        {t.category}: {signedInt(t.pts)} points of weekly win chance{rank ? `, ${rank} in the league now` : ''}
        {per ? `, ${per}` : ''}
      </span>
      <div className="tw-top" aria-hidden="true">
        <span className="tw-cat num">{t.category}</span>
        {rank && (
          <span className="tw-rank num" title={`${rank} in the league in ${t.category} today, before the trade`}>
            now {rank}
          </span>
        )}
      </div>
      <div className="tw-pts num good" aria-hidden="true">
        {signedInt(t.pts)}
        <span className="tw-unit">pts</span>
      </div>
      <div className="tw-key" aria-hidden="true">
        weekly win chance
      </div>
      {per && (
        <div className="tw-per small muted num" aria-hidden="true">
          {per}
        </div>
      )}
    </li>
  )
}

/** What this side gains, drawn from the deal's data: its category gains, the punts it costs, the standings. */
function WhyYes({ side, teams }: { side: TradeSide; teams: number }) {
  const tiles = gainTiles(side)
  const facts = side.facts ?? []
  const label = `After this trade, ${side.team_name} have better odds in`
  if (!tiles.length && !facts.length) {
    // Older pick without the data: the sentences.
    return (
      <div className="totd-why">
        <div className="kpi-label">{label}</div>
        <p>{side.pitch}</p>
        {side.reasons.slice(0, 2).map((r) => (
          <p key={r} className="small muted">
            {r}
          </p>
        ))}
      </div>
    )
  }
  const punts = facts.find((f) => f.kind === 'punt_cost')
  const chasing = facts.find((f) => f.kind === 'chasing')
  const rest = facts.filter((f) => f !== punts && f !== chasing).slice(0, punts || chasing ? 1 : 2)
  return (
    <div className="totd-why">
      <div className="kpi-label">{label}</div>
      {tiles.length > 0 ? (
        <ul className="tw-needs" aria-label={label}>
          {tiles.map((t) => (
            <GainTile key={t.category} tile={t} teams={teams} />
          ))}
        </ul>
      ) : (
        <p>{side.pitch}</p>
      )}
      {(punts || chasing) && (
        <div className="tw-facts">
          {punts && (
            <span className="tw-punts" title={punts.text}>
              <span className="small muted">Costs only punts</span>
              {(punts.categories ?? []).map((c) => (
                <span key={c} className="tw-punt num">
                  {c}
                </span>
              ))}
            </span>
          )}
          {chasing && (
            <span className="tw-chasing small" title={chasing.text}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M3 12V7M7 12V3M11 12V9" />
              </svg>
              {chasing.rank ? (
                <span>
                  <span className="num">{ordinal(chasing.rank)}</span>, outside the top {chasing.playoff_spots}
                </span>
              ) : (
                <span>Outside the playoff spots</span>
              )}
            </span>
          )}
        </div>
      )}
      {rest.map((f) => (
        <p key={f.text} className="small muted">
          {f.text}
        </p>
      ))}
    </div>
  )
}

function SwapIcon() {
  return (
    <div className="totd-swap" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path
          d="M4 7h11l-3-3M16 13H5l3 3"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function TradeOfTheDay({ leagueId, season, leagueName, myTeamId, teamIds, creds }: Props) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const queryKey = ['trade-of-the-day', leagueId, season, creds?.swid ?? null]
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTradeOfTheDay(leagueId, season, creds),
    retry: 1,
    staleTime: 10 * 60_000,
    // The league scan runs in the background on the server; ask again until it's done.
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2500 : false),
  })
  const vote = useMutation({
    mutationFn: (v: { teamId: number; take: boolean; date: string; pickId: string | null }) =>
      voteTradeOfTheDay({ leagueId, season, voter: voterId(), ...v }, creds),
    onMutate: (v) => storeVote(leagueId, pickKey({ date: v.date, pick_id: v.pickId }), v.teamId, v.take),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    // The pick was replaced during the day (an injury or a better deal): load the new one.
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'pick_changed') queryClient.invalidateQueries({ queryKey })
    },
  })

  const pick = query.data
  const scanning = !pick || pick.status === 'pending'
  // Eases toward the server's reading and keeps moving between polls, like the analysis bar.
  const shown = useSmoothProgress(pick?.progress ?? 0, scanning && (pick?.progress ?? 0) > 0)
  // Not essential to the page: stay out of the way if it fails.
  if (query.isError) return null

  if (scanning) {
    // The server says where its league scan is (older servers don't, so this falls back to a plain line).
    return (
      <section className="card totd totd-loading" aria-busy="true" aria-labelledby="totd-title">
        <div className="totd-load-head">
          <span className="eyebrow totd-eyebrow" id="totd-title">
            Trade of the day
          </span>
          <span className="totd-load-status small" role="status">
            <Spinner />
            <span className="muted">{pick?.stage || "Finding today's trade"}</span>
            {shown > 0 && <span className="tnum totd-load-pct">{percent(shown)}</span>}
          </span>
        </div>
        <p className="small muted totd-load-note">Looking at every pair of teams for a deal both sides win.</p>
        <TradeOfTheDaySkeleton />
      </section>
    )
  }

  if (pick.status === 'none' || !pick.sides || pick.sides.length < 2) {
    return (
      // Nothing to show today: one quiet line, so the page opens on your own best move.
      <section className="totd-none small" aria-labelledby="totd-title">
        <span className="eyebrow totd-eyebrow" id="totd-title">
          Trade of the day · {dayLabel(pick.date)}
        </span>
        <span className="muted">No deal works for both sides today.</span>
      </section>
    )
  }

  const [a, b] = pick.sides
  const colours = teamColours(teamIds, myTeamId)
  const me = pick.sides.find((s) => s.team_id === myTeamId)
  const other = me ? pick.sides.find((s) => s.team_id !== myTeamId) : undefined
  const url = `${window.location.origin}/?league=${leagueId}&season=${season}`
  const text = shareText(pick, leagueName, url)

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // share sheet dismissed or clipboard blocked
    }
  }

  const onVote = (teamId: number) => (take: boolean) =>
    vote.mutate({ teamId, take, date: pick.date, pickId: pick.pick_id ?? null })

  return (
    <section
      className={['card totd', me && 'involved', open && 'open'].filter(Boolean).join(' ')}
      aria-labelledby="totd-title"
    >
      <div className="totd-head">
        <span className="eyebrow totd-eyebrow" id="totd-title">
          Trade of the day · {dayLabel(pick.date)}
        </span>
        <span className="small muted">
          Best of {pick.win_win_deals} win-win {pick.win_win_deals === 1 ? 'deal' : 'deals'} across {pick.team_pairs}{' '}
          team pairs
        </span>
      </div>
      <h2 className="totd-headline">{pick.headline}</h2>
      {me && <p className="totd-callout">You're in today's trade. Everyone in the league sees this one.</p>}
      <div className="totd-sides">
        <Side
          side={a}
          gets={b}
          isMe={a.team_id === myTeamId}
          colour={colours.get(a.team_id)}
          pick={pick}
          onVote={onVote(a.team_id)}
          busy={vote.isPending}
          teams={teamIds.length}
        />
        <SwapIcon />
        <Side
          side={b}
          gets={a}
          isMe={b.team_id === myTeamId}
          colour={colours.get(b.team_id)}
          pick={pick}
          onVote={onVote(b.team_id)}
          busy={vote.isPending}
          teams={teamIds.length}
        />
      </div>
      <button type="button" className="secondary totd-more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Show less' : 'What each side gains'}
      </button>
      <div className="row totd-actions">
        {me && other && (
          <a
            className="button"
            href={`https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${other.team_id}&seasonId=${season}`}
            target="_blank"
            rel="noreferrer"
          >
            Propose it to {other.team_name} on ESPN
          </a>
        )}
        <button type="button" className={me ? 'secondary' : undefined} onClick={share}>
          {copied ? 'Copied for your group chat' : 'Share with the league'}
        </button>
        <span className="small muted grow totd-note">
          Same trade for every team today. A new one every day at 00:00 UTC.
        </span>
      </div>
      {vote.isError &&
        (vote.error instanceof ApiError && vote.error.code === 'pick_changed' ? (
          <p className="small muted">Today's trade was just updated, so here's the new one.</p>
        ) : (
          <p className="small bad">Couldn't save your vote. Reload for today's trade and try again.</p>
        ))}
    </section>
  )
}
