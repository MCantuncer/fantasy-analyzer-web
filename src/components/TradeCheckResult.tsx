import { ArrowCounterClockwise, ArrowSquareOut, UsersThree } from '@phosphor-icons/react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { OfferCheck, PlayerRef } from '../api/client'
import type { CheckDeal } from '../lib/tradeCheck'
import { TradeCheckHero } from './TradeCheckHero'
import { TradeCheckTables } from './TradeCheckTables'

const names = (ps: PlayerRef[]) => ps.map((p) => p.name).join(' and ')

/** Who else moves to make the deal fit: your cut or pickup, and their likely cut. */
function rosterLine(c: OfferCheck, give: number, get: number): string {
  const parts: string[] = []
  if (c.my_drops.length) parts.push(`You'd cut ${names(c.my_drops)}`)
  if (c.my_adds.length) parts.push(`you'd add ${names(c.my_adds)} from free agents`)
  if (c.their_drops.length) parts.push(`they'd likely cut ${names(c.their_drops)}`)
  if (c.their_adds.length) parts.push(`they'd add ${names(c.their_adds)}`)
  const shape = `${give} for ${get}`
  if (!parts.length) return `Nobody cut · ${shape}`
  const text = parts.join(' · ')
  return `${text[0].toUpperCase()}${text.slice(1)} · ${shape}`
}

function checkedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  query: UseQueryResult<OfferCheck>
  deal: CheckDeal
  give: PlayerRef[]
  get: PlayerRef[]
  myName: string
  partnerName: string
  partnerColour?: string
  espn: { leagueId: number; season: number; myTeamId: number }
}

/** The check's answer: the hero, who else moves, and the next step for how the trade came about. */
export function TradeCheckResult({ query, deal, give, get, myName, partnerName, partnerColour, espn }: Props) {
  // A desktop re-check keeps the last answer on screen until the new one lands.
  const check = query.data && !query.isPlaceholderData ? query.data : null
  const stale = query.isPlaceholderData ? query.data : null
  const loading = query.isFetching
  const error = query.isError
    ? query.error instanceof Error && query.error.message
      ? query.error.message
      : "The check didn't finish."
    : null
  const shown = check ?? stale ?? null
  const received = deal.mode === 'received'
  const good = shown != null && shown.call !== 'pass'
  const team = (id: number) =>
    `https://fantasy.espn.com/basketball/team?leagueId=${espn.leagueId}&teamId=${id}&seasonId=${espn.season}`

  const counter = (
    <button type="button" className="secondary tck-counter" disabled>
      <ArrowCounterClockwise size={18} aria-hidden="true" /> Counter Offer <span className="tck-soon">Coming next</span>
    </button>
  )
  const actions = shown ? (
    received ? (
      good ? (
        <>
          <a className="button tck-cta" href={team(espn.myTeamId)} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={18} aria-hidden="true" /> Accept on ESPN
          </a>
          {counter}
        </>
      ) : (
        <>
          {counter}
          <a className="button secondary tck-cta" href={team(espn.myTeamId)} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={18} aria-hidden="true" /> Open on ESPN
          </a>
        </>
      )
    ) : (
      <>
        {!good && counter}
        <a
          className={`button${good ? '' : ' secondary'} tck-cta`}
          href={team(deal.partner!)}
          target="_blank"
          rel="noreferrer"
        >
          <ArrowSquareOut size={18} aria-hidden="true" /> Propose on ESPN
        </a>
        {good && counter}
      </>
    )
  ) : null

  return (
    <div className="tck-result">
      <TradeCheckHero
        check={shown && !loading ? { ...shown, direction: deal.mode } : null}
        give={give}
        get={get}
        myName={myName}
        partnerName={partnerName}
        partnerColour={partnerColour}
        loading={loading}
        error={error}
        onRetry={() => query.refetch()}
      />
      {shown && !loading && (
        <>
          <p className="tck-roster-line">
            <UsersThree size={18} aria-hidden="true" />
            <span>{rosterLine(shown, give.length, get.length)}</span>
          </p>
          <div className="tck-actions">{actions}</div>
          <TradeCheckTables check={shown} myName={myName} partnerName={partnerName} partnerColour={partnerColour} />
          <p className="tck-stamp num">
            {shown.sims.toLocaleString('en-US')} seasons · checked {checkedAt(shown.generated_at)}
          </p>
        </>
      )}
    </div>
  )
}
