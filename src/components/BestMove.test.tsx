import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPlayerCardHost } from '../lib/playerCard'
import { P, pickup, report, trade } from '../test/newsSince'
import { BestMove } from './BestMove'
import { SeasonBand } from './Outlook'
import { BestMovePending } from './TradesPending'

const THEM: [number, string] = [8, 'Gergin Atamans']

describe('BestMove for a scouted team', () => {
  it("says the team's name where it would say you", () => {
    const r = report({ pickups: [pickup(P.lopez, 0.47, 0.51)] })
    const { container } = render(
      <BestMove report={r} scout="Horns" actions={<button type="button">Get my best move</button>} />,
    )
    const view = within(container)
    expect(view.getAllByText("Horns' playoff odds").length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/\byour\b/i)
    expect(container.querySelector('.sr-only')?.textContent).toContain("Horns' playoff odds go from 47% today to 51%")
    expect(view.getByRole('button', { name: 'Get my best move' })).toBeInTheDocument()
    expect(view.queryByText('Make the claim on ESPN')).toBeNull()
  })

  it('labels trade lanes Give and Get', () => {
    const r = report({ trades: [{ ...trade(THEM, [P.mitchell], [P.morant], 0.4, 0.5), acceptance: 0.6 }] })
    const view = within(render(<BestMove report={r} scout="Hammer" />).container)
    expect(view.getByText('Give')).toBeInTheDocument()
    expect(view.getByText('Get')).toBeInTheDocument()
    expect(view.getByText("Hammer's playoff odds")).toBeInTheDocument()
    expect(view.getByText('Open their team')).toBeInTheDocument() // no actions given: the usual buttons
  })

  it('names the team on a hold card', () => {
    const { container } = render(<BestMove report={report({})} scout="Horns" />)
    expect(container.textContent).toContain("No move raises Horns' odds today")
    expect(container.textContent).not.toContain('Scout another team below.')
  })

  it('keeps "Your" on your own team', () => {
    const view = within(render(<BestMove report={report({ pickups: [pickup(P.lopez, 0.47, 0.51)] })} />).container)
    expect(view.getAllByText('Your playoff odds').length).toBeGreaterThan(0)
    expect(view.getByText('Make the claim on ESPN')).toBeInTheDocument()
  })
})

// Three of five teams make the playoffs; you (Kucukesat Aspavas) are projected 4th, a win short.
function ranked(over: Parameters<typeof report>[0] = {}) {
  const r = report(over)
  const season = r.season.map((row, i) => ({ ...row, projected_wins: 90 - i * 3, projected_losses: 70 + i * 3 }))
  const mine = season.findIndex((row) => row.team_id === r.team_id)
  const [me] = season.splice(mine, 1)
  season.splice(3, 0, { ...me, projected_wins: 78, projected_losses: 82 })
  return { ...r, league: { ...r.league, playoff_teams: 3 }, season } as typeof r
}

describe('SeasonBand', () => {
  it('draws the ladder with your seat, the playoff line, one sentence and the two records', () => {
    const { container } = render(<SeasonBand report={ranked()} />)
    expect(container.querySelector('#outlook-title')?.textContent).toBe('Season outlook')
    const rungs = container.querySelectorAll('.mvl-rung')
    expect(rungs).toHaveLength(5)
    expect(rungs[3].classList.contains('me')).toBe(true)
    expect(container.querySelectorAll('.mvl-rung.in')).toHaveLength(3)
    expect(rungs[2].classList.contains('last-in')).toBe(true)
    expect(container.querySelector('.mvl-ladder-k')?.textContent).toBe('top 3 make it')
    expect(container.querySelector('.mvl-season-say')?.textContent).toBe(
      'Projected 4th of 5 · 3 wins short of the line',
    )
    expect(container.querySelector('.mvl-recs')?.textContent).toBe('Projected record78–82Playoff line · 3rd81–79')
    expect(container.textContent).not.toMatch(/\d+%/) // the odds live in the lead's chart
  })

  it('marks a scouted team with binoculars and its name, never as you', () => {
    const { container } = render(<SeasonBand report={ranked()} scout="Horns" />)
    expect(container.querySelector('.mvl-rung.me.scout svg')?.getAttribute('aria-label')).toBe('Horns')
    expect(container.textContent).not.toContain('You')
  })
})

describe('BestMove as the lead', () => {
  it('weighs Add over Drop, both opening the card with a face, and draws the chart without lanes', () => {
    const r = report({ pickups: [pickup(P.lopez, 0.47, 0.51)] })
    const { container } = render(<BestMove report={r} foot={<p data-part="season" />} />)
    const big = container.querySelector('.mvl-big') as HTMLElement
    const small = container.querySelector('.mvl-small') as HTMLElement
    expect(big.querySelector('.bm-lane-label')?.textContent).toBe('Add')
    expect(big.querySelector('.mvl-name')?.textContent).toContain(P.lopez.name)
    expect(big.querySelector('.mvl-face .head')?.getAttribute('style')).toContain('width: 72px')
    expect(small.querySelector('.bm-lane-label')?.textContent).toBe('Drop')
    expect(small.querySelector('.mvl-face .head')?.getAttribute('style')).toContain('width: 44px')
    expect(container.querySelector('.mvl-chart .pclimb-who')).toBeNull()
    expect(container.querySelector('.mvl-grid > [data-part="season"]')).not.toBeNull()
  })

  it('says the week effects as bare signed numbers after their code', () => {
    const idea = { ...pickup(P.lopez, 0.47, 0.51), category_changes: { STL: 0.07, REB: -0.02, AST: 0.01 } }
    const { container } = render(<BestMove report={report({ pickups: [idea] })} />)
    const week = container.querySelector('.mvl-week') as HTMLElement
    expect(week.textContent).toBe('Weekly win chanceSTL+7REB−2pts')
    expect(week.getAttribute('aria-label')).toBe('Weekly win chance: steals up 7, rebounds down 2 points')
    expect(container.querySelector('.bm-chip')).toBeNull()
  })

  it('draws a trade on the same calm chart, ending on the player you get, with their odds under it', () => {
    const idea = {
      ...trade(THEM, [P.mitchell], [P.morant], 0.4, 0.5),
      acceptance: 0.6,
      partner_playoff_pct_before: 0.5,
      partner_playoff_pct_after: 0.53,
    }
    const { container } = render(<BestMove report={report({ trades: [idea] })} />)
    expect(container.querySelector('.mvl-accept .acn-chance-v')?.textContent).toBe('1 in 2')
    expect(container.querySelector('.mvl-big .mvl-name')?.textContent).toContain(P.morant.name)
    expect(container.querySelector('.mvl-small .mvl-name')?.textContent).toContain(P.mitchell.name)
    expect(container.querySelector('.pclimb-strand')).toBeNull()
    expect(container.querySelector('.pclimb .sr-only')?.textContent).toContain(`with ${P.morant.name} for`)
    expect(container.querySelector('.mvl-them')?.textContent).toContain('Gergin Atamans50% → 53%▲+3')
    expect(container.querySelector('.big-odds')).toBeNull()
  })

  it("holds on a flat line at today's odds, keeping the season band", () => {
    const { container } = render(<BestMove report={report({})} foot={<p data-part="season" />} />)
    expect(container.querySelector('.mvl-sub')?.textContent).toBe('Hold for now')
    expect(container.querySelector('.mvl-flat-say')?.textContent).toBe('38% today · No move raises your odds today')
    expect(container.querySelector('.mvl-hold-say')).toBeNull()
    expect(container.querySelector('[data-part="season"]')).not.toBeNull()
  })

  it('keeps the lead shell and the season band while trades are screened', () => {
    const { container } = render(
      <BestMovePending status={{ progress: 0.64, running: true }} onRetry={() => {}} foot={<p data-part="season" />} />,
    )
    expect(container.querySelector('.card.best.mvl')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.mvl-h')?.textContent).toContain('Screening trades64%')
    expect(container.querySelector('[data-part="season"]')).not.toBeNull()
  })
})

describe('BestMove player cards', () => {
  afterEach(() => {
    cleanup()
    setPlayerCardHost(null)
  })

  it('opens the card from the drop and add notes, each with a small face', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const idea = { ...trade(THEM, [P.mitchell], [P.morant], 0.4, 0.5), acceptance: 0.6, my_drop: P.lopez }
    const { container } = render(<BestMove report={report({ trades: [idea] })} />)
    const note = container.querySelector('.bm-note') as HTMLElement
    expect(note).toHaveTextContent(`and drop ${P.lopez.name}`)
    expect(note.querySelector('.pin button.pc-link-face .head')).not.toBeNull()
    fireEvent.click(within(note).getByRole('button', { name: P.lopez.name }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: P.lopez.id }))
  })
})
