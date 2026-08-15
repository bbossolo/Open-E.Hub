import { describe, it, expect } from 'vitest'
import { isMetel, parseMetel } from '../../src/tools/miu/engine/parsers/metel'

const HEADER = 'LISTINO METEL       LCF00616871208LS01222022030120230320APPARECCHI ILLUMINANTI'.padEnd(177)
// record reale LUCIFEROS (prezzo listino 13,00 € · UM PCE)
const REC = 'LCFLT3410.CC       0000000000000?cassaforma format 4-10-12v 63 h100mm 100  000010000100001999999D0000000130000000001300000001EURPCE0620220301'.padEnd(177)

describe('METEL LSP', () => {
  it('isMetel riconosce l\'header', () => {
    expect(isMetel(HEADER)).toBe(true)
    expect(isMetel('codice;descrizione;prezzo')).toBe(false)
  })
  it('parsa codice, descrizione, prezzo di listino e UM', () => {
    const { rows } = parseMetel(HEADER + '\n' + REC, { regione: 'LUCIFEROS', anno: '2025' })
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.codice).toBe('LCF.LT3410.CC')
    expect(r.desc_short).toBe('cassaforma format 4-10-12v 63 h100mm 100')   // niente '?' iniziale
    expect(r.prezzo).toBeCloseTo(13.00)
    expect(r.um).toBe('nr')                                                  // PCE → nr
    expect(r.regione).toBe('LUCIFEROS')
  })
  it('scarta righe senza prezzo o non-METEL', () => {
    expect(parseMetel('roba a caso\npiù roba').rows).toHaveLength(0)
  })
})
