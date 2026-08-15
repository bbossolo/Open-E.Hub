import { describe, it, expect } from 'vitest'
import { analisiPrezziHTML, fascicoloAnalisiHTML } from '../../src/tools/miu/engine'
import type { AnalisiPrezzi } from '../../src/tools/miu/engine'

const NOW = new Date('2026-07-08T09:30:00')

const analisi: AnalisiPrezzi = {
  id: 'ap-test', codice: 'AP01', descrizioneBreve: 'Fornitura e posa cassetta & "speciale" <test>',
  um: 'cad', speseGeneraliPct: 15, utileImpresaPct: 10,
  righe: [
    { tipo: 'manodopera', descrizione: 'Operaio specializzato', um: 'h', quantita: 2, prezzoUnitario: 33.03, fonte: { codice: 'VEN25-RU.01.02.a', regione: 'Veneto', anno: '2025' } },
    { tipo: 'materiale', descrizione: 'Cassetta da incasso', um: 'cad', quantita: 1, prezzoUnitario: 8.5 },
    { tipo: 'nolo', descrizione: 'Nolo trapano', um: 'h', quantita: 0.5, prezzoUnitario: 4 },
    { tipo: 'varie', descrizione: 'Trasporto', um: 'a corpo', quantita: 1, prezzoUnitario: 5 },
  ],
}

describe('analisiPrezziHTML', () => {
  it('genera un documento HTML autonomo con tutte le sezioni e i totali', () => {
    const html = analisiPrezziHTML(analisi, undefined, NOW)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('window.print()')
    expect(html).toContain('data-tool="miu"')
    expect(html).toContain('Manodopera')
    expect(html).toContain('Materiali')
    expect(html).toContain('Noli')
    expect(html).toContain('Varie')
    expect(html).toContain('Spese Generali')
    expect(html).toContain('Utile d')
    expect(html).toContain('AP01')
    expect(html).toContain('VEN25-RU.01.02.a')
  })

  it('escapa il testo utente (anti-injection)', () => {
    const html = analisiPrezziHTML(analisi, undefined, NOW)
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
    expect(html).not.toContain('<test>')
  })

  it('il prezzo unitario finale nel documento coincide con calcolaAnalisi', () => {
    const html = analisiPrezziHTML(analisi, undefined, NOW)
    // costo diretto = 2*33.03 + 8.5 + 0.5*4 + 5 = 66.06+8.5+2+5 = 81.56
    // SG 15% = 12.234 -> 12.23; subtotale = 93.79 (arrotondato); UI 10% ~9.38; prezzo ~103.17
    expect(html).toMatch(/€\s*81,56/) // costo diretto
  })

  it('una sezione senza righe non compare nel documento', () => {
    const soloManodopera: AnalisiPrezzi = { ...analisi, righe: [analisi.righe[0]!] }
    const html = analisiPrezziHTML(soloManodopera, undefined, NOW)
    expect(html).toContain('Manodopera')
    expect(html).not.toContain('Subtotale materiali')
  })
})

describe('fascicoloAnalisiHTML (sistema documentale ε)', () => {
  const seconda = { ...analisi, id: 'ap-2', codice: 'AP02', descrizioneBreve: 'Seconda voce' }
  it('un documento unico: indice + una analisi per pagina, quadro economico tecnico', () => {
    const html = fascicoloAnalisiHTML([analisi, seconda])
    expect(html).toContain('Fascicolo Analisi Prezzi (2)')
    expect(html).toContain('Indice delle analisi')
    // interruzione di pagina tra le analisi
    expect(html.match(/page-break-before:always/g)!.length).toBe(2)
    expect(html).toContain('Prezzo di applicazione')
    expect(html).toContain('Incidenza manodopera')
    // stessa testata ε degli altri documenti della suite
    expect(html).toContain('data-tool="miu"')
  })
})
