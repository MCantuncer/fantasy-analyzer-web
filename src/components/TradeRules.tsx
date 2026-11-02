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
import './TradeRules.css'

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
  const editorId = useId()
  if (!enabled) return null
  if (editing) {
    return (
      <RulesEditor
        id={editorId}
        rules={rules}
        categories={categories}
        teams={teams.filter((t) => t.id !== myTeamId)}
        keepNames={keepNames}
        onDone={() => setEditing(false)}
      />
    )
  }
  if (rules.length === 0) {
    return (
      <div className="rules-bar">
        <span className="small muted">No trade rules yet. Mark an idea in its Feedback tab, or</span>
        <button type="button" className="ghost" aria-expanded={false} onClick={() => setEditing(true)}>
          Add a rule
        </button>
      </div>
    )
  }
  return (
    <div className="rules-bar">
      <span className="rules-title">Your rules</span>
      {rules.map((r) => (
        <span key={r.id} className="rule-chip" title={r.why || undefined}>
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
      <button type="button" className="ghost" aria-expanded={false} onClick={() => setEditing(true)}>
        Edit
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
  )
}

interface Option {
  key: string
  label: string
  kind: TradeRuleKind
  value: string
  teamName?: string
}

/**
 * The rule editor: every possible rule is a toggle chip, grouped by what it does. One tap adds
 * a rule, another removes it, so there is no dropdown to open and no separate Add button.
 */
function RulesEditor({
  id,
  rules,
  categories,
  teams,
  keepNames,
  onDone,
}: {
  id: string
  rules: TradeRule[]
  categories: string[]
  teams: { id: number; name: string }[]
  keepNames: string[]
  onDone: () => void
}) {
  const { add, remove } = useTradeRules()
  const busy = add.isPending || remove.isPending
  const ruleFor = (o: Option) => rules.find((r) => r.kind === o.kind && (r.value ?? '') === o.value)
  const toggle = (o: Option) => {
    const on = ruleFor(o)
    if (on) remove.mutate(on.id)
    else add.mutate({ kind: o.kind, value: o.value, team_name: o.teamName, why: 'Added by hand.' })
  }
  const groups: { title: string; hint: string; options: Option[] }[] = [
    {
      title: 'Protect a category',
      hint: 'Skip ideas that make you weaker here.',
      options: categories.map((c) => ({ key: `c:${c}`, label: c, kind: 'protect_category', value: c })),
    },
    {
      title: 'Skip a team',
      hint: 'No ideas with these owners.',
      options: teams.map((t) => ({
        key: `t:${t.id}`,
        label: t.name,
        kind: 'skip_team',
        value: String(t.id),
        teamName: t.name,
      })),
    },
    {
      title: 'Players',
      hint: 'Skip ideas that bring in these players.',
      options: [{ key: 'i', label: 'Injury-prone players', kind: 'no_injury_prone', value: '' }],
    },
  ]
  const err = add.error ?? remove.error

  return (
    <section className="rules-editor" id={id} aria-labelledby={`${id}-title`}>
      <div className="rules-editor-head">
        <div>
          <h3 id={`${id}-title`} className="rules-editor-title">
            Your rules
          </h3>
          <p className="small muted rules-editor-sub">
            Trade ideas that break a rule are skipped. Tap to add or remove.
          </p>
        </div>
        <button type="button" className="secondary rules-done" onClick={onDone}>
          Done
        </button>
      </div>
      {groups.map((g) =>
        g.options.length === 0 ? null : (
          <fieldset key={g.title} className="rules-group">
            <legend className="rules-group-title">
              {g.title} <span className="rules-group-hint">{g.hint}</span>
            </legend>
            <div className="rules-options">
              {g.options.map((o) => {
                const rule = ruleFor(o)
                return (
                  <button
                    key={o.key}
                    type="button"
                    className="rules-option"
                    aria-pressed={!!rule}
                    disabled={busy}
                    title={rule?.why || undefined}
                    onClick={() => toggle(o)}
                  >
                    <span className="rules-option-mark" aria-hidden="true">
                      {rule ? '✓' : '+'}
                    </span>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ),
      )}
      {keepNames.length > 0 && (
        <p className="small muted rules-keep">
          <strong>Always kept:</strong> {keepNames.join(', ')}. Never suggested as trades or drops; change the list
          in My Team.
        </p>
      )}
      {err && (
        <p className="error small" role="alert">
          {err instanceof Error ? err.message : 'Could not save the rule.'}
        </p>
      )}
    </section>
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
