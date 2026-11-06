import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretRight, ChatCircleText, Check, FilmSlate } from '@phosphor-icons/react'
import { ApiError, createPost, fetchRecap, type LeagueRef, type RecapPlayer, type WeekRecap } from '../api/client'
import type { Credentials } from '../lib/credentials'
import {
  bestTotal,
  dayName,
  gameBallsPost,
  games,
  nbaAbbrev,
  noteRoom,
  readRecap,
  type FilmRoomData,
} from '../lib/filmRoom'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import './FilmShare.css'

type NameFn = (id: number) => string

function Face({ p, size }: { p: Pick<RecapPlayer, 'player_id' | 'name' | 'pro_team_id'>; size: number }) {
  return <PlayerHead player={{ id: p.player_id, name: p.name }} team={nbaAbbrev(p.pro_team_id)} size={size} />
}

/** The three game balls as compact rows: the card posted to League Chat and its preview. */
function BallRows({
  recap: r,
  d,
  name,
  colours,
}: {
  recap: WeekRecap
  d: FilmRoomData
  name: NameFn
  colours: Map<number, string>
}) {
  const p = r.players[0]
  const tw = d.topWin
  const tp = d.topPickup
  return (
    <ul className="fs-balls">
      {p && (
        <li className="fs-ball">
          <span className="fs-lab">Player</span>
          <Face p={p} size={32} />
          <span className="fs-who">
            <span className="fs-name">{p.name}</span>
            <span className="fs-sub num">
              {bestTotal(p)}
              {p.owner_team_id != null ? ` · ${name(p.owner_team_id)}` : ' · free agent'}
            </span>
          </span>
        </li>
      )}
      {tw && (
        <li className="fs-ball">
          <span className="fs-lab">Team</span>
          <TeamCrest name={name(tw.sides[0].team_id)} colour={colours.get(tw.sides[0].team_id)} size={30} />
          <span className="fs-who">
            <span className="fs-name">{name(tw.sides[0].team_id)}</span>
            <span className="fs-sub">
              <span className="num">
                {tw.sides[0].wins}–{tw.sides[1].wins}
              </span>{' '}
              over {name(tw.sides[1].team_id)}
            </span>
          </span>
        </li>
      )}
      {tp && (
        <li className="fs-ball">
          <span className="fs-lab">Pickup</span>
          <Face p={tp} size={32} />
          <span className="fs-who">
            <span className="fs-name">{tp.name}</span>
            <span className="fs-sub">
              Added {dayName(tp.weekday)}, {games(tp.after.games)} for {name(tp.by)}
            </span>
          </span>
        </li>
      )}
    </ul>
  )
}

/** "Post game balls to League Chat" under the Film Room's game balls: a preview, an optional line, Post. */
export function FilmShare({
  recap: r,
  d,
  name,
  colours,
  leagueRef,
}: {
  recap: WeekRecap
  d: FilmRoomData
  name: NameFn
  colours: Map<number, string>
  leagueRef: LeagueRef
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const head = gameBallsPost(r, d, name)
  const post = useMutation({
    mutationFn: () => createPost(leagueRef, gameBallsPost(r, d, name, note), null),
    onSuccess: () => {
      setOpen(false)
      setNote('')
      qc.invalidateQueries({ queryKey: ['feed', leagueRef.leagueId, leagueRef.season] })
    },
  })
  if (!r.players.length && !d.topWin) return null
  if (post.isSuccess && !open)
    return (
      <p className="fs-done" role="status">
        <Check size={16} aria-hidden="true" />
        Posted to League Chat
      </p>
    )
  if (!open)
    return (
      <div className="fs-open-row">
        <button type="button" className="fs-open" onClick={() => setOpen(true)}>
          <ChatCircleText size={17} aria-hidden="true" />
          Post game balls to League Chat
        </button>
      </div>
    )
  const err = post.error
  return (
    <section className="card fs-panel" aria-labelledby="fs-h">
      <h2 className="fs-h" id="fs-h">
        Post to League Chat
      </h2>
      <div className="fs-card fs-preview" aria-label="Preview">
        <span className="fs-card-head">
          <FilmSlate size={16} aria-hidden="true" />
          Week {r.period} Film Room
        </span>
        <BallRows recap={r} d={d} name={name} colours={colours} />
      </div>
      <label className="fs-note">
        <span className="small muted">Add a line (optional)</span>
        <textarea
          rows={2}
          value={note}
          maxLength={noteRoom(head)}
          placeholder="Say something to the league"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {err && (
        <p className="fs-err" role="alert">
          {err instanceof ApiError && err.status === 401
            ? 'Verify your team in this league to post.'
            : err instanceof ApiError
              ? err.message
              : 'That did not post. Try again.'}
        </p>
      )}
      <div className="fs-actions">
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" onClick={() => post.mutate()} disabled={post.isPending}>
          {post.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </section>
  )
}

/** A shared Film Room post in League Chat: the week's game balls as a card, and a way into the Film Room. */
export function FilmPostCard({
  leagueRef,
  creds,
  period,
  name,
  colours,
  onOpen,
}: {
  leagueRef: LeagueRef
  creds: Credentials | null
  period: number
  name: NameFn
  colours: Map<number, string>
  onOpen?: (period: number) => void
}) {
  const recap = useQuery({
    queryKey: ['recap', leagueRef.leagueId, leagueRef.season, period, creds?.swid ?? null],
    queryFn: () => fetchRecap(leagueRef, period, creds),
    staleTime: 6 * 3600_000,
    retry: false,
  })
  const r = recap.data
  return (
    <div className="fs-card">
      <span className="fs-card-head">
        <FilmSlate size={16} aria-hidden="true" />
        Week {period} Film Room
      </span>
      {r && <BallRows recap={r} d={readRecap(r, null)} name={name} colours={colours} />}
      {onOpen && (
        <button type="button" className="fs-go" onClick={() => onOpen(period)}>
          Open the Film Room
          <CaretRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
