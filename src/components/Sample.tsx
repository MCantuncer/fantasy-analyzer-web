import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Binoculars, CaretDown, CaretRight, Info, ListNumbers, Target } from '@phosphor-icons/react'
import { fetchSampleTeam } from '../api/client'
import type { SampleIndex, SampleTeam } from '../api/client'
import { ordinal } from '../lib/format'
import { teamColours } from '../lib/league'
import { PRODUCT_NAME, sampleDay } from '../lib/sample'
import { BestMove } from './BestMove'
import { CategoryTiles } from './CategoryTiles'
import { OpenCrest } from './OpenCrest'
import { SeasonBand } from './Outlook'
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
        </span>
      </button>
    </div>
  )
}

/** The page head, as on the other pages: "Sample league", a dated meta line, and a bare "How it works"
    that opens the product sentence and how the sample is made. The best move is the first thing read. */
function SampleHead({ index }: { index: SampleIndex }) {
  const [how, setHow] = useState(false)
  const day = sampleDay(index.analysed_on)
  const offseason = index.phase === 'offseason'
  return (
    <header className="smp-head">
      <div className="smp-head-l">
        <h1 className="smp-title">Sample league</h1>
        <p className="smp-meta">
          A real ESPN 9-cat league, team names masked ·{' '}
          {offseason ? (
            <>
              from <b>{day}</b>, last season
            </>
          ) : (
            <>
              analysed <b>{day}</b>
              {!index.fresh && " · today's run is late"}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        className="smp-how-toggle"
        aria-expanded={how}
        aria-controls="smp-how"
        onClick={() => setHow((v) => !v)}
      >
        <Info size={14} aria-hidden="true" />
        <span>How it works</span>
        <CaretDown size={14} className="smp-how-caret" aria-hidden="true" />
      </button>
      <div className="smp-how" id="smp-how" hidden={!how}>
        <p>
          {PRODUCT_NAME} finds the best move for your ESPN team and shows what it does to your playoff odds. This is
          one real public ESPN 9-cat league, analysed once a day. Players, stats and odds are real; team names are
          swapped for play calls and the chat isn't shown. Pick any team below to scout its move.
        </p>
        {offseason && <p>New moves start once the season tips off.</p>}
      </div>
    </header>
  )
}

/**
 * Every team in the sample by projected finish, with the playoff line as a seam after the last team
 * in: pick one to scout its best move. Wide screens: a rail of all the teams across. Phones: rows.
 */
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
  const seam = spots > 0 && spots < ladder.length
  // Wide screens lay the teams out across, with a 2px column for the seam after the last team in.
  const rail = seam
    ? `repeat(${spots}, minmax(0, 1fr)) 2px repeat(${ladder.length - spots}, minmax(0, 1fr))`
    : `repeat(${ladder.length}, minmax(0, 1fr))`
  return (
    <section className="smp-scout" aria-labelledby="smp-scout-title">
      <h2 className="smp-scout-title" id="smp-scout-title">
        <ListNumbers size={20} aria-hidden="true" />
        Scout another team
      </h2>
      <ol className="smp-ladder" style={{ '--smp-rail': rail } as CSSProperties}>
        {ladder.map((t) => {
          const here = t.id === scout.id
          const rank = ordinal(t.projected_rank)
          return (
            <Fragment key={t.id}>
              <li className="smp-rung">
                <button
                  type="button"
                  className="smp-team"
                  aria-current={here ? 'true' : undefined}
                  aria-label={`Scout ${t.name}, projected ${rank}${t.projected_rank === spots ? ', last playoff spot' : ''}${here ? ', scouting now' : ''}${t.has_move ? '' : ', no move today'}`}
                  onClick={() => onScout(t.id)}
                >
                  <span className="smp-rank num">{t.projected_rank}</span>
                  <TeamCrest name={t.name} colour={colours.get(t.id)} size={28} />
                  <span className="smp-team-name">{t.name}</span>
                  <span className="smp-team-note">
                    {here ? (
                      <>
                        <Binoculars size={14} weight="bold" aria-hidden="true" /> Scouting
                      </>
                    ) : t.has_move ? (
                      'Has a move'
                    ) : (
                      'Hold'
                    )}
                  </span>
                </button>
              </li>
              {seam && t.projected_rank === spots && (
                <li className="smp-seam" aria-hidden="true">
                  <span>Playoff line</span>
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
      <button type="button" className="smp-yours" onClick={onJoin}>
        <OpenCrest size={24} />
        <span className="smp-yours-text">
          <span className="smp-yours-name">Your team</span>
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
    document.getElementById('moves-best')?.scrollIntoView?.({
      behavior: still ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [shown, scout.name])

  const pick = (id: number) => {
    if (id === scout.id) return
    picked.current = true
    onScout(id)
  }

  return (
    <div className="stack smp" style={{ gap: 20 }}>
      <SampleHead index={index} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="smp-best" id="moves-best" style={{ '--scout': scoutColour } as CSSProperties}>
        {shown ? (
          <BestMove
            report={shown}
            scout={scout.name}
            actions={<Door onJoin={onJoin} />}
            foot={<SeasonBand report={shown} scout={scout.name} />}
          />
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
      {shown && <CategoryTiles categories={shown.categories} scout={scout.name} />}
      <ScoutList index={index} scout={scout} onScout={pick} onJoin={onJoin} />
      <Dock onJoin={onJoin} />
    </div>
  )
}

/** Phones: a bottom bar with the sample's two places and, after a hairline, the door to your own league. */
function Dock({ onJoin }: { onJoin: () => void }) {
  const go = (id: string) => () => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView?.({
      behavior: still ? 'auto' : 'smooth',
      block: 'start',
    })
  }
  return (
    <nav className="smp-dock" aria-label="Sample league">
      <button type="button" className="smp-dock-item" onClick={go('moves-best')}>
        <Target size={22} aria-hidden="true" />
        <span>Best move</span>
      </button>
      <button type="button" className="smp-dock-item" onClick={go('smp-scout-title')}>
        <Binoculars size={22} aria-hidden="true" />
        <span>Scout</span>
      </button>
      <span className="smp-dock-rule" aria-hidden="true" />
      <button
        type="button"
        className="smp-dock-item smp-dock-mine"
        aria-label="My league: get your own best move"
        onClick={onJoin}
      >
        <OpenCrest size={22} />
        <span>My league</span>
      </button>
    </nav>
  )
}
