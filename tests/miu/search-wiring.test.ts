// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { miuSource } from './miu-src'

/**
 * Wiring della ricerca rankizzata nella UI di μ.
 *
 * Contratto sulla sorgente inline (convenzione test DOM di μ): doFilter e
 * cascade usano window.searchRows quando disponibile, con fallback AND
 * letterale identico allo storico; l'ordine di pertinenza è preservato perché
 * il sort di colonna si applica DOPO e solo se attivo.
 */

const html = miuSource()

describe('wiring ricerca con thesaurus', () => {
  it('doFilter e cascade passano dal motore quando window.searchRows esiste', () => {
    const n = html.split('window.searchRows(').length - 1
    expect(n).toBeGreaterThanOrEqual(2) // doFilter + cascade
  })
  it('il fallback AND letterale storico resta per entrambe le vie', () => {
    const n = html.split("q.split(/\\s+/).every(t=>h.includes(normSearch(t)))").length - 1
    expect(n).toBeGreaterThanOrEqual(2)
  })
  it('il sort di colonna si applica dopo il ranking (vince se attivo)', () => {
    const doFilter = html.slice(html.indexOf('function doFilter()'))
    const iSearch = doFilter.indexOf('window.searchRows(')
    const iSort = doFilter.indexOf('if(S.sortCol)')
    expect(iSearch).toBeGreaterThan(-1)
    expect(iSort).toBeGreaterThan(iSearch)
  })
  it('a invitare alla ricerca a parole proprie è il suggerimento accanto al campo, non il placeholder', () => {
    // Il campo dice solo «Ricerca»: la spiegazione sta in #search-hint, ripeterla
    // dentro l'input era testo doppio sulla stessa riga.
    const doc = new JSDOM(html).window.document
    expect(doc.getElementById('search-input')!.getAttribute('placeholder')).toBe('Ricerca')
    expect(doc.getElementById('search-hint')!.textContent).toContain('Parole tue')
  })
})
