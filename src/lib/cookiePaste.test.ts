import { describe, expect, it } from 'vitest'
import { parseCookiePaste } from './cookiePaste'

const S2 = 'AEBx%2Bk9Q' + 'a1B2c3D4e5'.repeat(20) + '%3D'
const GUID = '0A1B2C3D-4E5F-6789-ABCD-EF0123456789'

describe('parseCookiePaste', () => {
  it('reads a Cookie header', () => {
    expect(parseCookiePaste(`region=unknown; SWID={${GUID}}; espn_s2=${S2}; country=tr`)).toEqual({
      espnS2: S2,
      swid: `{${GUID}}`,
    })
  })

  it('reads rows copied from the DevTools cookie table', () => {
    const rows = `espn_s2\t${S2}\t.espn.com\t/\t2027-11-01\nSWID\t{${GUID.toLowerCase()}}\t.espn.com\t/`
    expect(parseCookiePaste(rows)).toEqual({ espnS2: S2, swid: `{${GUID}}` })
  })

  it('takes bare values and adds braces to the SWID', () => {
    expect(parseCookiePaste(`${S2}\n${GUID}`)).toEqual({ espnS2: S2, swid: `{${GUID}}` })
  })

  it('finds nothing in unrelated text', () => {
    expect(parseCookiePaste('hello there')).toEqual({ espnS2: null, swid: null })
  })

  it('finds only the SWID when that is all there is', () => {
    expect(parseCookiePaste(`{${GUID}}`)).toEqual({ espnS2: null, swid: `{${GUID}}` })
  })
})
