import { describe, it, expect } from 'vitest'
import { estraiVociDaScheda } from '../../src/shared/compositore/datasheet'
import { miuSource } from './miu-src'

/**
 * Import scheda tecnica (PDF) → voci di computo candidate. Motore PURO/offline:
 * riceve il TESTO già estratto e propone famiglia + caratteristiche mappate sui
 * chip REALI del FRASARIO.
 *
 * Open E.Hub: FAMIGLIE/FRASARIO/MARCHI sono vocabolario proprietario, non
 * distribuito (vite.config.ts alias compositore-catalog:* → dati vuoti). I
 * casi di RICONOSCIMENTO (famiglia/caratteristiche/marca da testo scheda) sono
 * stati rimossi con il resto della suite datasheet-*.test.ts: dipendono dal
 * catalogo, non dall'algoritmo puro, e senza vocabolario non riconoscono più
 * nulla. Restano solo le verifiche meccaniche/strutturali, indipendenti dal
 * contenuto del catalogo.
 */

describe('estrazione voci da scheda tecnica', () => {
  it('testo vuoto o non riconosciuto ⇒ nessuna proposta', () => {
    expect(estraiVociDaScheda('')).toEqual([])
    expect(estraiVociDaScheda('   ')).toEqual([])
    expect(estraiVociDaScheda('lorem ipsum dolor sit amet consectetur')).toEqual([])
    expect(estraiVociDaScheda(null)).toEqual([])
  })
})

describe('contratto sul sorgente inline di μ — l\'arricchimento METEL ricalcola la descrizione', () => {
  it('cmpDatasheetFile chiama rideriveDescrizione dopo aver arricchito marca/modello da METEL', () => {
    const html = miuSource()
    const fn = html.match(/async function cmpDatasheetFile\(input\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain('window.rideriveDescrizione')
    expect(fn).toContain('p.descBreve=rid.breve')
  })
})
