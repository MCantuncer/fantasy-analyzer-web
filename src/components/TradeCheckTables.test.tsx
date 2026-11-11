import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OfferCheck } from '../api/client'
import { weekSpan } from '../lib/tradeCheck'
import sample from '../test/offer-check-1for2.json'
import { TradeCheckTables } from './TradeCheckTables'

const check = sample as unknown as OfferCheck

describe('TradeCheckTables', () => {
  it('lists categories in the fixed order, with screen-reader cells and punts faded', () => {
    const { container } = render(<TradeCheckTables check={check} myName="Kucukesat Aspavas" partnerName="Horns" />)
    const [cats] = within(container).getAllByRole('table')
    const rows = within(cats)
      .getAllByRole('rowheader')
      .map((th) => th.firstChild?.textContent)
    expect(rows).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    expect(within(cats).getByText('FT%, You: 14 to 21 percent, up 7, punted.')).toBeInTheDocument()
    expect(within(cats).getByText('REB, You: 62 to 51 percent, down 11.')).toBeInTheDocument()
    expect(within(cats).getByLabelText('fewer turnovers wins')).toBeInTheDocument()
    expect(container.querySelectorAll('.tck-tb-cell.me.punt')).toHaveLength(3)
    expect(container.querySelectorAll('.tck-tb-cell.them.punt')).toHaveLength(0)
  })

  it('shows playoff weeks to one decimal and the finish with lower as better', () => {
    const { container } = render(<TradeCheckTables check={check} myName="K" partnerName="Horns" />)
    const [, weeks] = within(container).getAllByRole('table')
    expect(within(weeks).getByText('Mar 1–7')).toBeInTheDocument()
    expect(within(weeks).getByText('You: 3.5 to 3.9, up 0.4.')).toBeInTheDocument()
    expect(within(weeks).getByText('You: 6.7 to 6.0, up 0.7.')).toBeInTheDocument()
  })

  it('formats week spans across months', () => {
    expect(weekSpan('2027-03-29', '2027-04-04')).toBe('Mar 29–Apr 4')
    expect(weekSpan('bad', '2027-04-04')).toBe('')
  })
})
