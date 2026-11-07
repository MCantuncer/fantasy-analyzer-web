import { Bone } from './Skeleton'
import { percent } from '../lib/progress'
import { Spinner } from './Spinner'
import './TradesPending.css'

/** Where the run is while the page shows free agents and trades are still screened. */
export interface TradesStatus {
  progress: number
  /** False once the run has stopped without finishing (it failed or was cancelled). */
  running: boolean
}

function Status({ status, onRetry }: { status: TradesStatus; onRetry: () => void }) {
  if (!status.running) {
    return (
      <p className="tp-status small" role="status">
        <span className="muted">Trades didn't finish.</span>{' '}
        <button type="button" className="link" onClick={onRetry}>
          Try again
        </button>
      </p>
    )
  }
  return (
    <div className="tp-status small" role="status">
      <Spinner />
      <span className="muted">Screening trades</span>
      <span className="tnum tp-pct">{percent(status.progress)}</span>
    </div>
  )
}

/** The trade list's place while trades are screened: its heading, where the run is, and placeholder rows. */
export function TradesPending({ status, onRetry }: { status: TradesStatus; onRetry: () => void }) {
  return (
    <section className="card flush trades-panel tp-panel" aria-labelledby="trades-title" aria-busy={status.running}>
      <div className="card-head">
        <h2 id="trades-title">Trades to offer</h2>
        <Status status={status} onRetry={onRetry} />
      </div>
      <ol className="tp-rows" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="tp-row">
            <Bone w={28} h={28} round />
            <span className="tp-lines">
              <Bone w={`${62 - i * 7}%`} h={12} />
              <Bone w={`${40 - i * 4}%`} h={10} />
            </span>
            <Bone w={44} h={18} />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Best Move weighs trades against free agents, so it waits for the trades. */
export function BestMovePending({ status, onRetry }: { status: TradesStatus; onRetry: () => void }) {
  return (
    <section className="card best tp-best" aria-labelledby="tp-best-title" aria-busy={status.running}>
      <header className="bm-head tp-best-head">
        <h2 className="bm-title" id="tp-best-title">
          Best move
        </h2>
        <Status status={status} onRetry={onRetry} />
      </header>
      <p className="small muted tp-best-note">Weighing trades against your free agent targets.</p>
      <div className="tp-best-bones" aria-hidden="true">
        <Bone w="58%" h={18} />
        <Bone w="84%" h={10} />
        <Bone w="70%" h={10} />
      </div>
    </section>
  )
}
