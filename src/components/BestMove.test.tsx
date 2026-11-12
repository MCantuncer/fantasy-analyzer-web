import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { P, pickup, report, trade } from '../test/newsSince'
import { BestMove } from './BestMove'
import { Outlook } from './Outlook'

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
    expect(container.querySelector('.sr-only')?.textContent).toContain("Horns' playoff odds 47% to 51%")
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
    expect(container.textContent).toContain("raises Horns' playoff odds")
  })

  it('keeps "Your" on your own team', () => {
    const view = within(render(<BestMove report={report({ pickups: [pickup(P.lopez, 0.47, 0.51)] })} />).container)
    expect(view.getAllByText('Your playoff odds').length).toBeGreaterThan(0)
    expect(view.getByText('Make the claim on ESPN')).toBeInTheDocument()
  })
})

describe('Outlook for a scouted team', () => {
  it('marks its rung with binoculars and its name, never as you', () => {
    const { container } = render(<Outlook report={report({})} scout="Horns" />)
    expect(container.querySelector('.ol-rung.me')).toBeNull()
    expect(container.querySelector('.ol-rung.scout svg')?.getAttribute('aria-label')).toBe('Horns')
    expect(container.textContent).toMatch(/Horns, projected \d/)
    expect(container.textContent).not.toContain('You')
  })
})
