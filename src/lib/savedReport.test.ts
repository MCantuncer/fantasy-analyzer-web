import { afterEach, describe, expect, it } from 'vitest'
import type { AnalysisReport } from '../api/client'
import { clearSavedReports, FRESH_MS, KEEP_MS, loadSavedReport, saveReport } from './savedReport'

const report = { team_id: 3, league: { id: 744, season: 2027 } } as unknown as AnalysisReport
const T = 1_000_000_000_000

describe('saved analysis report', () => {
  afterEach(() => localStorage.clear())

  it('reuses a just-finished report without running again', () => {
    saveReport(744, 3, [2, 1], report, T)
    expect(loadSavedReport(744, 3, 2027, [1, 2], T + 60_000)).toEqual({ report, fresh: true })
  })

  it('shows an older report but asks for a fresh run', () => {
    saveReport(744, 3, [], report, T)
    expect(loadSavedReport(744, 3, 2027, [], T + FRESH_MS + 1)?.fresh).toBe(false)
    expect(loadSavedReport(744, 3, 2027, [], T + KEEP_MS + 1)).toBeNull()
  })

  it('ignores a report made with other keepers, another season or another team', () => {
    saveReport(744, 3, [1], report, T)
    expect(loadSavedReport(744, 3, 2027, [], T)).toBeNull()
    expect(loadSavedReport(744, 3, 2026, [1], T)).toBeNull()
    expect(loadSavedReport(744, 4, 2027, [1], T)).toBeNull()
    expect(loadSavedReport(744, 3, null, [1], T)).not.toBeNull()
  })

  it('survives broken storage and is wiped on sign-out', () => {
    localStorage.setItem('analysis:744:3', '{not json')
    expect(loadSavedReport(744, 3, 2027, [], T)).toBeNull()
    saveReport(744, 3, [], report, T)
    localStorage.setItem('keep:744:3', '[]')
    clearSavedReports()
    expect(loadSavedReport(744, 3, 2027, [], T)).toBeNull()
    expect(localStorage.getItem('keep:744:3')).toBe('[]')
  })
})
