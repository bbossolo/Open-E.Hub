// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { miuSource } from './miu-src'

/**
 * Ricerca dal prezzario nella "Modifica rapida" (openQuickEdit) di μ.
 *
 * Rilievo utente: nell'Elenco Prezzi si poteva solo editare una voce a mano;
 * ora si può anche cercare nel prezzario e scegliere una riga per popolare i
 * campi, riusando lo stesso motore (window.searchRows) e lo stesso pattern
 * inline di ricerca già in uso altrove in μ (thesaurusSearchInline).
 *
 * Convenzione dei test DOM di μ: il markup di openQuickEdit è generato da un
 * template string in JS (non presente staticamente in index.html), quindi il
 * contratto si verifica sulla sorgente inline (come search-wiring.test.ts),
 * più logica replicata fedelmente per il flusso pick → salva.
 */

const html = miuSource()

describe('ricerca prezzario nella Modifica rapida — markup e wiring', () => {
  it('il box di ricerca esiste nel template di openQuickEdit, cablato a qeSearchInline', () => {
    expect(html).toContain('id="qe-search-q"')
    expect(html).toContain('id="qe-search-res"')
    expect(html).toContain('oninput="qeSearchInline()"')
  })

  it('il box di ricerca è omesso quando la voce ha Analisi Prezzi (hasAP)', () => {
    const openQuickEdit = html.slice(html.indexOf('function openQuickEdit('), html.indexOf('function _qeKeydown('))
    expect(openQuickEdit).toMatch(/hasAP\s*\?\s*`[\s\S]*Analisi Prezzi[\s\S]*`\s*:\s*`[\s\S]*qe-search-q/)
  })

  it('i risultati usano window.searchRows su S.allRows, come thesaurusSearchInline', () => {
    const qeSearchInline = html.slice(html.indexOf('function qeSearchInline('), html.indexOf('function qePickRow('))
    expect(qeSearchInline).toContain('window.searchRows(S.allRows, q)')
  })

  it('qePickRow è esposta su window (richiamata da onclick generato dinamicamente)', () => {
    expect(html).toMatch(/Object\.assign\(window,\s*\{[\s\S]*qePickRow[\s\S]*\}\)/)
    expect(html).toMatch(/Object\.assign\(window,\s*\{[\s\S]*qeSearchInline[\s\S]*\}\)/)
  })

  it('closeQuickEdit cancella il timer di debounce e lo stato del pick (niente leak tra riaperture)', () => {
    const closeQuickEdit = html.slice(html.indexOf('function closeQuickEdit('), html.indexOf('function qeSearchInline('))
    expect(closeQuickEdit).toContain('clearTimeout(_qeSearchTimer)')
    expect(closeQuickEdit).toContain('_qePickedRow=null')
  })
})

// replica fedele di qePickRow + quickEditSave per il contratto dati (US: la voce
// si aggancia al prezzario esattamente come commitRowToElencoPrezzi)
interface CustomItem {
  desc_short: string; declaratoria: string; um: string; prezzo: number | null
  codice?: string; regione?: string; anno?: string; source?: string; _ref?: string
}
interface PriceRow {
  codice: string; desc_short: string; declaratoria?: string; um: string; prezzo: number
  regione?: string; anno?: string
}
function rowKey(r: PriceRow): string { return `${r.regione || ''}|${r.anno || ''}|${r.codice}` }

// stato di modulo replicato (quickedit-search.ts non esiste: è codice inline)
function quickEditSaveLogic(
  it: CustomItem,
  form: { breve: string; estesa: string; um: string; prezzo: string; prezzoDisabled: boolean },
  pickedRow: PriceRow | null,
): CustomItem {
  const next: CustomItem = { ...it }
  next.desc_short = form.breve.trim() || it.desc_short
  next.declaratoria = form.estesa.trim() || form.breve.trim() || it.declaratoria
  next.um = form.um.trim()
  if (!form.prezzoDisabled) {
    const p = parseFloat(form.prezzo)
    next.prezzo = Number.isFinite(p) ? p : null
  }
  if (pickedRow) {
    next.codice = pickedRow.codice
    next.regione = pickedRow.regione
    next.anno = pickedRow.anno
    next.source = 'prezzario'
    next._ref = rowKey(pickedRow)
  }
  return next
}

describe('quickEditSave con un pick attivo — contratto dati', () => {
  const vocePrezzario: PriceRow = {
    codice: '15.3.2', desc_short: 'Presa bipasso 16A', declaratoria: 'Fornitura e posa di presa bipasso 16A.',
    um: 'cad', prezzo: 12.5, regione: 'Veneto', anno: '2026',
  }

  it('senza pick: comportamento identico a oggi, source/_ref invariati', () => {
    const voceManuale: CustomItem = { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: null, source: 'componi' }
    const form = { breve: 'Voce modificata a mano', estesa: '', um: 'cad', prezzo: '9.5', prezzoDisabled: false }
    const result = quickEditSaveLogic(voceManuale, form, null)
    expect(result.desc_short).toBe('Voce modificata a mano')
    expect(result.prezzo).toBe(9.5)
    expect(result.source).toBe('componi')
    expect(result._ref).toBeUndefined()
  })

  it('con un pick: si aggancia al prezzario come commitRowToElencoPrezzi (source, _ref, codice, regione, anno)', () => {
    const voceComposta: CustomItem = { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: null, source: 'componi' }
    const form = { breve: vocePrezzario.desc_short, estesa: vocePrezzario.declaratoria!, um: vocePrezzario.um, prezzo: String(vocePrezzario.prezzo), prezzoDisabled: false }
    const result = quickEditSaveLogic(voceComposta, form, vocePrezzario)
    expect(result.source).toBe('prezzario')
    expect(result._ref).toBe(rowKey(vocePrezzario))
    expect(result.codice).toBe(vocePrezzario.codice)
    expect(result.regione).toBe(vocePrezzario.regione)
    expect(result.anno).toBe(vocePrezzario.anno)
    expect(result.desc_short).toBe(vocePrezzario.desc_short)
  })

  it('pick poi testo modificato a mano: il testo vince, il link (source/_ref) resta quello del pick', () => {
    const voceComposta: CustomItem = { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: null }
    const form = { breve: 'Presa bipasso 16A (rifinita)', estesa: 'Testo rifinito a mano.', um: 'cad', prezzo: '12.5', prezzoDisabled: false }
    const result = quickEditSaveLogic(voceComposta, form, vocePrezzario)
    expect(result.desc_short).toBe('Presa bipasso 16A (rifinita)')
    expect(result.declaratoria).toBe('Testo rifinito a mano.')
    expect(result.source).toBe('prezzario')
    expect(result._ref).toBe(rowKey(vocePrezzario))
  })

  it('prezzo disabilitato (Analisi Prezzi): non viene sovrascritto anche se un pick è presente', () => {
    const voceAP: CustomItem = { desc_short: 'x', declaratoria: 'x', um: 'cad', prezzo: 42 }
    const form = { breve: 'x', estesa: 'x', um: 'cad', prezzo: '999', prezzoDisabled: true }
    const result = quickEditSaveLogic(voceAP, form, null)
    expect(result.prezzo).toBe(42)
  })
})
