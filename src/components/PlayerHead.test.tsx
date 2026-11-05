import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { headshotUrl } from '../lib/league'
import { teamLight } from '../lib/nbaTeams'
import { HeadStack, PlayerHead } from './PlayerHead'

describe('PlayerHead', () => {
  it('loads the ESPN headshot lazily', () => {
    const { container } = render(<PlayerHead player={{ id: 4432158, name: 'Kyshawn George' }} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe(headshotUrl(4432158))
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('alt')).toBe('')
  })

  it('falls back to a silhouette when the photo is missing', () => {
    const { container } = render(<PlayerHead player={{ id: 1, name: 'Payton Pritchard' }} />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.head-sil')).not.toBeNull()
    expect(container.textContent).toBe('')
  })

  it("lights the face with the player's NBA team colour", () => {
    const { container } = render(<PlayerHead player={{ id: 1, name: 'Giannis' }} team="MIA" />)
    const head = container.querySelector<HTMLElement>('.head')!
    expect(head.classList.contains('head-team')).toBe(true)
    expect(head.style.getPropertyValue('--tc')).toBe(teamLight('MIA'))
  })

  it('leaves a free agent unlit', () => {
    const { container } = render(<PlayerHead player={{ id: 1, name: 'Free Agent' }} team="" />)
    expect(container.querySelector('.head-team')).toBeNull()
  })

  it('stacks at most three faces', () => {
    const players = [1, 2, 3, 4].map((id) => ({ id, name: `Player ${id}` }))
    const { container } = render(<HeadStack players={players} />)
    expect(container.querySelectorAll('.head')).toHaveLength(3)
  })
})
