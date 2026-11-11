import { ArrowCounterClockwise, ArrowSquareOut } from '@phosphor-icons/react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { OfferCheck, PlayerRef } from '../api/client'
import type { CheckDeal } from '../lib/tradeCheck'
import { useRoundValues } from '../lib/tradeValue'
import { PitchCard } from './PitchCard'
import { ReasonTiles } from './ReasonTiles'
import { TradeCheckHero } from './TradeCheckHero'
import { TradeCheckFlags } from './TradeCheckFlags'
import { TradeCheckMoves } from './TradeCheckMoves'
import { TradeCheckTables } from './TradeCheckTables'

/** Where a counter offer will go: the engine's closest deal they'd say yes to. Not built yet. */
function CounterSlot() {
  return (
    <section className="tck-counter-slot" aria-labelledby="tck-counter-title">
      <div className="tck-counter-head">
        <h3 id="tck-counter-title">Counter Offer</h3>
        <span className="tck-soon">Coming next</span>
      </div>
      <p>The closest version of this deal they'd likely say yes to, checked the same way.</p>
      <div className="tck-counter-slip" aria-hidden="true">
        <span />
        <span />
      </div>
      <button type="button" className="secondary" disabled>
        Find a Counter
      </button>
    </section>
  )
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
  /** League size, for the ranks on the pitch. */
  teams?: number
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
  teams,
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
  const clear = shown?.call === 'take'
  const rounds = useRoundValues()
  const team = (id: number) =>
    `https://fantasy.espn.com/basketball/team?leagueId=${espn.leagueId}&teamId=${id}&seasonId=${espn.season}`

  const counter = (
    <button type="button" className="secondary tck-counter" disabled>
      <ArrowCounterClockwise size={18} aria-hidden="true" /> Counter Offer <span className="tck-soon">Coming next</span>
    </button>
  )
  const espnLink = (href: string, label: string, primary: boolean) => (
    <a className={`button${primary ? '' : ' secondary'} tck-cta`} href={href} target="_blank" rel="noreferrer">
      <ArrowSquareOut size={18} aria-hidden="true" /> {label}
    </a>
  )
  // They already offered it: accept on a good call, or look for a counter. You're sending it: propose,
  // with the counter slot first when the call isn't a clear yes.
  const actions = received ? (
    good ? (
      <>
        {espnLink(team(espn.myTeamId), 'Accept on ESPN', true)}
        {counter}
      </>
    ) : (
      <>
        {counter}
        {espnLink(team(espn.myTeamId), 'Open on ESPN', false)}
      </>
    )
  ) : (
    <>
      {espnLink(team(deal.partner!), 'Propose on ESPN', clear)}
      {clear && counter}
    </>
  )

  return (
    <div className="tck-result">
      <TradeCheckHero
        check={shown ? { ...shown, direction: deal.mode } : null}
        give={give}
        get={get}
        myName={myName}
        partnerName={partnerName}
        partnerColour={partnerColour}
        loading={loading}
        error={error}
        onRetry={() => query.refetch()}
      />
      {shown && (
        <div className={`tck-result-body${loading ? ' stale' : ''}`} aria-busy={loading}>
          {!received && !clear && <CounterSlot />}
          {!received && (
            <section className="tck-pitch" aria-labelledby="tck-pitch-title">
              <h3 id="tck-pitch-title" className={clear ? 'sr-only' : undefined}>
                {clear ? `Your pitch to ${partnerName}` : `If you send it anyway: your pitch to ${partnerName}`}
              </h3>
              <PitchCard
                partner={partnerName}
                colour={partnerColour}
                flap="var(--partner)"
                teams={teams}
                pitch={shown.idea.pitch}
                needs={shown.idea.pitch_needs}
              >
                <ReasonTiles
                  facts={shown.idea.facts}
                  reasons={shown.idea.reasons}
                  title="Why they might say yes"
                  valueGet={shown.idea.value_they_get}
                  valueGive={shown.idea.value_they_give}
                  myCats={shown.idea.my_cats_gain}
                  theirCats={shown.idea.their_cats_gain}
                  rounds={rounds}
                />
              </PitchCard>
            </section>
          )}
          <TradeCheckMoves
            check={shown}
            give={give.length}
            get={get.length}
            roster={roster}
            keep={keep}
            onCut={onCut}
          />
          <div className="tck-actions">{actions}</div>
          {received ? (
            <>
              <TradeCheckTables check={shown} myName={myName} partnerName={partnerName} partnerColour={partnerColour} />
              <TradeCheckFlags check={shown} />
            </>
          ) : (
            <>
              <TradeCheckFlags check={shown} />
              <TradeCheckTables check={shown} myName={myName} partnerName={partnerName} partnerColour={partnerColour} />
            </>
          )}
          <p className="tck-stamp num">
            {shown.sims.toLocaleString('en-US')} seasons · checked {checkedAt(shown.generated_at)}
          </p>
        </div>
      )}
    </div>
  )
}
