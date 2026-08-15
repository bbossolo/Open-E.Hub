// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

/**
 * BUG FIX (2026-07-05) — due difetti distinti in collectExportRows():
 * 1) Con carrello di sole voci COMPOSTE (S.custom) e nessuna riga da prezzario
 *    selezionata (S.sel vuoto), il controllo guardava solo `S.sel.size>0`: le voci
 *    composte non finivano MAI nell'export (TSV/Excel/report), a prescindere.
 * 2) Con carrello COMPLETAMENTE vuoto, la funzione ripiegava su S.filtered — «ciò
 *    che è filtrato a video» — che senza una ricerca attiva coincide col prezzario
 *    intero: un click su «Esporta» a carrello vuoto esportava tutto il prezzario.
 *
 * Convenzione dei test DOM di μ (come cart-custom.test.ts): replica fedele della
 * funzione inline `collectExportRows()` di index.html, verificata in isolamento.
 */

interface Row { codice: string; desc_short: string; declaratoria: string; um: string; prezzo: number | null; ru?: number | null; regione: string; anno: string; _custom?: boolean; _qty?: QtyEntry }
interface QtyEntry { qty: number; um: string; source: string }
interface CustomItem { desc_short: string; declaratoria: string; um: string; prezzo: number | null }

// replica fedele di collectExportRows() in index.html — SOLO il carrello (S.sel + S.custom),
// mai un fallback su ciò che è filtrato/mostrato a video.
function collectExportRowsLogic(
  custom: Map<string, CustomItem>,
  cartRealRows: Row[],
  qty: Record<string, QtyEntry>,
): Row[] {
  const rows = [...cartRealRows]
  let i = 0
  for (const [k, it] of custom) {
    i++
    rows.push({
      codice: 'NP.' + String(i).padStart(3, '0'),
      desc_short: it.desc_short, declaratoria: it.declaratoria,
      um: it.um, prezzo: it.prezzo, ru: null, regione: '—', anno: '—',
      _custom: true, _qty: qty[k],
    })
  }
  return rows
}

describe('collectExportRows — bug: carrello di sole voci composte esportava tutto il prezzario', () => {
  it('S.sel vuoto ma S.custom non vuoto ⇒ SOLO le voci composte, non il prezzario', () => {
    const custom = new Map<string, CustomItem>([
      ['cmp:1', { desc_short: 'Rilevatore di gas metano', declaratoria: 'Fornitura e posa in opera di rilevatore di gas metano.', um: 'cad', prezzo: 45 }],
    ])
    const rows = collectExportRowsLogic(custom, [], {})
    expect(rows.length).toBe(1)
    expect(rows[0].desc_short).toBe('Rilevatore di gas metano')
  })

  it('voce composta riceve una tariffa progressiva univoca (NP.001, NP.002…)', () => {
    const custom = new Map<string, CustomItem>([
      ['cmp:1', { desc_short: 'a', declaratoria: 'a', um: 'cad', prezzo: 10 }],
      ['cmp:2', { desc_short: 'b', declaratoria: 'b', um: 'cad', prezzo: 20 }],
    ])
    const rows = collectExportRowsLogic(custom, [], {})
    expect(rows.map(r => r.codice)).toEqual(['NP.001', 'NP.002'])
  })

  it('la quantità della voce composta si risolve dalla sua chiave originale (_qty), non dal rowKey sintetico', () => {
    const custom = new Map<string, CustomItem>([
      ['cmp:1', { desc_short: 'Tubo rigido ⌀ 63 mm', declaratoria: 'x', um: 'm', prezzo: 4.2 }],
    ])
    const qty = { 'cmp:1': { qty: 12, um: 'm', source: 'manual' } }
    const rows = collectExportRowsLogic(custom, [], qty)
    expect(rows[0]._qty).toEqual({ qty: 12, um: 'm', source: 'manual' })
  })

  it('carrello misto: righe reali selezionate + voci composte, entrambe presenti', () => {
    const realRow: Row = { codice: 'VEN25-01', desc_short: 'reale', declaratoria: 'reale', um: 'cad', prezzo: 5, regione: 'Veneto', anno: '2025' }
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'composta', declaratoria: 'composta', um: 'cad', prezzo: 10 }]])
    const rows = collectExportRowsLogic(custom, [realRow], {})
    expect(rows).toHaveLength(2)
    expect(rows[0].desc_short).toBe('reale')
    expect(rows[1].desc_short).toBe('composta')
    expect(rows[1].codice).toBe('NP.001')
  })

  it('carrello COMPLETAMENTE vuoto ⇒ array vuoto (mai il prezzario/il filtrato a video)', () => {
    const rows = collectExportRowsLogic(new Map(), [], {})
    expect(rows).toEqual([])
  })
})
