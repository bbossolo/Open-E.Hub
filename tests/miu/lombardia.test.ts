import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseLombardia } from '../../src/tools/miu/engine/parsers/lombardia'

const xml = readFileSync(resolve(__dirname, 'fixtures/lombardia-sample.xml'), 'utf-8')

describe('parseLombardia — famiglia report/METEL (golden su dati reali)', () => {
  const res = parseLombardia(xml)

  it('rileva regione (prefisso LOM) e anno (riferimenti_voce)', () => {
    expect(res.regione).toBe('Lombardia')
    expect(res.anno).toBe('2026')
  })

  it('scarta le voci a prezzo 0', () => {
    expect(res.rows.map(r => r.codice)).toEqual([
      'LOM261.OC.EEA.Pa01.C0625.Sb010.0000.-',
      'LOM261.RM.00.10.00.Ba002.0000.0',
    ])
  })

  it('opera compiuta: sintetica da riga OPERA:, estesa da dettaglio, manodopera, importi, um', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(310.62, 2)
    expect(r.importo_netto).toBeCloseTo(245.55, 2)
    expect(r.ru).toBeCloseTo(5.13, 2)                 // rapporto manodopera
    expect(r.um).toBe('cad')                          // "1 cad" → "cad"
    // le code «Incluso:/Escluso:» restano fuori dalla sintetica (identità della voce)
    expect(r.desc_short).toBe('Maniglione risalita di lega ferrosa acciaio inox AISI 304; impiego: piscine.')
    expect(r.declaratoria.startsWith('OP1 Maniglione')).toBe(true)  // declaratoria_voce_dettaglio
    expect(r.tipologia).toBe('OPERA COMPIUTA')
    // opera compiuta a 11 livelli: la disciplina vera sta nei livelli profondi
    expect(r.disciplina).toBe('ARCHITETTURA')                       // descr_liv_8
    expect(r.sistema).toBe('SISTEMI SCALA')                         // descr_liv_9
    expect(r.settore).toBe('MANIGLIONE RISALITA')                   // descr_liv_10
    expect(r.materia).toBe('LEGA FERROSA ACCIAIO INOX AISI 304')    // descr_liv_11
    expect(r.liv2).toBe('EDILIZIA')                                 // il contesto resta nei liv1..4
  })

  it('opera compiuta: scomposizione ufficiale (risorse) con tipo mappato e numeri', () => {
    const r = res.rows[0]
    expect(r.risorse).toHaveLength(2)
    const [mat, mo] = r.risorse!
    expect(mat).toMatchObject({ codice: 'LOM261.RM.56.15.45.Sb010.0000.-', tipo: 'materiale', quantita: 1, prezzo: 229.62, um: 'cad' })
    expect(mat.descrizione).toContain('Maniglione di risalita')
    expect(mo).toMatchObject({ codice: 'LOM261.RU.00.00.00.0015.a', tipo: 'manodopera', quantita: 0.55, prezzo: 28.96, um: 'h' })
  })

  it('risorsa materiale: nessuna scomposizione (le RM sono costi elementari)', () => {
    expect(res.rows[1].risorse).toBeUndefined()
  })

  it('risorsa materiale: senza estesa né manodopera, um composta ripulita', () => {
    const r = res.rows[1]
    expect(r.um).toBe('m² * cm')
    expect(r.ru).toBe(0)
    expect(r.tipologia).toBe('RISORSA MATERIALE')
    expect(r.declaratoria).toContain('Additivo sintetico')   // ripiega su declaratoria_voce
    expect(r.desc_short).toContain('Additivo sintetico')
  })
})
