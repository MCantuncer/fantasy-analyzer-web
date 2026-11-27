import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library's automatic cleanup never registers. Unmount every
// render after each test, or a polling query can update React after jsdom is gone and fail the run
// with an unhandled "window is not defined".
afterEach(() => {
  cleanup()
})
