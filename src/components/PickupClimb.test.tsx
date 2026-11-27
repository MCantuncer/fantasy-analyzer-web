import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { climb } from '../lib/climb'
import { P } from '../test/newsSince'
import { evenLabelTop } from '../lib/climbLabels'
import { PickupClimb } from './PickupClimb'

afterEach(cleanup)

const draw = (before: number, after: number, others: number[] = [], lanes = true) =>
  render(<PickupClimb add={P.lopez} drop={P.mitchell} before={before} after={after} others={others} lanes={lanes} />)
    .container

describe('PickupClimb, calm', () => {
  it('draws no grid and no tick labels, only the 50% line with its label', () => {
    const c = draw(0.56, 0.57, [0.57])
    expect(c.querySelector('.pclimb-tick')).toBeNull()
    expect(c.querySelector('.pclimb-grid')).toBeNull()
    expect(c.querySelectorAll('.pclimb-even')).toHaveLength(1)
    expect(c.querySelector('.pclimb-even-label')?.textContent).toBe('50% · even odds')
    expect(c.querySelector('.pclimb-zoom')?.textContent).toBe('zoomed to 45–65%')
  })

  it('says today at the now dot and the after odds with the ▲ chip at the end', () => {
    const c = draw(0.56, 0.57, [0.57])
    expect(c.querySelector('.pclimb-now')?.textContent).toBe('56%today')
    expect(c.querySelector('.pclimb-pct')?.textContent).toBe('57%')
    expect(c.querySelector('.tt-chip')?.textContent).toBe('▲+1 pts')
    expect(c.querySelector('.pclimb-end-fig .head')).not.toBeNull()
    expect(c.querySelector('.pclimb-fade')).not.toBeNull()
  })

  it('captions the faint strands in one line, counting the pickups', () => {
    expect(draw(0.56, 0.57, [0.57]).querySelector('.pclimb-cap')?.textContent).toBe(
      'Faint: the 1 other pickup checked today',
    )
    expect(draw(0.56, 0.6, []).querySelector('.pclimb-cap')).toBeNull()
  })

  it('reads the move as one sentence for screen readers', () => {
    expect(draw(0.56, 0.57).querySelector('.sr-only')?.textContent).toBe(
      'Your playoff odds go from 56% today to 57% with Brook Lopez for Davion Mitchell, up 1 points.',
    )
  })

  it('leaves the Add and Drop lanes to the card when asked', () => {
    const withLanes = draw(0.56, 0.57)
    expect(withLanes.querySelectorAll('.pclimb-who')).toHaveLength(2)
    expect(withLanes.querySelector('.pclimb-start .head')).not.toBeNull() // the dropped player keeps a face
    const bare = draw(0.56, 0.57, [], false)
    expect(bare.querySelector('.pclimb-who')).toBeNull()
    expect(bare.querySelector('.pclimb-head')?.textContent).toContain('Your playoff odds')
  })
})

describe('evenLabelTop', () => {
  it('puts "50% · even odds" just under its line at the right end', () => {
    const c = climb({ before: 0.56, after: 0.57, others: [] })
    expect(evenLabelTop(c)).toBe(c.even! + 6)
  })

  it('goes above the line when a strand gain sits under it', () => {
    // From 40% the strands end around 48%, right under the 50% line.
    const c = climb({ before: 0.4, after: 0.6, others: [0.48] })
    const g = c.groups.find((x) => x.pct === 48)
    expect(g).toBeDefined()
    expect(evenLabelTop(c)).toBe(c.even! - 6 - 16)
  })

  it('is left out with no 50% line in the window', () => {
    expect(evenLabelTop(climb({ before: 0.8, after: 0.85, others: [] }))).toBeNull()
  })
})
