import { describe, expect, it } from 'vitest'
import { parseVersionFromFilename } from '../../src/shared/version'

describe('parseVersionFromFilename (shared)', () => {
  it('estrae la versione dai filename dei tool', () => {
    expect(parseVersionFromFilename('phi_v6_12.html')).toBe('6.12')
    expect(parseVersionFromFilename('PriceList_v2_4.html')).toBe('2.4')
    expect(parseVersionFromFilename('LightCalc_Road_v0_4.html')).toBe('0.4')
    expect(parseVersionFromFilename('EHub_v3_5_0.html')).toBe('3.5.0')
  })
  it('ignora il caso dell\'estensione e ritorna null senza versione', () => {
    expect(parseVersionFromFilename('phi_v6_12.HTML')).toBe('6.12')
    expect(parseVersionFromFilename('readme.html')).toBeNull()
  })
})
