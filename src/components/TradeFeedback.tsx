import { createContext, useContext, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  checkTrade,
  fetchMyTradeFeedback,
  saveTradeFeedback,
  type CheckVerdict,
  type FeedbackRating,
  type FeedbackReason,
  type FeedbackSeat,
  type FeedbackSource,
  type TradeFeedback as Saved,
  type TradeIdea,
} from '../api/client'
import type { Credentials } from '../lib/credentials'

export interface FeedbackScope extends FeedbackSeat {
  creds: Credentials | null
}

/** Set around the trade lists of a verified manager's own report; without it cards show no Feedback tab. */
export const FeedbackContext = createContext<FeedbackScope | null>(null)

export const REASONS: { id: FeedbackReason; label: string }[] = [
  { id: 'fake_gain', label: 'Gain looks fake' },
  { id: 'wont_accept', label: "They'd never accept" },
  { id: 'bad_for_build', label: 'Bad for my build' },
  { id: 'player_concern', label: 'Player concern' },
  { id: 'already_tried', label: 'Already tried' },
  { id: 'other', label: 'Other' },
]
const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.id, r.label])) as Record<FeedbackReason, string>
const TEXT_MAX = 500

const STATUS: Record<CheckVerdict['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'verdict-confirmed' },
  not_supported: { label: 'Not supported', cls: 'verdict-not' },
  cant_check: { label: "Can't check yet", cls: 'verdict-cant' },
}

/** The same key the API stores feedback under: one entry per list and deal, whatever the player order. */
export function ideaKey(source: FeedbackSource, t: Pick<TradeIdea, 'partner_team_id' | 'give' | 'get'>): string {
  const ids = (ps: { id: number }[]) =>
    ps
      .map((p) => p.id)
      .sort((a, b) => a - b)
      .join(',')
  return `${source}:${t.partner_team_id}:${ids(t.give)}>${ids(t.get)}`
}

function mineKey(s: FeedbackSeat) {
  return ['trade-feedback', s.leagueId, s.season, s.teamId] as const
}

/** This manager's saved feedback in the league, by deal. Shared by every card through the query cache. */
export function useMyFeedback(source: FeedbackSource | undefined, trade: TradeIdea): Saved | null {
  const scope = useContext(FeedbackContext)
  const mine = useQuery({
    queryKey: scope ? mineKey(scope) : ['trade-feedback', 'none'],
    queryFn: () => fetchMyTradeFeedback(scope as FeedbackScope),
    enabled: scope !== null && source !== undefined,
    staleTime: 5 * 60_000,
  })
  if (!source || !mine.data) return null
  const key = ideaKey(source, trade)
  return mine.data.feedback.find((f) => ideaKey(f.source, f.idea) === key) ?? null
}

export function ratingLabel(r: FeedbackRating) {
  return r === 'bad' ? 'Bad idea' : 'Good idea'
}

interface Props {
  trade: TradeIdea
  source: FeedbackSource
}

/** The Feedback tab of a trade card: rate the idea, say why if you like, then see what the data says. */
export function TradeFeedback({ trade, source }: Props) {
  const scope = useContext(FeedbackContext)
  const saved = useMyFeedback(source, trade)
  const [editing, setEditing] = useState(false)
  if (!scope) return null
  if (saved && !editing) return <Checked scope={scope} saved={saved} onChange={() => setEditing(true)} />
  return <Form scope={scope} trade={trade} source={source} saved={saved} onDone={() => setEditing(false)} />
}

function Form({
  scope,
  trade,
  source,
  saved,
  onDone,
}: {
  scope: FeedbackScope
  trade: TradeIdea
  source: FeedbackSource
  saved: Saved | null
  onDone: () => void
}) {
  const qc = useQueryClient()
  const id = useId()
  const [rating, setRating] = useState<FeedbackRating | null>(saved?.rating ?? null)
  const [reasons, setReasons] = useState<FeedbackReason[]>(saved?.reasons ?? [])
  const [text, setText] = useState(saved?.text ?? '')
  const send = useMutation({
    mutationFn: () =>
      saveTradeFeedback(scope, {
        source,
        rating: rating as FeedbackRating,
        reasons: rating === 'bad' ? reasons : [],
        text: text.trim(),
        idea: trade,
      }),
    onSuccess: (entry) => {
      qc.setQueryData<{ feedback: Saved[] }>(mineKey(scope), (old) => {
        const key = ideaKey(entry.source, entry.idea)
        const rest = (old?.feedback ?? []).filter((f) => ideaKey(f.source, f.idea) !== key)
        return { feedback: [entry, ...rest] }
      })
      onDone()
    },
  })
  const toggle = (r: FeedbackReason) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))

  return (
    <form
      className="feedback"
      onSubmit={(e) => {
        e.preventDefault()
        if (rating) send.mutate()
      }}
    >
      <h3 className="feedback-q">Was this a good trade idea?</h3>
      <p className="small muted">We check what you tell us against the data. The idea stays on your list.</p>
      <div className="feedback-rating" role="group" aria-label="Your rating">
        {(['good', 'bad'] as const).map((r) => (
          <button key={r} type="button" className="secondary" aria-pressed={rating === r} onClick={() => setRating(r)}>
            {ratingLabel(r)}
          </button>
        ))}
      </div>
      {rating === 'bad' && (
        <>
          <div className="detail-label">What felt off? Pick any, or none.</div>
          <div className="feedback-reasons" role="group" aria-label="What felt off">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className="chip sm"
                aria-pressed={reasons.includes(r.id)}
                onClick={() => toggle(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
      {rating && (
        <>
          <label className="detail-label" htmlFor={`${id}-text`}>
            In your words (optional)
          </label>
          <textarea
            id={`${id}-text`}
            className="feedback-text"
            value={text}
            maxLength={TEXT_MAX}
            rows={3}
            placeholder={rating === 'bad' ? 'e.g. Lopez is losing minutes' : 'e.g. Exactly the guard I needed'}
            onChange={(e) => setText(e.target.value)}
          />
        </>
      )}
      {send.isError && (
        <p className="error small" role="alert">
          {send.error instanceof Error ? send.error.message : 'Could not send your feedback.'} Try again.
        </p>
      )}
      <div className="row">
        <button type="submit" disabled={!rating || send.isPending}>
          {send.isPending ? 'Sending…' : 'Send feedback'}
        </button>
        {saved && (
          <button type="button" className="ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function Checked({ scope, saved, onChange }: { scope: FeedbackScope; saved: Saved; onChange: () => void }) {
  const said = [ratingLabel(saved.rating), ...saved.reasons.map((r) => REASON_LABEL[r])]
  const check = useQuery({
    queryKey: [
      'trade-check',
      scope.leagueId,
      scope.season,
      scope.teamId,
      ideaKey(saved.source, saved.idea),
      saved.reasons,
    ],
    queryFn: () => checkTrade(scope, saved.idea, saved.reasons, scope.creds),
    staleTime: 10 * 60_000,
    retry: 1,
  })
  return (
    <div className="feedback">
      <h3 className="feedback-q">What we checked</h3>
      <p className="small muted">
        You said: {said.join(' · ')}
        {saved.text && <> · “{saved.text}”</>}
      </p>
      {check.isPending && (
        <p className="small muted" role="status">
          Checking this trade against today's league…
        </p>
      )}
      {check.isError && (
        <p className="small muted" role="status">
          Thanks, your feedback is saved. The checks aren't available right now.
        </p>
      )}
      {check.data?.stale && <p className="small muted">{check.data.stale} The checks need today's rosters.</p>}
      {check.data && !check.data.stale && (
        <>
          <p className="feedback-sum">{summary(check.data.verdicts, saved.rating)}</p>
          <ul className="verdicts">
            {check.data.verdicts.map((v) => (
              <li key={v.check}>
                <span className={`verdict ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span>
                <span>
                  <strong>{v.title}.</strong> {v.evidence}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="row">
        <button type="button" className="secondary" onClick={onChange}>
          Change my feedback
        </button>
      </div>
    </div>
  )
}

function summary(verdicts: CheckVerdict[], rating: FeedbackRating): string {
  const found = verdicts.filter((v) => v.status === 'confirmed').length
  if (rating === 'good') {
    return found === 0
      ? 'The checks agree: nothing wrong found.'
      : `Worth knowing: ${found} ${plural(found, 'check')} found a problem.`
  }
  return found === 0
    ? "The checks found nothing wrong. We'll keep your feedback to look for patterns."
    : `${found} ${plural(found, 'check')} found a problem with this idea.`
}

function plural(n: number, word: string) {
  return n === 1 ? word : `${word}s`
}
