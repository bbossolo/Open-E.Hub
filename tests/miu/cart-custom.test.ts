// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { frasarioFor } from '../../src/shared/compositore/componi'

/**
 * Voci composte aggiungibili al carrello.
 *
 * Convenzione dei test DOM di μ (come componi-modal.test.ts): contratto sul
 * markup/sorgente inline di index.html + logica replicata fedelmente dalle
 * funzioni inline (cmpAddToCart/cartTotals/publishComputo) sopra il motore
 * REALE (componiDescrizione), in jsdom — niente e2e/browser.
 */

const html = readFileSync(resolve(__dirname, '../../src/tools/miu/index.html'), 'utf8')
const indexDom = (): Document => new JSDOM(html).window.document

interface CustomItem {
  desc_short: string
  declaratoria: string
  um: string
  prezzo: number | null
  famigliaId: string | null
  famNome: string
}
interface QtyEntry { qty: number; um: string; source: string }

// replica fedele di cmpAddToCart() in index.html
function cmpAddToCartLogic(
  state: { fam: string | null; custom: string | null; edBreve: string | null; edEstesa: string | null; genBreve: string; genEstesa: string },
  fr: ReturnType<typeof frasarioFor>,
): CustomItem | null {
  const breve = ((state.edBreve != null && state.edBreve.trim() !== '') ? state.edBreve : state.genBreve || '').trim()
  const estesa = ((state.edEstesa != null && state.edEstesa.trim() !== '') ? state.edEstesa : state.genEstesa || '').trim()
  if (!breve && !estesa) return null
  const um = fr ? (fr.umTipiche && fr.umTipiche[0]) || 'cad' : 'cad'
  const famNome = fr ? fr.nome : (state.custom || '')
  return { desc_short: breve, declaratoria: estesa || breve, um, prezzo: null, famigliaId: state.fam || null, famNome }
}

// replica fedele del loop custom aggiunto a cartTotals() in index.html
function cartTotalsCustom(custom: Map<string, CustomItem>, qty: Record<string, QtyEntry>) {
  let tot = 0, priced = 0, noMeasure = 0, noPrice = 0
  for (const [k, it] of custom) {
    const q = qty[k]
    const qv = q && q.qty > 0 ? q.qty : null
    if (!(it.prezzo! > 0)) { noPrice++; continue }
    if (qv == null) { noMeasure++; continue }
    tot += it.prezzo! * qv; priced++
  }
  return { tot, priced, noMeasure, noPrice }
}

// replica fedele del loop custom aggiunto a publishComputo() in index.html
function publishComputoCustomItems(custom: Map<string, CustomItem>, qty: Record<string, QtyEntry>) {
  const items: any[] = []
  for (const [k, it] of custom) {
    const q = qty[k]
    items.push({
      codice: '✎ composta', desc_short: it.desc_short, declaratoria: it.declaratoria,
      um: it.um, prezzo: it.prezzo, qty: (q && q.qty > 0) ? q.qty : null,
      regione: undefined, anno: undefined, tematica: undefined, source: 'componi',
    })
  }
  return items
}

// replica fedele di saveCurrentCart()/loadCartById() per la parte custom
function roundtripCustom(custom: Map<string, CustomItem>): Map<string, CustomItem> {
  const serialized = JSON.parse(JSON.stringify([...custom.entries()]))
  return new Map(serialized)
}

describe('markup del bottone "Aggiungi al computo" nel compositore', () => {
  it('il footer del modal Componi descrizione contiene il bottone cmpAddToCart', () => {
    const doc = indexDom()
    const footer = doc.querySelector('#componi-overlay .cmp-ft')
    expect(footer).not.toBeNull()
    const btn = [...footer!.querySelectorAll('button')].find(b => (b.getAttribute('onclick') || '').includes('cmpAddToCart'))
    expect(btn, 'bottone Aggiungi al computo assente dal footer').toBeDefined()
    expect(btn!.textContent).toContain('Aggiungi al computo')
  })
})

describe('cmpAddToCart: crea una voce custom dal compositore', () => {
  it('famiglia personalizzata (fuori thesaurus): UM di fallback "cad", famNome = nome custom', () => {
    const state = { fam: null, custom: 'Rilevatore di gas metano', edBreve: 'Rilevatore di gas metano', edEstesa: 'Fornitura e posa in opera di rilevatore di gas metano.', genBreve: '', genEstesa: '' }
    const item = cmpAddToCartLogic(state, undefined)
    expect(item).not.toBeNull()
    expect(item!.um).toBe('cad')
    expect(item!.famigliaId).toBeNull()
    expect(item!.famNome).toBe('Rilevatore di gas metano')
  })

  it('editor popolato ha precedenza sull\'anteprima generata (stessa regola di cmpCopy)', () => {
    const fr = frasarioFor('estintore')
    const state = { fam: 'estintore', custom: null, edBreve: 'Estintore 9 kg a polvere (editato)', edEstesa: null, genBreve: 'Estintore', genEstesa: 'Fornitura e posa in opera di estintore.' }
    const item = cmpAddToCartLogic(state, fr)
    expect(item!.desc_short).toBe('Estintore 9 kg a polvere (editato)')
    expect(item!.declaratoria).toBe('Fornitura e posa in opera di estintore.') // estesa non editata ⇒ ripiega sull'anteprima
  })

  it('nessun testo composto (breve/estesa vuoti) ⇒ nessuna voce creata', () => {
    const state = { fam: null, custom: null, edBreve: null, edEstesa: null, genBreve: '', genEstesa: '' }
    expect(cmpAddToCartLogic(state, undefined)).toBeNull()
  })
})

describe('le voci custom nel riepilogo del carrello (cartTotals)', () => {
  it('senza prezzo impostato ⇒ conteggiata come "senza prezzo", esclusa dal totale', () => {
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: null, famigliaId: null, famNome: '' }]])
    const t = cartTotalsCustom(custom, {})
    expect(t).toEqual({ tot: 0, priced: 0, noMeasure: 0, noPrice: 1 })
  })

  it('con prezzo ma senza quantità ⇒ "senza misura", esclusa dal totale', () => {
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: 25, famigliaId: null, famNome: '' }]])
    const t = cartTotalsCustom(custom, {})
    expect(t).toEqual({ tot: 0, priced: 0, noMeasure: 1, noPrice: 0 })
  })

  it('prezzo e quantità impostati ⇒ valorizzata, importo = prezzo × quantità', () => {
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: 25, famigliaId: null, famNome: '' }]])
    const qty = { 'cmp:1': { qty: 3, um: 'cad', source: 'manual' } }
    const t = cartTotalsCustom(custom, qty)
    expect(t).toEqual({ tot: 75, priced: 1, noMeasure: 0, noPrice: 0 })
  })
})

describe('export del computo sull\'hub (publishComputo)', () => {
  it('la voce custom ha lo stesso formato delle voci reali, con codice sintetico e source componi', () => {
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'Tubo rigido ⌀ 63 mm', declaratoria: 'Fornitura e posa in opera di tubo rigido ⌀ 63 mm.', um: 'm', prezzo: 4.2, famigliaId: 'tubo-rigido', famNome: 'tubo rigido' }]])
    const qty = { 'cmp:1': { qty: 12, um: 'm', source: 'manual' } }
    const items = publishComputoCustomItems(custom, qty)
    expect(items).toEqual([{
      codice: '✎ composta', desc_short: 'Tubo rigido ⌀ 63 mm', declaratoria: 'Fornitura e posa in opera di tubo rigido ⌀ 63 mm.',
      um: 'm', prezzo: 4.2, qty: 12, regione: undefined, anno: undefined, tematica: undefined, source: 'componi',
    }])
  })

  it('senza quantità impostata ⇒ qty null, come le voci reali non misurate', () => {
    const custom = new Map<string, CustomItem>([['cmp:1', { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: null, famigliaId: null, famNome: '' }]])
    const items = publishComputoCustomItems(custom, {})
    expect(items[0].qty).toBeNull()
  })
})

describe('persistenza nei carrelli alternativi (salva/carica)', () => {
  it('round-trip di serializzazione preserva tutti i campi della voce custom', () => {
    const custom = new Map<string, CustomItem>([
      ['cmp:1', { desc_short: 'Scatola derivazione 300×220×120 mm', declaratoria: 'Fornitura e posa in opera di scatola di derivazione.', um: 'cad', prezzo: 18.5, famigliaId: 'scatola-derivazione', famNome: 'scatola derivazione' }],
    ])
    const restored = roundtripCustom(custom)
    expect(restored.size).toBe(1)
    expect(restored.get('cmp:1')).toEqual(custom.get('cmp:1'))
  })

  it('più voci custom sopravvivono al giro completo, in ordine', () => {
    const custom = new Map<string, CustomItem>([
      ['cmp:1', { desc_short: 'a', declaratoria: 'a', um: 'cad', prezzo: null, famigliaId: null, famNome: '' }],
      ['cmp:2', { desc_short: 'b', declaratoria: 'b', um: 'm', prezzo: 10, famigliaId: 'tubo-rigido', famNome: 'tubo rigido' }],
    ])
    const restored = roundtripCustom(custom)
    expect([...restored.keys()]).toEqual(['cmp:1', 'cmp:2'])
  })
})
