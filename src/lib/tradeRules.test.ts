import { describe, expect, it } from 'vitest'
import type { CheckVerdict, TradeFeedback, TradeIdea, TradeRule } from '../api/client'
import { applyRules, brokenRule, suggestRule } from './tradeRules'

const player = (name: string, injury_prone = false) => ({ id: name.length, name, injury_prone })

function idea(over: Partial<Record<string, unknown>> = {}): TradeIdea {
  return {
    partner_team_id: 7,
    partner_team_name: 'Los Avokados',
    give: [player('Jalen Green')],
    get: [player('Trae Young')],
    category_changes: { AST: 0.2, TO: -0.12, FG: -0.02 },
    ...over,
  } as unknown as TradeIdea
}

const rule = (kind: TradeRule['kind'], value: string, id = 1): TradeRule =>
  ({ id, kind, value, label: `${kind} ${value}`, why: '', created_at: '' }) as TradeRule

const verdict = (check: string, status: string) => ({ check, status }) as unknown as CheckVerdict

function feedback(over: Partial<Record<string, unknown>> = {}): TradeFeedback {
  return { rating: 'bad', reasons: [], note: '', idea: idea(), ...over } as unknown as TradeFeedback
}

describe('brokenRule', () => {
  it('protects a category only when the idea costs it enough', () => {
    expect(brokenRule([rule('protect_category', 'TO')], idea())?.value).toBe('TO')
    expect(brokenRule([rule('protect_category', 'FG')], idea())).toBeNull()
    expect(brokenRule([rule('protect_category', 'AST')], idea())).toBeNull()
  })

  it('skips a team by id', () => {
    expect(brokenRule([rule('skip_team', '7')], idea())).not.toBeNull()
    expect(brokenRule([rule('skip_team', '8')], idea())).toBeNull()
  })

  it('skips ideas bringing in an injury-prone player, not sending one away', () => {
    const r = [rule('no_injury_prone', '')]
    expect(brokenRule(r, idea({ get: [player('Zion', true)] }))).not.toBeNull()
    expect(brokenRule(r, idea({ give: [player('Zion', true)] }))).toBeNull()
  })
})

describe('applyRules', () => {
  it('splits ideas into kept and skipped, with the rule that skipped each', () => {
    const ideas = [idea(), idea({ partner_team_id: 3, category_changes: {} })]
    const { kept, skipped } = applyRules([rule('skip_team', '7')], ideas)
    expect(kept).toHaveLength(1)
    expect(skipped[0].rule.value).toBe('7')
  })
})

describe('suggestRule', () => {
  it('offers to protect the worst category after a confirmed build conflict', () => {
    const s = suggestRule(feedback(), [verdict('build_conflict', 'confirmed')], [])
    expect(s).toMatchObject({ kind: 'protect_category', value: 'TO', label: 'Protect TO' })
  })

  it('offers nothing when the check did not back the complaint up', () => {
    expect(suggestRule(feedback(), [verdict('build_conflict', 'not_supported')], [])).toBeNull()
  })

  it('offers to skip the team after "they won\'t accept"', () => {
    const s = suggestRule(feedback({ reasons: ['wont_accept'] }), [], [])
    expect(s).toMatchObject({ kind: 'skip_team', value: '7', teamName: 'Los Avokados' })
  })

  it('skips suggestions the manager already has and ignores good ratings', () => {
    const fb = feedback({ reasons: ['wont_accept'] })
    const v = [verdict('build_conflict', 'confirmed')]
    expect(suggestRule(fb, v, [rule('protect_category', 'TO')])?.kind).toBe('skip_team')
    expect(suggestRule(feedback({ rating: 'good' }), v, [])).toBeNull()
  })
})
