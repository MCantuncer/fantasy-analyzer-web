import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { CaretRight, DotsThree, SealCheck, Trophy } from '@phosphor-icons/react'
import { ApiError, addLeague, clearNotices, removeLeague } from '../api/client'
import type { Me, MyLeague } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { parseLeagueInput } from '../lib/espnUrl'
import { CookieForm } from './CookieForm'
import { EstimatesTeaser } from './IddaaCompare'
import './MyLeagues.css'

interface Props {
  me: Me
  creds: Credentials | null
  onCreds: (creds: Credentials, remember: boolean) => void
  onOpen: (league: MyLeague) => void
  /** Opens Our Estimates: our numbers beside the sportsbook's, judged against the results. */
  onEstimates?: () => void
  /** Changes when the top bar asks to add a league: focus the add box. */
  focusAdd?: number
  /** A league pasted before sign-up that still needs adding (a private one needs cookies first). */
  initialInput?: string
}

export function MyLeagues({ me, creds, onCreds, onOpen, onEstimates, focusAdd = 0, initialInput = '' }: Props) {
  const qc = useQueryClient()
  const [input, setInput] = useState(initialInput)
  const [tried, setTried] = useState(false)
  const parsed = parseLeagueInput(input)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!focusAdd) return
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({ block: 'center' })
  }, [focusAdd])

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

  const empty = me.leagues.length === 0

  // The add field: under the list, or first of all on an empty account.
  const addForm = needsCookies ? (
    <CookieForm
      onSubmit={(c, remember) => {
        onCreds(c, remember)
        add.mutate(c)
      }}
      onCancel={() => add.reset()}
      onRetry={() => add.mutate(null)}
    />
  ) : (
    <form
      className="ml-add"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (parsed.leagueId) add.mutate(creds)
      }}
    >
      <label htmlFor="league-input" className="ml-add-label">
        {empty ? 'Add your ESPN league' : 'Add a league'}
      </label>
      <div className="ml-add-row">
        <input
          id="league-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="League ID or fantasy.espn.com link"
          inputMode="url"
          autoComplete="off"
          aria-invalid={tried && !parsed.leagueId}
          aria-describedby={tried && !parsed.leagueId ? 'league-error league-hint' : 'league-hint'}
        />
        <button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Adding…' : empty ? 'Add league' : 'Add'}
        </button>
      </div>
      {tried && !parsed.leagueId && (
        <span id="league-error" className="ml-add-msg bad">
          Enter a league ID (numbers only) or paste a link from ESPN.
        </span>
      )}
      {add.error && !needsCookies && (
        <span className="ml-add-msg bad" role="alert">
          {add.error.message}
        </span>
      )}
      <p id="league-hint" className="ml-add-hint">
        {empty
          ? 'Public leagues open right away. Private ones ask for two ESPN cookies next.'
          : 'Private leagues ask for two ESPN cookies next.'}
      </p>
    </form>
  )

  return (
    <div className={`my-leagues ml${empty ? ' ml-new' : ''}`}>
      <h1 className="page-title ml-title">My leagues</h1>

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

      {!empty && (
        <ul className="ml-list">
          {me.leagues.map((l) => (
            <li key={`${l.league_id}-${l.season}`} className="ml-item">
              <button type="button" className="ml-row" onClick={() => onOpen(l)}>
                <span className="ml-ic" aria-hidden="true">
                  <Trophy />
                </span>
                <span className="ml-text">
                  <span className="ml-nm">{l.name}</span>
                  {l.team_id ? (
                    <span className="ml-s">
                      <SealCheck className="ml-seal" aria-hidden="true" />
                      Verified manager · {seasonLabel(l.season)}
                    </span>
                  ) : (
                    <span className="ml-s ml-q">Following · verify your team to see your moves</span>
                  )}
                </span>
                <CaretRight className="ml-go" aria-hidden="true" />
              </button>
              <details className="ml-menu">
                <summary aria-label={`More for ${l.name}`} title="More">
                  <DotsThree weight="bold" aria-hidden="true" />
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
            </li>
          ))}
        </ul>
      )}

      {addForm}

      {onEstimates && <EstimatesTeaser onOpen={onEstimates} />}
    </div>
  )
}

/** ESPN's 2027 season is "2026–27". */
function seasonLabel(season: number): string {
  return `${season - 1}–${String(season).slice(2)}`
}
