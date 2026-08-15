// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { searchRows } from '../../src/tools/miu/engine/search'
import type { PriceRow } from '../../src/tools/miu/engine/types'
import { miuSource } from './miu-src'

/**
 * Cassette di derivazione e allacci utenza in una distinta importata: questi kind
 * ('cassetta'|'allaccio-utenza') non hanno sigla/sezione da confrontare, quindi il
 * best-match automatico usa la ricerca testuale generica invece dello scorer
 * cavo/condotto dedicato. Convenzione dei test DOM di μ: markup reale +
 * logica replicata fedelmente dalle funzioni inline, sopra il motore REALE.
 */

const html = miuSource()
const indexDom = (): Document => new JSDOM(html).window.document

const row = (o: Partial<PriceRow>): PriceRow => ({
  codice: '', desc_short: '', declaratoria: '', um: 'cad', prezzo: 0,
  disciplina: 'IMPIANTI ELETTRICI', ...o,
} as PriceRow)

interface PhiItem { kind: string; desc: string; qty: number; um: string }

// replica di phiMatchRows() in index.html per i kind !== 'cavo'/'tubo'
function phiMatchRowsExtra(item: PhiItem, pool: PriceRow[]): PriceRow[] {
  if (item.kind === 'cavo' || item.kind === 'tubo') throw new Error('non applicabile: usa lo scorer dedicato')
  if (!pool.length) return []
  return searchRows(pool, item.desc).slice(0, 8)
}

// replica di PHI_KIND_FAMIGLIA + phiComponiRow() in index.html
function phiComponiPreset(item: PhiItem): { famigliaId: string | null; custom: string | null } {
  const PHI_KIND_FAMIGLIA: Record<string, string> = { cassetta: 'scatola-derivazione' }
  const famigliaId = PHI_KIND_FAMIGLIA[item.kind]
  if (famigliaId) return { famigliaId, custom: null }
  return { famigliaId: null, custom: item.desc }
}

describe('markup: overlay distinta con badge/colonna Componi per i nuovi kind', () => {
  it('index.html contiene i badge CASSETTA/ALLACCIO e il bottone Componi per riga', () => {
    expect(html).toContain('CASSETTA')
    expect(html).toContain('ALLACCIO')
    expect(html).toContain('phiComponiRow(')
  })

  // #phi-btn era il bottone di un tool che non fa parte della suite: nessuno
  // scriveva mai il suo stato, quindi restava permanentemente disabilitato e morto.
  // Il motore di match (phiComponiRow/phiMatchRows/ecc., testato sopra e sotto)
  // resta invece vivo: lo usa l'import Ampère tramite openDistintaModal.
  it('#phi-btn NON esiste più (era un bottone morto, mai raggiungibile)', () => {
    const doc = indexDom()
    expect(doc.getElementById('phi-btn')).toBeNull()
  })
})

describe('match automatico via ricerca testuale generica (no scorer)', () => {
  it('trova una voce di prezzario per una cassetta di derivazione', () => {
    const pool: PriceRow[] = [
      row({ codice: 'A1', desc_short: 'Cassetta di derivazione', declaratoria: 'Cassetta di derivazione da incasso IP40' }),
      row({ codice: 'A2', desc_short: 'Passerella portacavi', declaratoria: 'Passerella in acciaio zincato' }),
    ]
    const item: PhiItem = { kind: 'cassetta', desc: 'Cassetta di derivazione', qty: 3, um: 'cad' }
    const matches = phiMatchRowsExtra(item, pool)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]!.codice).toBe('A1')
  })

  it('nessun risultato nel pool ⇒ nessun match, nessun errore', () => {
    const item: PhiItem = { kind: 'allaccio-utenza', desc: 'Allaccio utenza monofase', qty: 2, um: 'cad' }
    expect(phiMatchRowsExtra(item, [])).toEqual([])
  })

  it('cavo/tubo restano sullo scorer dedicato (non passano da questo ramo)', () => {
    expect(() => phiMatchRowsExtra({ kind: 'cavo', desc: 'FG16OR16 3G2.5', qty: 10, um: 'm' }, [])).toThrow()
    expect(() => phiMatchRowsExtra({ kind: 'tubo', desc: 'Corrugato DN25', qty: 10, um: 'm' }, [])).toThrow()
  })
})

describe('fallback "Componi": famiglia nota per le cassette, voce libera per gli allacci', () => {
  it('cassetta ⇒ preset famiglia scatola-derivazione (già esistente nel thesaurus)', () => {
    const preset = phiComponiPreset({ kind: 'cassetta', desc: 'Cassetta di derivazione', qty: 3, um: 'cad' })
    expect(preset).toEqual({ famigliaId: 'scatola-derivazione', custom: null })
  })

  it('allaccio utenza ⇒ nessuna famiglia fuori-prezzario nota, voce personalizzata precompilata', () => {
    const preset = phiComponiPreset({ kind: 'allaccio-utenza', desc: 'Allaccio utenza trifase', qty: 4, um: 'cad' })
    expect(preset).toEqual({ famigliaId: null, custom: 'Allaccio utenza trifase' })
  })
})
