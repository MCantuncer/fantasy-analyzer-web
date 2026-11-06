import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { clearPages, KEEP_MS, restorePages, savePages } from './pageCache'

afterEach(() => localStorage.clear())

const NEWS = ['news', 1, 2027, false, null]

describe('page cache', () => {
  it('saves a page when it loads and puts it back in a new session', async () => {
    const qc = new QueryClient()
    const stop = savePages(qc, () => false)
    await qc.fetchQuery({ queryKey: NEWS, queryFn: async () => ({ stories: ['a'] }) })
    stop()

    const next = new QueryClient()
    restorePages(next)
    expect(next.getQueryData(NEWS)).toEqual({ stories: ['a'] })
    // Restored as of when it was fetched, so the page still refreshes it.
    expect(next.getQueryState(NEWS)?.dataUpdatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('keeps only the first week of League Chat', async () => {
    const qc = new QueryClient()
    savePages(qc, () => false)
    await qc.fetchInfiniteQuery({
      queryKey: ['feed', 1, 2027],
      queryFn: async ({ pageParam }) => ({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (last: { page: number }) => last.page + 1,
      pages: 2,
    })
    const next = new QueryClient()
    restorePages(next)
    expect(next.getQueryData(['feed', 1, 2027])).toEqual({ pages: [{ page: 0 }], pageParams: [0] })
  })

  it('never saves a private league, and forgets everything on sign-out', async () => {
    const qc = new QueryClient()
    const stop = savePages(qc, () => true)
    await qc.fetchQuery({ queryKey: NEWS, queryFn: async () => ({ stories: [] }) })
    stop()
    expect(localStorage.length).toBe(0)

    savePages(qc, () => false)
    await qc.fetchQuery({ queryKey: ['score-games', 1], queryFn: async () => ({ games: [] }), staleTime: 0 })
    expect(localStorage.length).toBe(1)
    clearPages()
    expect(localStorage.length).toBe(0)
  })

  it('drops pages older than a few hours', async () => {
    const qc = new QueryClient()
    savePages(qc, () => false)
    await qc.fetchQuery({ queryKey: NEWS, queryFn: async () => ({ stories: [] }) })
    const next = new QueryClient()
    restorePages(next, Date.now() + KEEP_MS + 1)
    expect(next.getQueryData(NEWS)).toBeUndefined()
  })

  it("doesn't save other queries", async () => {
    const qc = new QueryClient()
    savePages(qc, () => false)
    await qc.fetchQuery({ queryKey: ['overview', 1], queryFn: async () => ({}) })
    expect(localStorage.length).toBe(0)
  })
})
