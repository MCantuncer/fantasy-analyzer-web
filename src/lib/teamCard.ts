import { useSyncExternalStore } from 'react'
import { fetchNbaTeam, type LeagueRef } from '../api/client'
import type { Credentials } from './credentials'

// The NBA team card opened from the header search. One at a time; a player card opened from its
// roster sits on top of it ("card on card"). A module store, like the player card's.
let abbrev: string | null = null
let opener: HTMLElement | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Opens a team's card, remembering where focus was so closing it goes back there. */
export function openTeamCard(team: string) {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  abbrev = team.toUpperCase()
  emit()
}

export function closeTeamCard() {
  abbrev = null
  emit()
  opener?.focus({ preventScroll: true })
  opener = null
}

/** The open team's abbreviation, or null. */
export function useTeamCardOpen(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => abbrev,
    () => null,
  )
}

// A team's record moves once a night: two minutes keeps a second look instant without going stale.
export function teamQuery(ref: LeagueRef, team: string, creds: Credentials | null) {
  return {
    queryKey: ['nba-team', ref.leagueId, ref.season, team.toUpperCase()],
    queryFn: () => fetchNbaTeam(ref, team, creds),
    retry: false,
    staleTime: 2 * 60_000,
  }
}
