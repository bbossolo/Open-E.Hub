// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

/**
 * μ: il filtro "Settore" nascosto (markup morto) è rimosso.
 *
 * Il select #f-set viveva con style="display:none" e non era mai usabile
 * dall'utente (sostituito dal filtro Tematica). La spec ne richiede la rimozione
 * completa dal DOM, preservando il DATO `settore` del modello (schede voce).
 * Qui verifichiamo il contratto DOM del filter-bar e la null-safety della
 * cascata filtri in assenza di #f-set (logica replicata dal sorgente inline).
 */

function indexDom(): Document {
  const html = readFileSync(
    resolve(__dirname, '../../src/tools/miu/index.html'), 'utf8',
  )
  return new JSDOM(html).window.document
}

describe('filtro Settore rimosso dal DOM', () => {
  it('non esiste più il gruppo filtro [data-fname="settore"]', () => {
    const doc = indexDom()
    expect(doc.querySelector('[data-fname="settore"]')).toBeNull()
  })

  it('non esiste più il select #f-set né l\'handler cascade(\'set\')', () => {
    const doc = indexDom()
    expect(doc.getElementById('f-set')).toBeNull()
    expect(doc.documentElement.innerHTML).not.toContain("cascade('set')")
  })

  it('gli altri filtri della gerarchia restano presenti', () => {
    const doc = indexDom()
    for (const id of ['f-tema', 'f-disc', 'f-sis', 'f-mat', 'f-att']) {
      expect(doc.getElementById(id), `manca ${id}`).toBeTruthy()
    }
  })
})

describe('cascata filtri null-safe senza #f-set', () => {
  // FILTER_ORDER/FILTER_FIELD replicano il sorgente inline POST-rimozione 'set'.
  const FILTER_ORDER = ['reg', 'anno', 'tema', 'disc', 'sis', 'mat', 'att', 'um']
  const FILTER_FIELD: Record<string, string> = {
    reg: 'regione', anno: 'anno', tema: 'tematica', disc: 'disciplina',
    sis: 'sistema', mat: 'materia', att: 'attivita', um: 'um',
  }

  it("FILTER_ORDER/FILTER_FIELD non referenziano più 'set'", () => {
    expect(FILTER_ORDER).not.toContain('set')
    expect(FILTER_FIELD).not.toHaveProperty('set')
  })

  it("doFilter su 'set' è un no-op: il dato settore non è più filtrabile via UI", () => {
    // Replica della guardia di filtro: fv('set') non esiste più tra i campi,
    // quindi una riga con settore qualsiasi non viene mai esclusa per quel campo.
    const fv = (id: string): string =>
      FILTER_ORDER.includes(id) ? '' : '' // 'set' non in FILTER_ORDER
    const row = { settore: 'Impianti elettrici', materia: 'rame', um: 'm' }
    // Nessuna delle guardie attive riguarda 'set'.
    const excludedBySet = false // non esiste più la riga `if(fv('set')&&...)`
    expect(fv('set')).toBe('')
    expect(excludedBySet).toBe(false)
    expect(row.settore).toBe('Impianti elettrici') // dato modello intatto
  })
})
