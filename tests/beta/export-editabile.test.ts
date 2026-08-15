// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  frontespizioHTML, giornaleHTML, librettoHTML, registroHTML, sommarioHTML, salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML,
  verbaleHTML, nuovoVerbale, VERBALE_TIPI,
} from '../../src/tools/beta/engine'
import { importaAMisura, importaACorpo } from '../../src/tools/beta/engine/import'
import type { Appalto, Partita, Sal, Verbale } from '../../src/tools/beta/engine/types'
import { htmlDocToSimpleDoc, buildSimpleDocxParts, buildOdtParts, ODT_MIMETYPE_ENTRY } from '../../src/shared/doc'

/**
 * Verifica che il convertitore generico `htmlDocToSimpleDoc` (una sola implementazione,
 * riusata per tutti gli atti di β) produca un export DOCX/ODT valido per OGNI tipo di
 * documento — niente adattamento per-generatore.
 */
const appalto: Appalto = {
  oggetto: 'Manutenzione straordinaria scuola', cup: 'C11', cig: 'Z0A',
  ente: { denominazione: 'Comune di Prova', indirizzo: 'Piazza Roma 1', codiceFiscale: '00000000000' },
  impresa: { denominazione: 'Impresa Edile srl', partitaIva: '01234567890' },
  rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', articoloCapitolato: '12',
  baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto',
}
const partite: Partita[] = [
  ...importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere edili' }]),
  ...importaACorpo([{ codice: 'C1', desc_short: 'Impianto', prezzo: 100, qty: 20, categoria: 'Impianti' }]),
]
const sals: Sal[] = [{ numero: 1, data: '01/06/2026', righe: [
  { partitaId: partite[0].id, quantitaProgressiva: 50 },
  { partitaId: partite[1].id, quotaPct: 30 },
] }]
const verbali: Verbale[] = VERBALE_TIPI.map((t, i) => {
  const v = nuovoVerbale(t, `0${i + 1}/06/2026`, [], `v${i}`)
  return { ...v, oggetto: `Oggetto ${t}`, testo: 'Primo paragrafo.\nSecondo paragrafo.' }
})

const tutti: Record<string, string> = {
  frontespizio: frontespizioHTML(appalto, partite),
  giornale: giornaleHTML(appalto, []),
  libretto: librettoHTML(appalto, partite, sals[0]),
  registro: registroHTML(appalto, partite, sals),
  sommario: sommarioHTML(appalto, partite, sals, 1),
  sal: salHTML(appalto, partite, sals, 1),
  certificato: certificatoHTML(appalto, partite, sals, 1),
  contoFinale: contoFinaleHTML(appalto, partite, sals, verbali),
  relazione: relazioneFinaleHTML(appalto, partite, sals, [], '', verbali),
  'verbale:consegna': verbaleHTML(appalto, verbali[0]),
}

describe('β Contabilità — export editabile (.docx/.odt) per ogni tipo di atto', () => {
  for (const [nome, html] of Object.entries(tutti)) {
    it(`${nome}: htmlDocToSimpleDoc estrae titolo e contenuto`, () => {
      const doc = htmlDocToSimpleDoc(html)
      expect(doc.titolo.length).toBeGreaterThan(0)
      expect(doc.sezioni.length).toBeGreaterThan(0)
      expect(doc.sezioni.some((s) => s.testo.trim().length > 0)).toBe(true)
    })

    it(`${nome}: buildSimpleDocxParts produce un pacchetto OOXML ben formato`, () => {
      const parts = buildSimpleDocxParts(htmlDocToSimpleDoc(html))
      expect(parts['word/document.xml']).toContain('<w:document')
      expect(parts['word/document.xml']).toContain('</w:document>')
      expect(parts['[Content_Types].xml']).toContain('wordprocessingml')
      expect(new DOMParser().parseFromString(parts['word/document.xml'], 'application/xml').querySelector('parsererror')).toBeNull()
    })

    it(`${nome}: buildOdtParts produce un pacchetto ODF ben formato`, () => {
      const parts = buildOdtParts(htmlDocToSimpleDoc(html))
      expect(parts[ODT_MIMETYPE_ENTRY]).toBe('application/vnd.oasis.opendocument.text')
      expect(parts['content.xml']).toContain('<office:document-content')
      expect(new DOMParser().parseFromString(parts['content.xml'], 'application/xml').querySelector('parsererror')).toBeNull()
    })
  }

  it('conserva le tabelle come blocchi pipe e le firme come righe distinte', () => {
    const doc = htmlDocToSimpleDoc(tutti['verbale:consegna'])
    const testoCompleto = doc.sezioni.map((s) => s.testo).join('\n\n')
    expect(testoCompleto).toMatch(/\|.*\|/) // almeno una tabella (Atto/Data/Oggetto)
    expect(testoCompleto).toContain('Il Direttore dei Lavori')
  })
})
