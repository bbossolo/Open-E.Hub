import { describe, it, expect } from 'vitest'
import { scoreCable, cableFamily, siglaVariants } from '../../src/tools/miu/engine/cables'

describe('cableFamily', () => {
  it('riconosce le famiglie note', () => {
    expect(cableFamily('FG16OR16')).toBe('FG_R')
    expect(cableFamily('LINEA IN CAVO FG16OR MULTIPOLARE')).toBe('FG_R')
    expect(cableFamily('FG16OM16')).toBe('FG_M')
    expect(cableFamily('FTG16OR MULTIPOLARE')).toBe('FTG')
    expect(cableFamily('CAVO H07RN-F SEZIONE 3X10')).toBe('H07RNF')
    expect(cableFamily('N07V-K')).toBe('N07VK')
  })
  it('null se non riconosciuta', () => {
    expect(cableFamily('LINEA ELETTRICA generica')).toBeNull()
  })
  // Audit prezzari 2026-07-17: sigle trovate in Trento/Campania/Cratere Centro
  // Italia/VdA/Piemonte/Veneto senza famiglia — stesso rischio di FG21M21
  // (nessuna penalità "famiglia diversa" ⇒ match sbagliato su sezione uguale).
  it('FG4OHM1/FTG4OHM1 (antincendio al silicone) distinti da FG_M standard', () => {
    expect(cableFamily('FG4OHM1')).toBe('FG_M4')
    expect(cableFamily('FTG4OHM1')).toBe('FG_M4')
    expect(cableFamily('FG4OHM1')).not.toBe(cableFamily('FG16OM16'))
  })
  it('H07-RN-F (trattino dopo 07) riconosciuto come H07RNF', () => {
    expect(cableFamily('H07-RN-F')).toBe('H07RNF')
  })
  it('H07Z1-K (LSZH tipo 2) distinto da N07V-K', () => {
    expect(cableFamily('H07Z1-K')).toBe('H07Z1K')
    expect(cableFamily('H07Z1-K')).not.toBe(cableFamily('N07V-K'))
  })
  it('cavi MT RG/RFG (12/20kV) riconosciuti e distinti dalle famiglie BT', () => {
    for (const s of ['RG7H1R', 'RG7H1OR', 'RG16H1R12', 'RG26H1M16', 'RG18OM18', 'RFG7ORAR']) {
      expect(cableFamily(s)).toBe('RG_MT')
    }
    expect(cableFamily('RG7H1R')).not.toBe(cableFamily('FG16OR16'))
  })
})

describe('siglaVariants', () => {
  it('aggiunge la radice senza la tensione finale', () => {
    expect(siglaVariants('FG16OR16')).toEqual(expect.arrayContaining(['fg16or16', 'fg16or']))
  })
  it('toglie le parentesi', () => {
    expect(siglaVariants('FG16(O)R16')).toEqual(expect.arrayContaining(['fg16or16', 'fg16or']))
  })
})

describe('scoreCable — caso reale Veneto (FG16OR16 3G10)', () => {
  const item = { sigla: 'FG16OR16', allum: false, form: '3G', sec: 10, desc: 'FG16OR16 3G10' }
  const fgSpaced = { // sezione con spazi + sigla abbreviata → era quello mancato
    codice: 'VEN25-10.01.36.18', desc_short: '',
    declaratoria: 'LINEA IN CAVO FG16OR MULTIPOLARE ISOLATA IN GOMMA G16 Sez. 3 x 10 mmq.', um: 'm', prezzo: 13.17,
  }
  const h07 = { // cavo di TIPO diverso, ma "3X10" attaccato → vinceva prima
    codice: 'VEN25-PR-A.99.077.00', desc_short: 'CAVO H07RN-F SEZIONE 3X10 MMQ', declaratoria: '', um: 'm', prezzo: 4.34,
  }

  it('trova il FG16OR anche con sezione spaziata "3 x 10"', () => {
    expect(scoreCable(item, fgSpaced)).toBeGreaterThan(10)
  })
  it('penalizza il cavo di tipo diverso (H07RN-F)', () => {
    expect(scoreCable(item, h07)).toBeLessThan(scoreCable(item, fgSpaced))
  })
  it('il FG16OR giusto batte nettamente l\'H07RN-F', () => {
    expect(scoreCable(item, fgSpaced) - scoreCable(item, h07)).toBeGreaterThanOrEqual(8)
  })
})

describe('scoreCable — sezione e forme', () => {
  const item = { sigla: 'FG16OR16', form: '5G', sec: 2.5, desc: 'FG16OR16 5G2.5' }
  it('match con "5 x 2,5" (spazi + virgola)', () => {
    const r = { declaratoria: 'CAVO FG16OR16 5 x 2,5 mmq', um: 'm', prezzo: 3 }
    expect(scoreCable(item, r)).toBeGreaterThan(10)
  })
})
