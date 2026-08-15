import { describe, it, expect } from 'vitest'
import { buildComputoModel, computoHTML } from '../../src/tools/miu/engine'
import type { ComputoItem } from '../../src/tools/miu/engine'

/**
 * Report computo/estratto di μ (P2). Verifica la parte pura: valorizzazione
 * prezzo×quantità, conteggi (allineati a cartTotals della UI), descrizioni e
 * generazione HTML. Data fissata per determinismo.
 */

const NOW = new Date('2026-06-27T09:30:00')

const items: ComputoItem[] = [
  { codice: 'A.01', desc_short: 'Cavo FG16OR16 3x2,5', um: 'm', prezzo: 2, qty: 10, regione: 'Lombardia', anno: '2024' },
  { codice: 'A.02', desc_short: 'Tubo PVC 25', um: 'm', prezzo: 1.5, qty: null, regione: 'Lombardia', anno: '2024' }, // senza misura
  { codice: 'A.03', desc_short: 'Voce senza prezzo', um: 'cad', prezzo: 0, qty: 5, regione: 'Veneto', anno: '2023' },   // senza prezzo
]

describe('buildComputoModel', () => {
  it('valorizza prezzo×quantità e somma solo le voci complete', () => {
    const m = buildComputoModel(items, { now: NOW })
    expect(m.total).toBe(20) // solo A.01: 2 × 10
    expect(m.counts).toEqual({ voci: 3, valorizzate: 1, senzaMisura: 1, senzaPrezzo: 1 })
    expect(m.rows[0]).toMatchObject({ n: 1, codice: 'A.01', importo: 20, valued: true })
    expect(m.rows[1]).toMatchObject({ codice: 'A.02', qty: null, importo: null, valued: false })
    expect(m.rows[2]).toMatchObject({ codice: 'A.03', importo: null, valued: false })
  })

  it('arrotonda a 2 decimali e gestisce qty 0/negative come non misurate', () => {
    const m = buildComputoModel(
      [{ codice: 'X', desc_short: 'x', prezzo: 0.1, qty: 3, um: 'm' },
       { codice: 'Y', desc_short: 'y', prezzo: 5, qty: 0, um: 'm' }],
      { now: NOW },
    )
    expect(m.rows[0].importo).toBe(0.3) // round2 ripulisce il rumore float (0.1×3)
    expect(m.rows[1].valued).toBe(false)
    expect(m.counts.senzaMisura).toBe(1)
  })

  it('raccoglie le fonti distinte (Regione Anno) ordinate', () => {
    const m = buildComputoModel(items, { now: NOW })
    expect(m.sources).toEqual(['Lombardia 2024', 'Veneto 2023'])
  })

  it('compone titolo (ridotta) + dettaglio (estesa) senza duplicazioni', () => {
    const m = buildComputoModel(
      [{ codice: 'A', desc_short: 'Cassetta', declaratoria: 'Fornitura e posa di cassetta da incasso', prezzo: 1, qty: 1 },
       { codice: 'B', desc_short: 'Solo titolo', declaratoria: 'Solo titolo', prezzo: 1, qty: 1 },
       { codice: 'C', desc_short: 'fino a kg 1.200', declaratoria: 'Veicolo: fino a kg 1.200', prezzo: 1, qty: 1 },
       { codice: 'D', declaratoria: 'Solo estesa', prezzo: 1, qty: 1 }],
      { now: NOW },
    )
    expect(m.rows[0]).toMatchObject({ desc: 'Cassetta', detail: 'Fornitura e posa di cassetta da incasso' })
    expect(m.rows[1].detail).toBe('') // estesa == ridotta: niente duplicazione
    expect(m.rows[2]).toMatchObject({ desc: 'Veicolo: fino a kg 1.200', detail: '' }) // estesa contiene la ridotta in coda
    expect(m.rows[3].desc).toBe('Solo estesa') // ridotta mancante → estesa fa da titolo
  })

  it('lista vuota → totale 0 e conteggi a zero', () => {
    const m = buildComputoModel([], { now: NOW })
    expect(m.total).toBe(0)
    expect(m.counts).toEqual({ voci: 0, valorizzate: 0, senzaMisura: 0, senzaPrezzo: 0 })
  })
})

describe('computoHTML', () => {
  it('genera un documento HTML autonomo con totale ed escape', () => {
    const m = buildComputoModel(
      [{ codice: 'A<1>', desc_short: 'Cavo & "speciale"', um: 'm', prezzo: 1000, qty: 2 }],
      { now: NOW },
    )
    const html = computoHTML(m)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('window.print()')
    // sistema documentale unificato: accento μ + brand Open E.Hub condiviso
    expect(html).toContain('data-tool="miu"')
    expect(html).toContain('ehub-brand')
    expect(html).toContain('Totale computo')
    expect(html).toContain('€ 2.000,00') // importo formattato it-IT
    // escaping anti-injection
    expect(html).toContain('A&lt;1&gt;')
    expect(html).toContain('Cavo &amp; &quot;speciale&quot;')
    expect(html).not.toContain('<1>')
  })
})
