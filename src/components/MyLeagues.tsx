import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, addLeague, clearNotices, removeLeague } from '../api/client'
import type { Me, MyLeague } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { parseLeagueInput } from '../lib/espnUrl'
import { CookieForm } from './CookieForm'

interface Props {
  me: Me
  creds: Credentials | null
  onCreds: (creds: Credentials, remember: boolean) => void
  onOpen: (league: MyLeague) => void
}

export function MyLeagues({ me, creds, onCreds, onOpen }: Props) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [tried, setTried] = useState(false)
  const parsed = parseLeagueInput(input)

  const setMe = (next: Me) => qc.setQueryData(['me'], next)
  const add = useMutation({
    mutationFn: (c: Credentials | null) => addLeague(parsed.leagueId!, parsed.season ?? null, c),
    onSuccess: (next) => {
      setMe(next)
      setInput('')
      setTried(false)
      // Straight into the league just added.
      const added = next.leagues.find((l) => l.league_id === parsed.leagueId)
      if (added) onOpen(added)
    },
  })
  const remove = useMutation({ mutationFn: removeLeague, onSuccess: setMe })
  const dismiss = useMutation({ mutationFn: clearNotices, onSuccess: setMe })
  const needsCookies = add.error instanceof ApiError && add.error.code === 'private_league'

  return (
    <div className="my-leagues stack">
      <h1 className="page-title">My leagues</h1>

      {me.notices.length > 0 && (
        <section className="card notice stack" role="status">
          {me.notices.map((n) => (
            <p key={n.id}>{n.text}</p>
          ))}
          <div className="row">
            <button type="button" className="secondary" onClick={() => dismiss.mutate()}>
              Got it
            </button>
          </div>
        </section>
      )}

      {me.leagues.length === 0 && (
        <p className="muted">
          Add the ESPN leagues you play in. You'll see each league right away, and verifying the team you manage unlocks
          its moves, trades and the league chat.
        </p>
      )}

      <div className="league-list">
        {me.leagues.map((l) => (
          <article key={`${l.league_id}-${l.season}`} className="card league-card">
            <button type="button" className="league-open" onClick={() => onOpen(l)}>
              <span className="league-card-head">
                <span className="league-card-name">{l.name}</span>
                {l.team_id ? (
                  <span className="tag good">Verified</span>
                ) : (
                  <span className="tag warn">Not verified</span>
                )}
              </span>
              <span className="small muted">
                {l.team_id
                  ? 'You are a verified manager here'
                  : 'League view only. Verify your team to see your moves.'}
              </span>
            </button>
            <details className="league-menu">
              <summary aria-label={`More for ${l.name}`} title="More">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="4" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="14" cy="9" r="1.5" fill="currentColor" />
                </svg>
              </summary>
              <div className="menu card">
                <button
                  type="button"
                  className="menu-item danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ leagueId: l.league_id, season: l.season })}
                >
                  Remove from my leagues
                </button>
              </div>
            </details>
          </article>
        ))}
      </div>

      {needsCookies ? (
        <CookieForm
          onSubmit={(c, remember) => {
            onCreds(c, remember)
            add.mutate(c)
          }}
          onCancel={() => add.reset()}
        />
      ) : (
        <section className="card stack" aria-labelledby="add-title">
          <h2 id="add-title">Add a league</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              setTried(true)
              if (parsed.leagueId) add.mutate(creds)
            }}
          >
            <label htmlFor="league-input" className="small">
              ESPN league ID or link
            </label>
            <div className="input-row">
              <input
                id="league-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="744636428 or fantasy.espn.com/…"
                inputMode="url"
                autoComplete="off"
                aria-invalid={tried && !parsed.leagueId}
                aria-describedby={tried && !parsed.leagueId ? 'league-error' : undefined}
              />
              <button type="submit" disabled={add.isPending}>
                {add.isPending ? 'Adding…' : 'Add league'}
              </button>
            </div>
            {tried && !parsed.leagueId && (
              <span id="league-error" className="small bad">
                Enter a league ID (numbers only) or paste a link from ESPN.
              </span>
            )}
            {add.error && !needsCookies && (
              <span className="small bad" role="alert">
                {add.error.message}
              </span>
            )}
          </form>
        </section>
      )}
    </div>
  )
}
