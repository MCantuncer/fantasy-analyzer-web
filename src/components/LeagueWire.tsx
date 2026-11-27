import type { LeagueOverview } from '../api/client'
import { YourCrest } from './YourCrest'
import './LeagueWire.css'

/** League → "On the wire": the week's three league facts as bare lines (FAAB, waiver claims, trades). */
export function LeagueWire({
  pulse,
  nameOf,
  colours,
  myTeamId,
}: {
  pulse: LeagueOverview['pulse']
  nameOf: (id: number) => string
  colours: Map<number, string>
  myTeamId: number | null
}) {
  const leader = pulse.faab_leader_id
  return (
    <section className="lwr-wire" aria-labelledby="lwr-title">
      <h3 id="lwr-title" className="lwr-h">
        On the wire
      </h3>
      <ul className="lwr-facts">
        <li>
          {leader != null ? (
            <>
              <b className="num">${pulse.faab_leader_spent ?? 0}</b>
              <span>top FAAB spend</span>
              <span className="lwr-team">
                <YourCrest name={nameOf(leader)} colour={colours.get(leader)} size={18} mine={leader === myTeamId} />
                {nameOf(leader)}
              </span>
            </>
          ) : (
            <span>No FAAB spent yet</span>
          )}
        </li>
        <li>
          <b className="num">{pulse.claims_last_7_days}</b>
          <span>waiver {pulse.claims_last_7_days === 1 ? 'claim' : 'claims'}, last 7 days</span>
        </li>
        <li>
          <b className="num">{pulse.trades_this_season}</b>
          <span>{pulse.trades_this_season === 1 ? 'trade' : 'trades'} this season</span>
        </li>
      </ul>
    </section>
  )
}
