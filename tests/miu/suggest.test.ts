import { describe, it, expect } from 'vitest'
import { suggestRows, suggestLabel } from '../../src/tools/miu/engine/suggest'
import { searchRows } from '../../src/tools/miu/engine/search'
import type { PriceRow } from '../../src/tools/miu/engine/types'

/**
 * Suggerimenti della ricerca globale: layer puro sopra il motore di ricerca
 * (nessun secondo algoritmo) + etichetta con fallback.
 */

const row = (o: Partial<PriceRow>): PriceRow => ({
  codice: '', desc_short: '', declaratoria: '', um: '', prezzo: 0,
  disciplina: 'IMPIANTI ELETTRICI', regione: 'Veneto', anno: '2025',
  macro: ['Impianti elettrici'], ...o,
} as PriceRow)

const tray = row({ codice: 'T1', desc_short: 'Passerella portacavi in acciaio zincato, larghezza 150 mm' })
const trayLid = row({ codice: 'T2', desc_short: 'Coperchio di acciaio zincato; impiego: passerella portacavi' })
const canala = row({ codice: 'T3', desc_short: 'Canala in lamiera zincata — forata, dimensioni (50x150) mm' })
const tubo = row({ codice: 'R1', desc_short: 'Tubo in PVC rigido atossico, pesante — ø 25 mm' })
const idraulica = row({
  codice: 'H1', desc_short: 'Passerella di servizio per tubazioni idriche',
  disciplina: 'IMPIANTI IDRICO-SANITARI', macro: ['Impianti meccanici (HVAC)'],
})
const rows = [trayLid, tray, canala, tubo, idraulica]

describe('suggestRows — delega al motore di ricerca', () => {
  it('stesso ordine dei primi N di searchRows (nessun riordino)', () => {
    const expected = searchRows(rows, 'passerella').slice(0, 8).map(r => r.codice)
    expect(suggestRows(rows, 'passerella').map(r => r.codice)).toEqual(expected)
  })
  it('rispetta la macrocategoria attiva: fuori-macro esclusa', () => {
    const out = suggestRows(rows, 'passerella', { macro: 'Impianti elettrici' })
    expect(out.map(r => r.codice)).not.toContain('H1')
    expect(out.map(r => r.codice)).toContain('T1')
  })
  it('tronca a limit preservando la testa del ranking', () => {
    const all = suggestRows(rows, 'passerella')
    const two = suggestRows(rows, 'passerella', { limit: 2 })
    expect(two).toEqual(all.slice(0, 2))
    expect(two.length).toBe(2)
  })
  it('query vuota o troppo corta ⇒ [] (niente rumore)', () => {
    expect(suggestRows(rows, '')).toEqual([])
    expect(suggestRows(rows, '  ')).toEqual([])
    expect(suggestRows(rows, 'p')).toEqual([])
    expect(suggestRows(rows, null)).toEqual([])
  })
  it('query-codice letterale trova la voce', () => {
    expect(suggestRows(rows, 'T1').map(r => r.codice)).toEqual(['T1'])
  })
})

describe('suggestLabel — titolo/capitolo/prezzario con fallback', () => {
  it('caso pieno: desc_short, disciplina, regione+anno', () => {
    expect(suggestLabel(tray)).toEqual({
      titolo: 'Passerella portacavi in acciaio zincato, larghezza 150 mm',
      capitolo: 'IMPIANTI ELETTRICI',
      prezzario: 'Veneto 2025',
    })
  })
  it('senza desc_short ripiega sulla declaratoria (troncata)', () => {
    const long = 'Fornitura e posa in opera di passerella portacavi '.repeat(4)
    const l = suggestLabel(row({ desc_short: '', declaratoria: long }))
    expect(l.titolo.endsWith('…')).toBe(true)
    expect(l.titolo.length).toBeLessThanOrEqual(90)
  })
  it('senza disciplina ripiega sulla tematica, poi «—»', () => {
    expect(suggestLabel(row({ disciplina: '', tematica: 'Elettrico' })).capitolo).toBe('Elettrico')
    expect(suggestLabel(row({ disciplina: '', tematica: '' })).capitolo).toBe('—')
  })
  it('senza regione/anno il prezzario è «—»; senza testi il titolo è il codice', () => {
    expect(suggestLabel(row({ regione: '', anno: '' })).prezzario).toBe('—')
    expect(suggestLabel(row({ desc_short: '', declaratoria: '', codice: 'X9' })).titolo).toBe('X9')
  })
})
