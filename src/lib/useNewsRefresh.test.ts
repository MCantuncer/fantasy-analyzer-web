import { describe, expect, it } from 'vitest'
import type { NewsStory } from '../api/client'
import { changesSince } from './useNewsRefresh'

const s = (id: string, updated_at: string) => ({ id, updated_at }) as NewsStory

describe('changesSince', () => {
  const seen = new Map([
    ['a', '2026-11-07T10:00:00Z'],
    ['b', '2026-11-07T10:00:00Z'],
  ])

  it('counts new stories and stories with a newer source', () => {
    const stories = [s('c', '2026-11-07T10:05:00Z'), s('d', '2026-11-07T10:06:00Z'), s('a', '2026-11-07T10:04:00Z')]
    expect(changesSince(seen, stories)).toEqual({ text: '2 new stories, 1 updated', fresh: true })
  })

  it('says nothing came in when nothing changed', () => {
    expect(changesSince(seen, [s('a', '2026-11-07T10:00:00Z')])).toEqual({ text: 'Nothing new yet', fresh: false })
  })
})
