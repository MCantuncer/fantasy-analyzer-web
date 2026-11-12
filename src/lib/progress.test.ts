import { describe, expect, it } from 'vitest'
import { wordStates } from './progress'

// Index order: C O U R T
describe('wordStates (COURT on the loading screen)', () => {
  it('pulses C while the server wakes', () => {
    expect(wordStates(true, 0, '', 0)).toEqual(['running', 'pending', 'pending', 'pending', 'pending'])
  })

  it('lands C, then R, U, O and T as the analysis moves on', () => {
    expect(wordStates(false, 1, 'Reading rosters', 0.02)).toEqual(['landed', 'pending', 'pending', 'running', 'pending'])
    expect(wordStates(false, 2, 'Screening free agents', 0.1)).toEqual(['landed', 'pending', 'running', 'landed', 'pending'])
    expect(wordStates(false, 3, 'Screening trades', 0.4)).toEqual(['landed', 'running', 'landed', 'landed', 'pending'])
    expect(wordStates(false, 3, 'Screening edge trades', 0.75)).toEqual(['landed', 'landed', 'landed', 'landed', 'running'])
    expect(wordStates(false, 3, 'Screening vision trades', 0.99)).toEqual(['landed', 'landed', 'landed', 'landed', 'landed'])
  })

  it('never lands a word before the one ahead of it', () => {
    // a late progress number with an early stage still lands in order
    expect(wordStates(false, 1, 'Loading your league', 0.8)).toEqual(['landed', 'pending', 'pending', 'running', 'pending'])
  })
})
