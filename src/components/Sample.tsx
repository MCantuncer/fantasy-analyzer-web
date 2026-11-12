import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Binoculars, CaretRight, ListNumbers } from '@phosphor-icons/react'
import { fetchSampleTeam } from '../api/client'
import type { SampleIndex, SampleTeam } from '../api/client'
import { ordinal } from '../lib/format'
import { teamColours } from '../lib/league'
import { PRODUCT_NAME, sampleDay } from '../lib/sample'
import { BestMove } from './BestMove'
import { CategoryTiles } from './CategoryTiles'
import { OpenCrest } from './OpenCrest'
import { Outlook } from './Outlook'
import { Bone } from './Skeleton'
import { TeamCrest } from './TeamCrest'
import './Sample.css'

/** "Get my best move": the card's door to your own league. */
function Door({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="bm-actions">
      <button type="button" className="smp-door" onClick={onJoin}>
        <OpenCrest />
        <span className="smp-door-text">
          <span className="smp-door-main">Get my best move</span>
          <span className="smp-door-sub">Your ESPN league, your team</span>
        </span>
      </button>
    </div>
  )
}

/** The dated line under the intro: what the data is, when it was analysed, and how the sample works. */
function DataLine({ index }: { index: SampleIndex }) {
  const [how, setHow] = useState(false)
  const day = sampleDay(index.analysed_on)
  return (
    <>
      <p className="smp-data">
        Below: a real ESPN 9-cat league, team names masked.{' '}
        {index.phase === 'offseason' ? (
          <>
            From <b>{day}</b>, last season. New moves start once the season tips off.
          </>
        ) : (
          <>
            Analysed <b>{day}</b>.{!index.fresh && " Today's run is late."}
          </>
        )}{' '}
        <button
          type="button"
          className="link smp-how-toggle"
          aria-expanded={how}
          aria-controls="smp-how"
          onClick={() => setHow((v) => !v)}
        >
          <span className="smp-how-long">How the sample works</span>
          <span className="smp-how-short">How?</span>
        </button>
      </p>
      {how && (
        <div className="smp-how card" id="smp-how">
          <h2 className="smp-how-title">How the sample works</h2>
          <p>
            One real public ESPN 9-cat league, analysed once a day. Players, stats and odds are real. Team names are
            swapped for basketball play calls, and the league's chat isn't shown. You're scouting one team; pick any
            other under Scout another team.
          </p>
          <p className="small muted">Last run: {day}.</p>
        </div>
      )}
    </>
  )
}

/** Every team in the sample by projected finish, with the playoff line: pick one to scout its best move. */
function ScoutList({
  index,
  scout,
  onScout,
  onJoin,
}: {
  index: SampleIndex
  scout: SampleTeam
  onScout: (id: number) => void
  onJoin: () => void
}) {
  const colours = teamColours(
    index.teams.map((t) => t.id),
    null,
  )
  const spots = index.league.playoff_teams
  const ladder = [...index.teams].sort((a, b) => a.projected_rank - b.projected_rank)
  return (
    <section className="card smp-scout" aria-labelledby="smp-scout-title">
      <h2 className="smp-scout-title" id="smp-scout-title">
        <ListNumbers size={20} aria-hidden="true" />
        Scout another team
      </h2>
      <p className="small muted">
        Every team here gets its own best move. Projected finish; the top {spots} make the playoffs.
      </p>
      <ol className="smp-ladder">
        {ladder.map((t) => {
          const here = t.id === scout.id
          const rank = ordinal(t.projected_rank)
          return (
            <li key={t.id} className={t.projected_rank === spots ? 'smp-rung smp-line' : 'smp-rung'}>
              <button
                type="button"
                className="smp-team"
                aria-current={here ? 'true' : undefined}
                aria-label={`Scout ${t.name}, projected ${rank}${here ? ', scouting now' : ''}${t.has_move ? '' : ', no move today'}`}
                onClick={() => onScout(t.id)}
              >
                <span className="smp-rank num">{t.projected_rank}</span>
                <TeamCrest name={t.name} colour={colours.get(t.id)} size={24} />
                <span className="smp-team-name">{t.name}</span>
                <span className="smp-team-note small">
                  {here ? (
                    <>
                      <Binoculars size={14} weight="bold" aria-hidden="true" /> Scouting
                    </>
                  ) : t.has_move ? (
                    <>
                      <span className="smp-move-dot" aria-hidden="true" /> Has a move
                    </>
                  ) : (
                    'Hold'
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className="smp-team smp-yours" onClick={onJoin}>
        <OpenCrest size={24} />
        <span className="smp-yours-text">
          <span className="smp-team-name">Your team</span>
          <span className="small muted">Not in this sample. Get its own best move.</span>
        </span>
        <CaretRight size={16} weight="bold" aria-hidden="true" />
      </button>
    </section>
  )
}

/**
 * The sample league for visitors who haven't signed in: a real public league's Moves page, team
 * names masked, scouting one team. The doors open sign-up for your own league.
 */
export function SamplePage({
  index,
  scout,
  onScout,
  onJoin,
}: {
  index: SampleIndex
  scout: SampleTeam
  onScout: (id: number) => void
  onJoin: () => void
}) {
  const report = useQuery({
    queryKey: ['sample-team', scout.id, index.analysed_on],
    queryFn: () => fetchSampleTeam(scout.id, index.analysed_on),
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const [announce, setAnnounce] = useState('')
  // The card's corner light comes from the scouted team's crest, not your warm house light.
  const scoutColour = teamColours(
    index.teams.map((t) => t.id),
    null,
  ).get(scout.id)
  const picked = useRef(false)
  const shown = report.data && report.data.team_id === scout.id ? report.data : null

  // After a pick, say so once the new team's card is on screen, and bring its best move into view.
  useEffect(() => {
    if (!picked.current || !shown) return
    picked.current = false
    setAnnounce(`Now scouting ${scout.name}. Best move updated.`)
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById('moves-best')?.scrollIntoView?.({ behavior: still ? 'auto' : 'smooth', block: 'start' })
  }, [shown, scout.name])

  const pick = (id: number) => {
    if (id === scout.id) return
    picked.current = true
    onScout(id)
  }

  return (
    <div className="stack smp" style={{ gap: 20 }}>
      <header className="smp-intro">
        <p className="smp-lead">
          {PRODUCT_NAME} finds the best move for your ESPN team and shows what it does to your playoff odds.
        </p>
        <DataLine index={index} />
      </header>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="split">
        <div className="wide smp-best" id="moves-best" style={{ '--scout': scoutColour } as CSSProperties}>
          {shown ? (
            <BestMove report={shown} scout={scout.name} actions={<Door onJoin={onJoin} />} />
          ) : report.isError ? (
            <section className="card best">
              <p className="muted">{scout.name}'s moves didn't load. Pick the team again in a moment.</p>
            </section>
          ) : (
            <section className="card best" aria-busy="true" aria-label={`Loading ${scout.name}'s best move`}>
              <div className="stack" style={{ gap: 10 }} aria-hidden="true">
                <Bone w="40%" h={18} />
                <Bone w="84%" h={10} />
                <Bone w="70%" h={10} />
                <Bone w="100%" h={120} />
              </div>
            </section>
          )}
        </div>
        <div className="narrow stack" style={{ gap: 16 }}>
          {shown && <Outlook report={shown} scout={scout.name} />}
          <ScoutList index={index} scout={scout} onScout={pick} onJoin={onJoin} />
        </div>
      </div>
      {shown && <CategoryTiles categories={shown.categories} scout={scout.name} />}
    </div>
  )
}
