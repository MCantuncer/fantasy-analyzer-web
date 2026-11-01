import { useContext, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTradeRule,
  deleteTradeRule,
  fetchMyTradeRules,
  type CheckVerdict,
  type TradeFeedback,
  type TradeRule,
  type TradeRuleKind,
} from '../api/client'
import { suggestRule } from '../lib/tradeRules'
import { FeedbackContext, type FeedbackScope } from './TradeFeedback'

function rulesKey(s: FeedbackScope) {
  return ['trade-rules', s.leagueId, s.season, s.teamId] as const
}

/** This manager's trade rules, shared by the trade list and every Feedback tab through the query cache. */
export function useTradeRules() {
  const scope = useContext(FeedbackContext)
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: scope ? rulesKey(scope) : ['trade-rules', 'none'],
    queryFn: () => fetchMyTradeRules(scope as FeedbackScope),
    enabled: scope !== null,
    staleTime: 5 * 60_000,
  })
  const set = (rules: TradeRule[]) => scope && qc.setQueryData(rulesKey(scope), { rules })
  const add = useMutation({
    mutationFn: (r: { kind: TradeRuleKind; value?: string; team_name?: string; why?: string }) =>
      addTradeRule(scope as FeedbackScope, r),
    onSuccess: (rule) => {
      const rules = query.data?.rules ?? []
      if (!rules.some((r) => r.id === rule.id)) set([...rules, rule])
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTradeRule(scope as FeedbackScope, id),
    onSuccess: (out) => set(out.rules),
  })
  return { enabled: scope !== null, rules: query.data?.rules ?? [], add, remove }
}

interface BarProps {
  skipped: number
  showSkipped: boolean
  onShowSkipped: () => void
  categories: string[]
  teams: { id: number; name: string }[]
  myTeamId?: number
  keepNames: string[]
}

/** "Your rules" above the trade list: chips to remove, how many ideas they hid, and an editor. */
export function RulesBar({ skipped, showSkipped, onShowSkipped, categories, teams, myTeamId, keepNames }: BarProps) {
  const { enabled, rules, remove } = useTradeRules()
  const [editing, setEditing] = useState(false)
  if (!enabled || (rules.length === 0 && !editing)) {
    return enabled ? (
      <div className="rules-bar">
        <span className="small muted">No trade rules yet. Mark an idea in its Feedback tab to add one.</span>
        <button type="button" className="ghost" onClick={() => setEditing(true)}>
          Add a rule
        </button>
      </div>
    ) : null
  }
  return (
    <>
      <div className="rules-bar">
        <span className="rules-title">Your rules</span>
        {rules.map((r) => (
          <span key={r.id} className="rule-chip">
            {r.label}
            <button
              type="button"
              aria-label={`Remove rule ${r.label}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate(r.id)}
            >
              ×
            </button>
          </span>
        ))}
        <button type="button" className="ghost" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </button>
        {skipped > 0 && (
          <span className="rules-skipped small">
            {skipped} {skipped === 1 ? 'idea' : 'ideas'} skipped by your rules ·{' '}
            <button type="button" className="link" aria-pressed={showSkipped} onClick={onShowSkipped}>
              {showSkipped ? 'Hide them' : 'Show them'}
            </button>
          </span>
        )}
      </div>
      {editing && (
        <RulesEditor
          rules={rules}
          categories={categories}
          teams={teams.filter((t) => t.id !== myTeamId)}
          keepNames={keepNames}
        />
      )}
    </>
  )
}

const KIND: Record<TradeRuleKind, string> = {
  protect_category: 'Category',
  skip_team: 'Team',
  no_injury_prone: 'Players',
}

function RulesEditor({
  rules,
  categories,
  teams,
  keepNames,
}: {
  rules: TradeRule[]
  categories: string[]
  teams: { id: number; name: string }[]
  keepNames: string[]
}) {
  const { add, remove } = useTradeRules()
  const id = useId()
  const [choice, setChoice] = useState('')
  const options = [
    ...categories.map((c) => ({ key: `c:${c}`, label: `Protect ${c}`, kind: 'protect_category' as const, value: c })),
    ...teams.map((t) => ({
      key: `t:${t.id}`,
      label: `Skip ${t.name}`,
      kind: 'skip_team' as const,
      value: String(t.id),
      name: t.name,
    })),
    { key: 'i', label: 'No injury-prone players in', kind: 'no_injury_prone' as const, value: '' },
  ].filter((o) => !rules.some((r) => r.kind === o.kind && r.value === o.value))
  const picked = options.find((o) => o.key === choice)

  return (
    <div className="rules-editor">
      <ul className="rules-list">
        {rules.map((r) => (
          <li key={r.id}>
            <div>
              <div className="rules-kind">{KIND[r.kind]}</div>
              <strong>{r.label}</strong>
              {r.why && <div className="small muted">{r.why}</div>}
            </div>
            <button type="button" className="secondary" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
              Remove
            </button>
          </li>
        ))}
        {keepNames.length > 0 && (
          <li>
            <div>
              <div className="rules-kind">Players</div>
              <strong>Keep {keepNames.join(', ')}</strong>
              <div className="small muted">
                Your keep list: never suggested as trades or drops. Change it in My team.
              </div>
            </div>
          </li>
        )}
      </ul>
      <form
        className="rules-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!picked) return
          add.mutate(
            {
              kind: picked.kind,
              value: picked.value,
              team_name: 'name' in picked ? picked.name : undefined,
              why: 'Added by hand.',
            },
            { onSuccess: () => setChoice('') },
          )
        }}
      >
        <label className="detail-label" htmlFor={`${id}-rule`}>
          Add a rule
        </label>
        <div className="row">
          <select id={`${id}-rule`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose a rule…</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!picked || add.isPending}>
            Add
          </button>
        </div>
        {add.isError && (
          <p className="error small" role="alert">
            {add.error instanceof Error ? add.error.message : 'Could not add the rule.'}
          </p>
        )}
      </form>
    </div>
  )
}

/** After the checks back up a complaint, offer to turn it into a rule. Never added without a tap. */
export function SuggestRule({ saved, verdicts }: { saved: TradeFeedback; verdicts: CheckVerdict[] }) {
  const { enabled, rules, add } = useTradeRules()
  const [dismissed, setDismissed] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const s = enabled ? suggestRule(saved, verdicts, rules) : null
  if (added)
    return (
      <p className="rule-suggest small" role="status">
        Added “{added}”. Ideas that break it are skipped; remove it any time above the trade list.
      </p>
    )
  if (!s || dismissed) return null
  return (
    <div className="rule-suggest">
      <strong>Make this a rule?</strong>
      <div className="small muted">
        {s.label}: {s.detail} You can remove it any time.
      </div>
      {add.isError && (
        <p className="error small" role="alert">
          {add.error instanceof Error ? add.error.message : 'Could not add the rule.'}
        </p>
      )}
      <div className="row">
        <button
          type="button"
          disabled={add.isPending}
          onClick={() =>
            add.mutate(
              { kind: s.kind, value: s.value, team_name: s.teamName, why: s.why },
              { onSuccess: (r) => setAdded(r.label) },
            )
          }
        >
          {s.label}
        </button>
        <button type="button" className="secondary" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </div>
  )
}
