import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { reportError } from '../lib/errorReport'
import './CrashScreen.css'

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

/** Catches a screen that fails to draw: reports it and offers a way back instead of a blank page. */
export class CrashScreen extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('crash', error, info.componentStack ?? '')
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <main className="crash-page">
        <div className="card error stack crash-card" role="alert">
          <h2>Something broke on this page</h2>
          <p>It's been reported, so it can be fixed. Reloading usually gets you going again.</p>
          <div className="row">
            <button onClick={() => window.location.reload()}>Reload</button>
            <button className="secondary" onClick={() => window.location.assign('/')}>
              Back to my leagues
            </button>
          </div>
        </div>
      </main>
    )
  }
}
