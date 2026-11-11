import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OfferCheck, PlayerRef } from '../api/client'
import sample from '../test/offer-check-1for2.json'
import { TradeCheckFlags } from './TradeCheckFlags'
import { TradeCheckMoves } from './TradeCheckMoves'

const check = sample as unknown as OfferCheck
const roster = (check.my_drop_options ?? []).map((o) => o.player) as PlayerRef[]

describe('TradeCheckMoves', () => {
  it('names the cut and pickups, and changes the cut in a sheet', () => {
    const onCut = vi.fn()
    const { container } = render(
      <TradeCheckMoves check={check} give={1} get={2} roster={roster} keep={[]} onCut={onCut} />,
    )
    const view = within(container)
    expect(container.textContent).toContain("You'd cut Davion Mitchell")
    expect(container.textContent).toContain("They'd add Ayo Dosunmu")
    fireEvent.click(view.getByRole('button', { name: 'Change' }))
    const sheet = within(view.getByRole('dialog', { name: "Who you'd cut" }))
    expect(sheet.getByText("Engine's pick")).toBeInTheDocument()
    const go = sheet.getByRole('button', { name: 'Cut Mitchell and Re-check' })
    expect(go).toBeDisabled()
    fireEvent.click(sheet.getByRole('radio', { name: /Jalen Green/ }))
    fireEvent.click(sheet.getByRole('button', { name: 'Cut Green and Re-check' }))
    expect(onCut).toHaveBeenCalledWith(4437244)
    expect(view.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape with nothing changed', () => {
    const onCut = vi.fn()
    const { container } = render(
      <TradeCheckMoves check={check} give={1} get={2} roster={roster} keep={[]} onCut={onCut} />,
    )
    const view = within(container)
    fireEvent.click(view.getByRole('button', { name: 'Change' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(view.queryByRole('dialog')).toBeNull()
    expect(onCut).not.toHaveBeenCalled()
  })

  it('says nobody is cut on an even deal', () => {
    const even = { ...check, my_drops: [], my_adds: [], their_drops: [], their_adds: [] } as OfferCheck
    const { container } = render(
      <TradeCheckMoves check={even} give={2} get={2} roster={[]} keep={[]} onCut={vi.fn()} />,
    )
    expect(container.textContent).toBe('Nobody cut · 2 for 2')
  })
})

describe('TradeCheckFlags', () => {
  it('splits a build conflict into category chips that match the table, and names the clear checks', () => {
    const { container } = render(<TradeCheckFlags check={check} />)
    const view = within(container)
    expect(view.getByText('1 of 4 checks')).toBeInTheDocument()
    const chips = [...container.querySelectorAll('.tck-fl-chips li')].map((li) => li.textContent)
    expect(chips[0]).toMatch(/^FG%−\d+ ptsyou win it 73% of weeks now, a strength$/)
    expect(chips[1]).toBe('REB−11 ptsyou win it 62% of weeks now')
    expect(view.getByText(/Clear: injury and durability, small sample, lateral swap\./)).toBeInTheDocument()
  })
})
