import type { CheckVerdict, TradeFeedback, TradeIdea, TradeRule, TradeRuleKind } from '../api/client'

/** A protected category counts as hit when the idea costs it this much weekly win chance. */
export const PROTECT_DROP = 0.05

/** The first rule an idea breaks, or null. Rules only hide ideas; they never change the numbers. */
export function brokenRule(rules: TradeRule[], t: TradeIdea): TradeRule | null {
  for (const r of rules) {
    if (r.kind === 'protect_category' && (t.category_changes?.[r.value] ?? 0) <= -PROTECT_DROP) return r
    if (r.kind === 'skip_team' && String(t.partner_team_id) === r.value) return r
    if (r.kind === 'no_injury_prone' && t.get.some((p) => p.injury_prone)) return r
  }
  return null
}

export function applyRules(rules: TradeRule[], ideas: TradeIdea[]) {
  const kept: TradeIdea[] = []
  const skipped: { idea: TradeIdea; rule: TradeRule }[] = []
  for (const idea of ideas) {
    const rule = brokenRule(rules, idea)
    if (rule) skipped.push({ idea, rule })
    else kept.push(idea)
  }
  return { kept, skipped }
}

export interface RuleSuggestion {
  kind: TradeRuleKind
  value: string
  teamName?: string
  label: string
  detail: string
  why: string
}

const dealName = (t: TradeIdea) =>
  `${t.give.map((p) => p.name).join(' + ')} for ${t.get.map((p) => p.name).join(' + ')}`

/** A rule the feedback and the checks back up, if there is one the manager doesn't have yet. */
export function suggestRule(saved: TradeFeedback, verdicts: CheckVerdict[], rules: TradeRule[]): RuleSuggestion | null {
  if (saved.rating !== 'bad') return null
  const t = saved.idea
  const confirmed = (c: string) => verdicts.some((v) => v.check === c && v.status === 'confirmed')
  const have = (kind: TradeRuleKind, value: string) => rules.some((r) => r.kind === kind && r.value === value)
  const from = `From your feedback on ${dealName(t)}.`
  const out: RuleSuggestion[] = []
  if (confirmed('build_conflict')) {
    const worst = Object.entries(t.category_changes ?? {}).sort((a, b) => a[1] - b[1])[0]
    if (worst && worst[1] <= -PROTECT_DROP)
      out.push({
        kind: 'protect_category',
        value: worst[0],
        label: `Protect ${worst[0]}`,
        detail: `Skip ideas that cut your weekly ${worst[0]} win chance by ${Math.round(PROTECT_DROP * 100)} points or more.`,
        why: from,
      })
  }
  if (saved.reasons.includes('wont_accept') || saved.reasons.includes('already_tried'))
    out.push({
      kind: 'skip_team',
      value: String(t.partner_team_id),
      teamName: t.partner_team_name,
      label: `Skip ${t.partner_team_name}`,
      detail: `Skip ideas with ${t.partner_team_name}.`,
      why: from,
    })
  if (confirmed('injury'))
    out.push({
      kind: 'no_injury_prone',
      value: '',
      label: 'No injury-prone players in',
      detail: 'Skip ideas that bring in a player who misses a lot of games.',
      why: from,
    })
  return out.find((s) => !have(s.kind, s.value)) ?? null
}
