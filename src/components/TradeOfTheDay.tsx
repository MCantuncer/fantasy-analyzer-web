import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchTradeOfTheDay, voteTradeOfTheDay } from '../api/client'
import type { TradeOfTheDay as Pick, TradeSide } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { pct, ptsDiff, signedInt } from '../lib/format'
import { loadVote, shareText, storeVote, topGains, voterId } from '../lib/tradeOfTheDay'

interface Props {
  leagueId: number
  season: number
  leagueName: string
  myTeamId: number
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
  const mine = loadVote(pick.league_id, pick.date, side.team_id)
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
  pick,
  onVote,
  busy,
}: {
  side: TradeSide
  gets: TradeSide
  isMe: boolean
  pick: Pick
  onVote: (take: boolean) => void
  busy: boolean
}) {
  const diff = ptsDiff(side.playoff_pct_before, side.playoff_pct_after)
  const gains = topGains(side.category_changes)
  return (
    <div className={isMe ? 'totd-side me' : 'totd-side'}>
      <div className="totd-team">
        <span className="totd-team-name">{side.team_name}</span>
        {isMe && <span className="badge totd-you">You</span>}
      </div>
      <div>
        <div className="kpi-label">Gets</div>
        <div className="totd-players">
          {gets.sends.map((p) => (
            <div key={p.id}>
              {p.name} <span className="totd-pos">{p.positions.join('/')}</span>
            </div>
          ))}
        </div>
        {side.drop && <div className="small muted">and drops {side.drop.name}</div>}
      </div>
      <div className="totd-odds">
        <span className="kpi-label">Playoff odds</span>
        <span className="num totd-odds-figures">
          <span className="muted">{pct(side.playoff_pct_before)}</span>
          <span className="muted" aria-label="to">
            →
          </span>
          <strong>{pct(side.playoff_pct_after)}</strong>
          <span className="delta-pill sm">{signedInt(diff)}</span>
        </span>
      </div>
      {gains.length > 0 && (
        <ul className="totd-gains" aria-label="Biggest category gains, in points of weekly win chance">
          {gains.map((g) => (
            <li key={g.category} className="num">
              {g.category} <span className="good">{signedInt(g.pts)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="totd-why">
        <div className="kpi-label">Why they say yes</div>
        <p>{side.pitch}</p>
        {side.reasons.slice(0, 2).map((r) => (
          <p key={r} className="small muted">
            {r}
          </p>
        ))}
      </div>
      <Poll side={side} pick={pick} onVote={onVote} busy={busy} />
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

export function TradeOfTheDay({ leagueId, season, leagueName, myTeamId, creds }: Props) {
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
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 5000 : false),
  })
  const vote = useMutation({
    mutationFn: (v: { teamId: number; take: boolean; date: string }) =>
      voteTradeOfTheDay({ leagueId, season, voter: voterId(), ...v }, creds),
    onMutate: (v) => storeVote(leagueId, v.date, v.teamId, v.take),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })

  const pick = query.data
  // Not essential to the page: stay out of the way if it fails.
  if (query.isError) return null

  if (!pick || pick.status === 'pending') {
    return (
      <section className="card totd totd-loading" aria-busy="true" aria-labelledby="totd-title">
        <span className="eyebrow totd-eyebrow" id="totd-title">
          Trade of the day
        </span>
        <div className="row">
          <svg className="spinner" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="30 20" />
          </svg>
          <span className="muted">Checking every pair of teams for today's best win-win trade…</span>
        </div>
      </section>
    )
  }

  if (pick.status === 'none' || !pick.sides || pick.sides.length < 2) {
    return (
      <section className="card totd totd-quiet" aria-labelledby="totd-title">
        <span className="eyebrow totd-eyebrow" id="totd-title">
          Trade of the day · {dayLabel(pick.date)}
        </span>
        <p className="muted">No trade works for both sides today. Rosters change fast, so check back tomorrow.</p>
      </section>
    )
  }

  const [a, b] = pick.sides
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

  const onVote = (teamId: number) => (take: boolean) => vote.mutate({ teamId, take, date: pick.date })

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
          pick={pick}
          onVote={onVote(a.team_id)}
          busy={vote.isPending}
        />
        <SwapIcon />
        <Side
          side={b}
          gets={a}
          isMe={b.team_id === myTeamId}
          pick={pick}
          onVote={onVote(b.team_id)}
          busy={vote.isPending}
        />
      </div>
      <button type="button" className="secondary totd-more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Show less' : 'Why both sides say yes'}
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
      {vote.isError && <p className="small bad">Couldn't save your vote. Reload for today's trade and try again.</p>}
    </section>
  )
}
