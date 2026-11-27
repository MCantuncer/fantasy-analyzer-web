import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowSquareOut, ArrowsLeftRight, Info, ShareNetwork, ThumbsDown, ThumbsUp, User } from '@phosphor-icons/react'
import { Bone } from './Skeleton'
import { Spinner } from './Spinner'
import { percent, useSmoothProgress } from '../lib/progress'
import { ApiError, fetchTradeOfTheDay, voteTradeOfTheDay } from '../api/client'
import type { TradeOfTheDay as Pick, TradeSide } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { ordinal, pct, ptsDiff, signedInt } from '../lib/format'
import { teamColours } from '../lib/league'
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
  const q = `Would ${side.team_name} take it?`
  return (
    <div className="totd-poll-line">
      <span className="totd-q">{q}</span>
      <span className="totd-vote-row">
        {/* The tally shows only once you have voted, so it never sways the vote. */}
        {mine !== null && total > 0 && (
          <span className="totd-count">
            <span className="num">
              {tally.yes} of {total}
            </span>{' '}
            say yes
          </span>
        )}
        <span className="totd-votes" role="group" aria-label={q}>
          <button
            type="button"
            className="totd-vote"
            aria-pressed={mine === true}
            disabled={busy}
            onClick={() => onVote(true)}
          >
            <ThumbsUp size={16} aria-hidden="true" />
            Yes
          </button>
          <button
            type="button"
            className="totd-vote"
            aria-pressed={mine === false}
            disabled={busy}
            onClick={() => onVote(false)}
          >
            <ThumbsDown size={16} aria-hidden="true" />
            No
          </button>
        </span>
      </span>
    </div>
  )
}

/** One side of the deal: who, their odds, who they get, where their odds get better, and the poll. */
function Half({
  side,
  gets,
  isMe,
  colour,
  at,
  pick,
  onVote,
  busy,
  teams,
}: {
  side: TradeSide
  gets: TradeSide
  isMe: boolean
  colour: string | undefined
  at: 'l' | 'r'
  pick: Pick
  onVote: (take: boolean) => void
  busy: boolean
  teams: number
}) {
  const diff = ptsDiff(side.playoff_pct_before, side.playoff_pct_after)
  // Each side is lit faintly by its crest from its outer top corner; your side by plain light, so gold
  // stays on the person mark.
  const light = isMe ? 'var(--text-2)' : (colour ?? 'var(--muted)')
  return (
    <div className={`totd-half totd-${at}`} style={{ '--hue': light } as CSSProperties}>
      <div className="totd-top">
        <TeamCrest name={side.team_name} colour={colour} size={32} />
        <span className="totd-tn">
          {side.team_name}
          {isMe && (
            <span className="totd-me">
              <User size={14} weight="bold" aria-hidden="true" />
              <span className="sr-only"> (your team)</span>
            </span>
          )}
        </span>
        {/* A trade that doesn't move the odds has nothing to say here: "4% → 4% ±0" is noise. */}
        {diff !== 0 && (
          <span className="totd-od">
            <span className="totd-a num">{pct(side.playoff_pct_after)}</span>
            <span className="totd-f">
              from <span className="num">{pct(side.playoff_pct_before)}</span>{' '}
              <span className={`totd-dl num ${diff > 0 ? 'good' : 'bad'}`}>
                <span className="totd-ar" aria-hidden="true">
                  {diff > 0 ? '▲' : '▼'}
                </span>
                {signedInt(diff)} pts
              </span>
            </span>
            <span className="sr-only">playoff odds</span>
          </span>
        )}
      </div>
      <div className="totd-gets">
        <span className="totd-k">Gets</span>
        <ul className="totd-list">
          {gets.sends.map((p) => (
            <li key={p.id} className="totd-pl">
              <PlayerLink player={p} decorative>
                <PlayerHead player={p} size={44} team={p.pro_team} />
              </PlayerLink>
              <span className="totd-pl-text">
                <span className="totd-pl-name">
                  <PlayerLink player={p} />
                </span>
                <span className="totd-pl-meta">{[p.pro_team, p.positions.join('/')].filter(Boolean).join(' · ')}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {side.drop && (
        <p className="totd-cut">
          <PlayerHead player={side.drop} size={20} team={side.drop.pro_team} />
          <span>
            and drops <PlayerLink player={side.drop} />
          </span>
        </p>
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

/** "+2.6 rebounds a game", split so the number can be set in figures. */
function perGame(t: Tile): { n: string; what: string } | null {
  if (t.perGame == null) return null
  // per_game is the gain, already flipped for TO: shown as fewer turnovers.
  const turnover = t.category === 'TO'
  return {
    n: `${turnover ? '−' : '+'}${t.perGame.toFixed(1)}`,
    what: UNIT[t.category] ? `${UNIT[t.category]} a game` : 'a game',
  }
}

/** One category: the weekly win-chance gain, then what it adds a game, then their rank in it now. */
function Gain({ tile: t, teams }: { tile: Tile; teams: number }) {
  const per = perGame(t)
  const rank = t.rank == null ? null : teams > 0 ? `${ordinal(t.rank)} of ${teams}` : ordinal(t.rank)
  return (
    <li className="totd-gain">
      <span className="sr-only">
        {t.category}: {signedInt(t.pts)} points of weekly win chance{per ? `, ${per.n} ${per.what}` : ''}
        {rank ? `, ${rank} in the league now` : ''}
      </span>
      <span className="totd-g1" aria-hidden="true">
        <span className="totd-gc">{t.category}</span>
        <span className="totd-gp num">{signedInt(t.pts)} pts</span>
      </span>
      {per && (
        <span className="totd-g2" aria-hidden="true">
          <span className="num">{per.n}</span> {per.what}
        </span>
      )}
      {rank && (
        <span
          className="totd-g3"
          aria-hidden="true"
          title={`${rank} in the league in ${t.category} today, before the trade`}
        >
          now <span className="num">{rank}</span>
        </span>
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
      <div className="totd-why-box">
        <p className="totd-bo">Better odds in</p>
        <p className="totd-pitch">{side.pitch}</p>
        {side.reasons.slice(0, 2).map((r) => (
          <p key={r} className="totd-fact">
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
    <div className="totd-why-box">
      <p className="totd-bo" aria-hidden="true">
        Better odds in
      </p>
      {tiles.length > 0 ? (
        <ul className="totd-gains" aria-label={label}>
          {tiles.map((t) => (
            <Gain key={t.category} tile={t} teams={teams} />
          ))}
        </ul>
      ) : (
        <p className="totd-pitch">{side.pitch}</p>
      )}
      {(punts || chasing) && (
        <div className="totd-facts">
          {punts && (
            <span className="totd-punts" title={punts.text}>
              Costs only punts
              {(punts.categories ?? []).map((c) => (
                <span key={c} className="totd-punt">
                  {c}
                </span>
              ))}
            </span>
          )}
          {chasing && (
            <span className="totd-chasing" title={chasing.text}>
              {chasing.rank ? (
                <>
                  <span className="num">{ordinal(chasing.rank)}</span>, outside the top {chasing.playoff_spots}
                </>
              ) : (
                'Outside the playoff spots'
              )}
            </span>
          )}
        </div>
      )}
      {rest.map((f) => (
        <p key={f.text} className="totd-fact">
          {f.text}
        </p>
      ))}
    </div>
  )
}

/** Where the deal will be, at its final height, while the league scan runs. */
function Bones() {
  const half = (
    <div className="totd-half">
      <div className="totd-top">
        <Bone w={32} h={32} round />
        <Bone w={140} h={14} />
        <Bone w={56} h={24} />
      </div>
      <div className="totd-gets">
        <Bone w={32} h={10} />
        <Bone w={44} h={44} className="sk-r8" />
        <Bone w={120} h={14} />
      </div>
      <Bone w={90} h={10} />
      <div className="totd-gains">
        <Bone w="80%" h={44} />
        <Bone w="80%" h={44} />
      </div>
      <Bone w="100%" h={44} />
    </div>
  )
  return (
    <div className="totd-board totd-bones sk" aria-hidden="true">
      {half}
      <div className="totd-seam" />
      {half}
      <div className="totd-foot">
        <Bone w={260} h={12} />
      </div>
    </div>
  )
}

function Head({ sub }: { sub?: ReactNode }) {
  return (
    <div className="totd-bar">
      <h2 id="totd-title" className="totd-h2">
        <ArrowsLeftRight size={20} aria-hidden="true" />
        Trade of the day
      </h2>
      {sub}
    </div>
  )
}

export function TradeOfTheDay({ leagueId, season, leagueName, myTeamId, teamIds, creds }: Props) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
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
    // The server says where its league scan is (older servers don't, so it just waits its turn).
    return (
      <section className="totd-band totd-wait" aria-busy="true" aria-labelledby="totd-title">
        <Head
          sub={
            <span className="totd-status" role="status">
              <Spinner />
              <span>{pick?.stage || 'Waiting its turn'}</span>
              {shown > 0 && <span className="num totd-pct">{percent(shown)}</span>}
            </span>
          }
        />
        <Bones />
      </section>
    )
  }

  if (pick.status === 'none' || !pick.sides || pick.sides.length < 2) {
    return (
      // Nothing to show today: one quiet line, so the page stays on your own moves.
      <section className="totd-band totd-empty" aria-labelledby="totd-title">
        <Head sub={<span className="totd-sub">{dayLabel(pick.date)}</span>} />
        <p className="totd-none-line">
          <Info size={16} aria-hidden="true" />
          No deal works for both sides today.
        </p>
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
  const half = (side: TradeSide, gets: TradeSide, at: 'l' | 'r') => (
    <Half
      side={side}
      gets={gets}
      isMe={side.team_id === myTeamId}
      colour={colours.get(side.team_id)}
      at={at}
      pick={pick}
      onVote={onVote(side.team_id)}
      busy={vote.isPending}
      teams={teamIds.length}
    />
  )

  return (
    <section className="totd-band" aria-labelledby="totd-title">
      <Head
        sub={
          <span className="totd-sub">
            {dayLabel(pick.date)} · best of <span className="num">{pick.win_win_deals}</span> win-win{' '}
            {pick.win_win_deals === 1 ? 'deal' : 'deals'} across <span className="num">{pick.team_pairs}</span> team
            pairs
          </span>
        }
      />
      <p className="totd-line">{pick.headline}</p>
      <div className="totd-board">
        {half(a, b, 'l')}
        <div className="totd-seam" aria-hidden="true">
          <span>
            <ArrowsLeftRight size={17} />
          </span>
        </div>
        {half(b, a, 'r')}
        <div className="totd-foot">
          <span className="totd-note">
            Next at <span className="num">00:00</span> UTC
          </span>
          <span className="totd-acts">
            {me && other && (
              <a
                className="button"
                href={`https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${other.team_id}&seasonId=${season}`}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowSquareOut size={16} aria-hidden="true" />
                Propose it to {other.team_name} on ESPN
              </a>
            )}
            <button type="button" className="totd-quiet" onClick={share}>
              <ShareNetwork size={16} aria-hidden="true" />
              {copied ? 'Copied for your group chat' : 'Share with the league'}
            </button>
          </span>
        </div>
      </div>
      {vote.isError &&
        (vote.error instanceof ApiError && vote.error.code === 'pick_changed' ? (
          <p className="totd-fact">Today's trade was just updated, so here's the new one.</p>
        ) : (
          <p className="totd-fact bad">Couldn't save your vote. Reload for today's trade and try again.</p>
        ))}
    </section>
  )
}
