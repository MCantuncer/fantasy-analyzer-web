import { ArrowCounterClockwise, ArrowSquareOut } from '@phosphor-icons/react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { OfferCheck, PlayerRef } from '../api/client'
import type { CheckDeal } from '../lib/tradeCheck'
import { TradeCheckHero } from './TradeCheckHero'
import { TradeCheckFlags } from './TradeCheckFlags'
import { TradeCheckMoves } from './TradeCheckMoves'
import { TradeCheckTables } from './TradeCheckTables'

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
  /** Your roster and keepers, for the cut sheet. */
  roster: PlayerRef[]
  keep: number[]
  onCut: (id: number) => void
}

/** The check's answer: the hero, who else moves, and the next step for how the trade came about. */
export function TradeCheckResult({
  query,
  deal,
  give,
  get,
  myName,
  partnerName,
  partnerColour,
  espn,
  roster,
  keep,
  onCut,
}: Props) {
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
          <TradeCheckMoves
            check={shown}
            give={give.length}
            get={get.length}
            roster={roster}
            keep={keep}
            onCut={onCut}
          />
          <div className="tck-actions">{actions}</div>
          <TradeCheckTables check={shown} myName={myName} partnerName={partnerName} partnerColour={partnerColour} />
          <TradeCheckFlags check={shown} />
          <p className="tck-stamp num">
            {shown.sims.toLocaleString('en-US')} seasons · checked {checkedAt(shown.generated_at)}
          </p>
        </>
      )}
    </div>
  )
}
