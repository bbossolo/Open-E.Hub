// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { miuSource } from './miu-src'

/**
 * Schermata leggera di μ — implementazione del mockup approvato
 * (docs/mockups/miu-schermata-leggera/index.html).
 *
 * Un solo controllo primario per fascia (header, filtri, export, colonne
 * tabella, sidebar), il resto dietro un popover/drawer aperto al bisogno —
 * nessuna funzione tolta, solo messa in quiete. Convenzione dei test DOM di
 * μ: contratto su markup/sorgente inline (miuSource()) + jsdom, come
 * search-wiring.test.ts/macro-filter.test.ts.
 */

const html = miuSource()
const indexDom = (): Document => new JSDOM(html).window.document

describe('header alleggerito — popover "⋯ Altro"', () => {
  it('tema e guida restano sempre a vista (come in ogni altro tool); le azioni secondarie vivono in #more-menu-pop', () => {
    const doc = indexDom()
    const actions = doc.querySelector('.ehb-hdr__actions')!
    expect(actions.querySelector('#theme-toggle')).toBeTruthy()
    expect(actions.querySelector('#guide-btn')).toBeTruthy()
    expect(actions.querySelector('#more-btn')).toBeTruthy()
    const pop = doc.getElementById('more-menu-pop')!
    expect(pop).toBeTruthy()
    expect(pop.querySelector('#guide-btn'), '#guide-btn NON deve essere nel popover ⋯ Altro').toBeNull()
    for (const id of ['carts-btn', 'drop-zone', 'ampere-btn', 'folder-btn']) {
      expect(pop.querySelector(`#${id}`), `#${id} nel popover ⋯ Altro`).toBeTruthy()
    }
  })

  it('toggleMoreMenu/onMoreMenuOutside/onMoreMenuKey esistono, mirror di setViewMenu', () => {
    expect(html).toContain('function setMoreMenu(')
    expect(html).toContain('function toggleMoreMenu(')
    expect(html).toContain('function onMoreMenuOutside(')
    expect(html).toContain('function onMoreMenuKey(')
  })

  it('le funzioni del popover sono esposte su window per gli onclick inline', () => {
    expect(html).toMatch(/Object\.assign\(window,\s*\{[\s\S]*toggleMoreMenu[\s\S]*\}\)/)
  })
})

describe('filtri alleggeriti — "Filtri ▾" + drawer', () => {
  it('#filtri-btn sostituisce il vecchio #filter-toggle; niente id #filter-toggle residuo', () => {
    const doc = indexDom()
    expect(doc.getElementById('filtri-btn')).toBeTruthy()
    expect(doc.getElementById('filter-toggle')).toBeFalsy()
  })

  it('#macro-chips resta discendente di #filter-bar e PRIMA di .filter-grid (invariato)', () => {
    const doc = indexDom()
    const bar = doc.getElementById('filter-bar')!
    const chips = doc.getElementById('macro-chips')!
    expect(chips.closest('#filter-bar')).toBe(bar)
    const order = [...bar.querySelectorAll('#macro-chips, .filter-grid')]
    expect(order[0].id).toBe('macro-chips')
  })

  it('#filtri-drawer contiene mini-search, reset, macro-chips e filter-grid', () => {
    const doc = indexDom()
    const drawer = doc.getElementById('filtri-drawer')!
    expect(drawer.querySelector('#filter-mini-search')).toBeTruthy()
    expect(drawer.querySelector('#btn-reset')).toBeTruthy()
    expect(drawer.querySelector('#macro-chips')).toBeTruthy()
    expect(drawer.querySelector('.filter-grid')).toBeTruthy()
  })

  it('#cart-btn (Computo Metrico) resta SEMPRE visibile fuori dal drawer filtri', () => {
    const doc = indexDom()
    const drawer = doc.getElementById('filtri-drawer')!
    expect(drawer.querySelector('#cart-btn')).toBeFalsy()
    expect(doc.getElementById('cart-btn')).toBeTruthy()
  })

  it('main.ts collega #filtri-btn/#filtri-drawer con makeAccordion, default collassato', () => {
    const mainTs = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/miu/main.ts'), 'utf8',
    )
    expect(mainTs).toContain("document.getElementById('filtri-btn')")
    expect(mainTs).toContain("document.getElementById('filtri-drawer')")
    expect(mainTs).toContain("localStorage.setItem('pricelist:filters-collapsed', '1')")
  })

  it('countActiveFiltri/updateFiltriBtnLabel esistono e sono richiamati da doFilter', () => {
    expect(html).toContain('function countActiveFiltri(')
    expect(html).toContain('function updateFiltriBtnLabel(')
    const doFilter = html.slice(html.indexOf('function doFilter('), html.indexOf('function countActiveFiltri('))
    expect(doFilter).toContain('updateFiltriBtnLabel();')
  })
})

describe('export alleggerito — "Esporta ▾" + popover', () => {
  it('#export-menu-btn/#export-menu-pop esistono con le destinazioni sull\'intero computo, incluse quelle di Analisi Prezzi', () => {
    const doc = indexDom()
    expect(doc.getElementById('export-menu-btn')).toBeTruthy()
    const pop = doc.getElementById('export-menu-pop')!
    expect(pop).toBeTruthy()
    for (const id of ['pdf-report-btn', 'export-ap-xls-btn', 'export-ap-pdf-btn', 'goto-esporta-btn']) {
      expect(pop.querySelector(`#${id}`), `#${id} nel popover Esporta`).toBeTruthy()
    }
  })

  it('copy-btn è FUORI dal popover Esporta — sempre visibile nella toolbar di ricerca', () => {
    const doc = indexDom()
    const pop = doc.getElementById('export-menu-pop')!
    for (const id of ['copy-btn']) {
      expect(pop.querySelector(`#${id}`), `#${id} NON deve essere nel popover Esporta`).toBeNull()
      const el = doc.getElementById(id)
      expect(el, `#${id} deve esistere fuori dal popover`).toBeTruthy()
      expect(el!.getAttribute('style')||'', `#${id} non deve essere display:none`).not.toContain('display:none')
    }
  })

  it('#export-menu-btn usa la famiglia colore Esporta/Interscambio (ehb-btn-fam-export)', () => {
    const doc = indexDom()
    expect(doc.getElementById('export-menu-btn')!.className).toContain('ehb-btn-fam-export')
  })

  it('copy-btn usa la stessa famiglia colore di #export-menu-btn (stessa azione, sempre visibile)', () => {
    const doc = indexDom()
    for (const id of ['copy-btn']) {
      expect(doc.getElementById(id)!.className, `#${id}`).toContain('ehb-btn-fam-export')
    }
  })

  it('Σ Analisi Prezzi (search-hero) resta visibile fuori da ogni overflow — non è una voce secondaria', () => {
    const doc = indexDom()
    const hero = doc.getElementById('search-hero')!
    expect(hero.querySelector('#ap-compose-btn')).toBeTruthy()
    expect(doc.getElementById('more-menu-pop')!.querySelector('#ap-compose-btn')).toBeFalsy()
    expect(doc.getElementById('export-menu-pop')!.querySelector('#ap-compose-btn')).toBeFalsy()
  })

  it('#export-overlay (accesso completo dal binario) resta intatto, non sostituito dal popover', () => {
    const doc = indexDom()
    expect(doc.getElementById('export-overlay')).toBeTruthy()
    expect(doc.getElementById('export-ap-xls')).toBeTruthy()
    expect(doc.getElementById('export-ap-pdf')).toBeTruthy()
  })
})

describe('tabella — toggle "Colonne · tutte/meno" nel view-menu esistente', () => {
  it('#columns-switch è dentro #view-menu-pop (nessun nuovo popover)', () => {
    const doc = indexDom()
    const pop = doc.getElementById('view-menu-pop')!
    expect(pop.querySelector('#columns-switch')).toBeTruthy()
  })

  it('setColumns esiste, persiste in plColumns e applica .cols-lean su #dtable', () => {
    expect(html).toContain('function setColumns(')
    const setColumns = html.slice(html.indexOf('function setColumns('), html.indexOf('function setColumns(') + 400)
    expect(setColumns).toContain("localStorage.setItem('plColumns'")
    expect(setColumns).toContain("classList.toggle('cols-lean'")
  })

  it('.cols-lean nasconde regione/anno/disciplina/importo netto, non la descrizione', () => {
    const css = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/miu/styles/pricelist.css'), 'utf8',
    )
    expect(css).toMatch(/#dtable\.cols-lean[\s\S]*display:\s*none/)
    expect(css).not.toMatch(/#dtable\.cols-lean[\s\S]{0,400}\.td\b[\s\S]{0,50}display:\s*none/)
  })
})

describe('sidebar collassata — mostra il prezzario attivo', () => {
  it('#sidebar-collapsed-label esiste ed è aggiornato da renderSidebar/loadItem', () => {
    const doc = indexDom()
    expect(doc.getElementById('sidebar-collapsed-label')).toBeTruthy()
    expect(html).toContain('function activePrezzarioLabel(')
    expect(html).toContain('function updateSidebarCollapsedLabel(')
    const renderSidebar = html.slice(html.indexOf('function renderSidebar('), html.indexOf('function renderSidebar(') + 400)
    expect(renderSidebar).toContain('updateSidebarCollapsedLabel();')
  })

  it('activePrezzarioLabel replicata: usa regione+anno, o filename, o "Prezzari" senza prezzario attivo', () => {
    function activePrezzarioLabel(archive: { regione?: string; anno?: string; filename?: string }[], active: number): string {
      const item = archive[active]
      if (!item) return 'Prezzari'
      if (item.regione && item.regione !== 'Sconosciuta') return item.anno && item.anno !== '—' ? `${item.regione} ${item.anno}` : item.regione
      return item.filename || 'Prezzari'
    }
    expect(activePrezzarioLabel([], 0)).toBe('Prezzari')
    expect(activePrezzarioLabel([{ regione: 'Veneto', anno: '2026' }], 0)).toBe('Veneto 2026')
    expect(activePrezzarioLabel([{ regione: 'Sconosciuta', filename: 'listino.xlsx' }], 0)).toBe('listino.xlsx')
  })

  it('la meccanica di collasso (makeCollapse su #sidebar) resta invariata', () => {
    const mainTs = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/miu/main.ts'), 'utf8',
    )
    expect(mainTs).toContain("makeCollapse(")
    expect(mainTs).toContain("'miu:sidebar-collapsed'")
  })
})

describe('selezione dei risultati — il dock "Da copiare"', () => {
  it('le voci selezionate hanno un pannello proprio (#sel-dock), non un contatore nella results-bar', () => {
    const doc = indexDom()
    const bar = doc.getElementById('results-bar')!
    expect(bar.querySelector('#btn-sel-all'), '"Seleziona tutti filtrati" resta nella barra').toBeTruthy()
    expect(doc.getElementById('sel-count'), 'il vecchio contatore è sostituito dal dock').toBeNull()

    const dock = doc.getElementById('sel-dock')!
    expect(dock).toBeTruthy()
    expect(dock.hasAttribute('hidden'), 'a selezione vuota il dock non occupa spazio').toBe(true)
    // conteggio + totale, la mini-lista da cui togliere una voce, e il comando di copia
    for (const id of ['sel-dock-n', 'sel-dock-tot', 'sel-dock-list', 'sel-dock-cta', 'sel-dock-clear', 'sel-dock-fold']) {
      expect(dock.querySelector('#' + id), `#${id} manca nel dock`).toBeTruthy()
    }
    expect(doc.getElementById('sel-dock-cta')!.getAttribute('onclick')).toContain('showCopyPopup()')
    expect(doc.getElementById('sel-dock-clear')!.getAttribute('onclick')).toContain('clearSearchSel()')
  })

  it('renderSelDock disegna le voci da S.searchSel e le rende removibili una a una', () => {
    const fn = html.slice(html.indexOf('function renderSelDock('), html.indexOf('function renderSelDock(') + 1800)
    expect(fn).toContain('S.searchSel.size')
    expect(fn).toContain('rowsBySearchSel()')
    expect(fn, 'la ✕ di riga toglie la voce dalla selezione').toContain('_selSet(li.dataset.key,false)')
  })

  it('updateCartInfo ridisegna il dock a ogni variazione di selezione', () => {
    const updateCartInfo = html.slice(html.indexOf('function updateCartInfo('), html.indexOf('function updateCartInfo(') + 1800)
    expect(updateCartInfo).toContain('renderSelDock()')
  })
})
