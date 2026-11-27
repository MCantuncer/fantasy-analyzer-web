import { ChartBar } from '@phosphor-icons/react'
import type { TeamBuild } from '../api/client'
import { stripCategories } from '../lib/catStrip'
import { teamColours } from '../lib/league'
import { CatStripRank, CatStripRankHead } from './CatStripRank'
import { YourCrest } from './YourCrest'
import './Builds.css'

/**
 * League builds: every team's weekly rank in each category as CatStrip `rank` bars (up is strong,
 * down is weak), its expected categories won a week, and its likely punts in words. Best first.
 */
export function Builds({
  builds,
  categories,
  myTeamId,
}: {
  builds: TeamBuild[]
  categories: string[]
  myTeamId: number
}) {
  const n = builds.length
  const cats = stripCategories(categories)
  const colours = teamColours(
    builds.map((b) => b.team_id),
    myTeamId,
  )
  const sorted = [...builds].sort((a, b) => b.expected_cats_won - a.expected_cats_won)
  return (
    <section className="bd" aria-labelledby="builds-title">
      <h2 className="bd-h" id="builds-title">
        <ChartBar className="bd-h-ic" aria-hidden="true" />
        League builds
      </h2>
      <div className="bd-g bd-hd" aria-hidden="true">
        <span className="bd-tm">Team</span>
        <CatStripRankHead categories={cats} />
        <span className="bd-cw" title="Expected categories won per week against an average opponent">
          Cats a week
        </span>
        <span className="bd-pu">Likely punts</span>
      </div>
      <ol className="bd-list">
        {sorted.map((b) => {
          const mine = b.team_id === myTeamId
          const punts = cats.filter((c) => b.weak.includes(c))
          return (
            <li key={b.team_id} className={`bd-g bd-r${mine ? ' mine' : ''}`}>
              <span className="bd-tm">
                <YourCrest name={b.team_name} colour={colours.get(b.team_id)} size={22} mine={mine} />
                <span className="bd-nm">{b.team_name}</span>
              </span>
              <CatStripRank
                ranks={b.ranks}
                weak={b.weak}
                n={n}
                categories={cats}
                label={`${b.team_name}: weekly rank in each category`}
              />
              <span className="bd-cw">
                <b className="num">{b.expected_cats_won.toFixed(2)}</b>
                <span className="bd-cw-w"> cats a week</span>
              </span>
              <span className={`bd-pu${punts.length ? '' : ' bd-none'}`}>
                {punts.length ? (
                  <>
                    <span className="bd-pu-w">Punts </span>
                    {punts.join(' · ')}
                  </>
                ) : (
                  <span aria-label="No likely punt">–</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
