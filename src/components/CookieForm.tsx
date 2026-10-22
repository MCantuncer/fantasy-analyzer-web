import { useState } from 'react'
import type { Credentials } from '../lib/credentials'

interface Props {
  onSubmit: (creds: Credentials, remember: boolean) => void
  onCancel: () => void
}

export function CookieForm({ onSubmit, onCancel }: Props) {
  const [espnS2, setEspnS2] = useState('')
  const [swid, setSwid] = useState('')
  const [remember, setRemember] = useState(false)

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (espnS2.trim() && swid.trim()) onSubmit({ espnS2, swid }, remember)
      }}
    >
      <h2>This league is private</h2>
      <p className="muted">
        ESPN only shares private leagues with members. Paste two cookies from your ESPN login and the analyzer can
        read your league. They are sent with each request, used only to read from ESPN, and never saved on the
        server or logged.
      </p>
      <details>
        <summary>How to find them</summary>
        <ol>
          <li>Log in at fantasy.espn.com on a computer.</li>
          <li>Open DevTools (F12), then Application (Chrome) or Storage (Firefox), then Cookies, then espn.com.</li>
          <li>
            Copy the values of <code>espn_s2</code> and <code>SWID</code>.
          </li>
        </ol>
        <p className="muted">
          These cookies work like a password for your ESPN fantasy account. Only paste them into sites you trust.
          Logging out of ESPN makes them stop working.
        </p>
      </details>
      <label>
        espn_s2
        <input value={espnS2} onChange={(e) => setEspnS2(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <label>
        SWID
        <input
          value={swid}
          onChange={(e) => setSwid(e.target.value)}
          placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="row">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember on this device
      </label>
      <div className="row">
        <button type="submit" disabled={!espnS2.trim() || !swid.trim()}>
          Load league
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  )
}
