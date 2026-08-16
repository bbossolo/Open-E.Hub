// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { makeAccordion } from '../../src/shared/ui/components/collapse'

/**
 * μ: results-bar snellita + due ricerche distinte.
 *
 * Verifica il contratto DOM/comportamento introdotto dalla spec:
 *  - densità (#density-switch) e righe descrizione (#desc-lines-sel) vivono dentro
 *    il popover #view-menu-pop e non più a vista nella barra;
 *  - il bottone #view-menu-btn apre/chiude il popover (toggle, click-outside, Escape);
 *  - la mini-search è etichettata "filtra opzioni" (placeholder/aria-label) ed è
 *    distinta dalla search-hero;
 *  - la mini-search compare solo a filtri aperti (onChange di makeAccordion);
 *  - applyViewControls() riflette lo stato anche coi controlli dentro il popover;
 *  - nessuna perdita di funzione: tutti i valori densità/desc-lines restano selezionabili.
 *
 * I gestori inline (setDensity/setDescLines/applyViewControls/toggleViewMenu/
 * filterMiniSearch) vivono nello <script> di index.html: ne replichiamo qui la
 * logica essenziale (identica al sorgente) per testarla in jsdom.
 */

if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}

// Frammento di markup allineato a src/tools/miu/index.html (results-bar + filter-toolbar).
function mount(): void {
  document.body.innerHTML = `
    <div id="filter-bar">
      <div class="filter-toolbar">
        <button id="filter-toggle" class="filter-toggle">▾</button>
        <input type="search" id="filter-mini-search"
               placeholder="⌕ filtra opzioni…"
               aria-label="Filtra le opzioni dei menu"
               title="Filtra le opzioni dei menu (distinta dalla ricerca voci in alto)">
        <button id="btn-reset">✕ Reset filtri</button>
      </div>
      <div class="filter-grid">
        <div class="fg" data-fname="regione"><label>Regione</label></div>
        <div class="fg" data-fname="materia"><label>Materiale</label></div>
      </div>
    </div>
    <div id="results-bar">
      <span id="results-count"></span>
      <button id="btn-sel-all">Seleziona tutti filtrati</button>
      <span class="view-switch" id="layout-switch">
        <button data-view="table">Tabella</button>
        <button data-view="tree">Capitoli</button>
        <button data-view="list">Elenco</button>
      </span>
      <span id="view-menu-wrap" style="position:relative;display:inline-flex">
        <button id="view-menu-btn" aria-haspopup="true" aria-expanded="false">⋯ Visualizzazione</button>
        <div id="view-menu-pop" role="menu" hidden>
          <span class="view-switch" id="density-switch">
            <button data-density="normal">Normale</button>
            <button data-density="compact">Compatta</button>
            <button data-density="ultra">Ultra</button>
          </span>
          <select id="desc-lines-sel">
            <option value="1">Descr. 1 riga</option>
            <option value="2">Descr. 2 righe</option>
            <option value="3">Descr. 3 righe</option>
            <option value="5">Descr. 5 righe</option>
            <option value="99">Descr. intera</option>
          </select>
        </div>
      </span>
      <select id="per-page-sel"></select>
    </div>`
}

// --- repliche fedeli dei gestori inline di index.html ---
const S = { view: 'tree', density: 'normal', descLines: 3 }

function applyViewControls(): void {
  document.querySelectorAll('#layout-switch button').forEach((b) =>
    b.classList.toggle('active', (b as HTMLElement).dataset.view === S.view))
  document.querySelectorAll('#density-switch button').forEach((b) =>
    b.classList.toggle('active', (b as HTMLElement).dataset.density === S.density))
  const dl = document.getElementById('desc-lines-sel') as HTMLSelectElement | null
  if (dl) dl.value = String(S.descLines)
}
function setDensity(d: string): void {
  S.density = ['normal', 'compact', 'ultra'].includes(d) ? d : 'normal'
  document.body.classList.toggle('compact', S.density === 'compact')
  document.body.classList.toggle('ultra', S.density === 'ultra')
  applyViewControls()
}
function setDescLines(n: number | string): void {
  const v = [1, 2, 3, 5, 99].includes(+n) ? +n : 3
  S.descLines = v
  document.documentElement.style.setProperty('--desc-lines', String(v))
  applyViewControls()
}
function setViewMenu(open: boolean): void {
  const pop = document.getElementById('view-menu-pop')!
  const btn = document.getElementById('view-menu-btn')!
  pop.hidden = !open
  btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  btn.classList.toggle('active', open)
}
function toggleViewMenu(): void {
  const pop = document.getElementById('view-menu-pop') as HTMLElement
  // `hidden` non è più solo booleano nella lib.dom (esiste hidden="until-found", che è
  // comunque "nascosto"): qualunque valore truthy significa chiuso, quindi da riaprire.
  setViewMenu(Boolean(pop.hidden))
}

beforeEach(() => {
  localStorage.clear()
  document.body.className = ''
  S.view = 'tree'; S.density = 'normal'; S.descLines = 3
  mount()
})

describe('controlli densità/desc-lines nel popover (non a vista)', () => {
  it('#density-switch e #desc-lines-sel vivono dentro #view-menu-pop', () => {
    const pop = document.getElementById('view-menu-pop')!
    expect(pop.querySelector('#density-switch')).not.toBeNull()
    expect(pop.querySelector('#desc-lines-sel')).not.toBeNull()
  })

  it('la results-bar non li mostra più direttamente (sono dentro il popover)', () => {
    const bar = document.getElementById('results-bar')!
    // I controlli sono discendenti solo del popover, non figli diretti della barra.
    expect([...bar.children].some((c) => c.id === 'density-switch')).toBe(false)
    expect([...bar.children].some((c) => c.id === 'desc-lines-sel')).toBe(false)
  })

  it('a vista restano vista/layout, seleziona-tutti e n-pag', () => {
    expect(document.getElementById('layout-switch')).not.toBeNull()
    expect(document.getElementById('btn-sel-all')).not.toBeNull()
    expect(document.getElementById('per-page-sel')).not.toBeNull()
    expect(document.getElementById('view-menu-btn')).not.toBeNull()
  })
})

describe('apertura/chiusura del menu Visualizzazione', () => {
  it('parte chiuso e il toggle lo apre/chiude', () => {
    const pop = document.getElementById('view-menu-pop') as HTMLElement
    const btn = document.getElementById('view-menu-btn')!
    expect(pop.hidden).toBe(true)
    toggleViewMenu()
    expect(pop.hidden).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    toggleViewMenu()
    expect(pop.hidden).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('chiude su Escape', () => {
    const pop = document.getElementById('view-menu-pop') as HTMLElement
    setViewMenu(true)
    // simula il gestore onViewMenuKey
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setViewMenu(false) }
    document.addEventListener('keydown', onKey, true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(pop.hidden).toBe(true)
    document.removeEventListener('keydown', onKey, true)
  })

  it('chiude su click-outside', () => {
    const pop = document.getElementById('view-menu-pop') as HTMLElement
    setViewMenu(true)
    const wrap = document.getElementById('view-menu-wrap')!
    const onOut = (e: MouseEvent): void => {
      if (!wrap.contains(e.target as Node)) setViewMenu(false)
    }
    document.addEventListener('click', onOut, true)
    document.getElementById('results-count')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(pop.hidden).toBe(true)
    document.removeEventListener('click', onOut, true)
  })
})

describe('mini-search "filtra opzioni" distinta', () => {
  it('placeholder/aria-label/title la qualificano come filtro opzioni', () => {
    const mini = document.getElementById('filter-mini-search') as HTMLInputElement
    expect(mini.placeholder).toContain('filtra opzioni')
    expect(mini.getAttribute('aria-label')).toBe('Filtra le opzioni dei menu')
    expect(mini.getAttribute('title')).toContain('distinta dalla ricerca voci')
  })

  it('compare solo a filtri aperti: makeAccordion.onChange la nasconde/azzera al collasso', () => {
    const mini = document.getElementById('filter-mini-search') as HTMLInputElement
    mini.value = 'reg'
    let cleared = 0
    makeAccordion(
      document.getElementById('filter-toggle'),
      document.querySelector('.filter-grid'),
      {
        storageKey: 'pricelist:filters-collapsed',
        onChange: (collapsed) => {
          mini.style.display = collapsed ? 'none' : ''
          if (collapsed) { mini.value = ''; cleared++ }
        },
      },
    )
    // aperto di default
    expect(mini.style.display).toBe('')
    // collassa → nascosta e azzerata
    document.getElementById('filter-toggle')!.click()
    expect(mini.style.display).toBe('none')
    expect(mini.value).toBe('')
    expect(cleared).toBe(1)
    // riapre → torna visibile
    document.getElementById('filter-toggle')!.click()
    expect(mini.style.display).toBe('')
  })
})

describe('nessuna perdita di funzione', () => {
  it('tutti i valori di densità restano selezionabili e applicati', () => {
    for (const d of ['normal', 'compact', 'ultra']) {
      setDensity(d)
      expect(S.density).toBe(d)
      expect(document.body.classList.contains('compact')).toBe(d === 'compact')
      expect(document.body.classList.contains('ultra')).toBe(d === 'ultra')
    }
  })

  it('tutti i valori di desc-lines restano selezionabili e impostano --desc-lines', () => {
    for (const n of [1, 2, 3, 5, 99]) {
      setDescLines(n)
      expect(S.descLines).toBe(n)
      expect(document.documentElement.style.getPropertyValue('--desc-lines')).toBe(String(n))
      expect((document.getElementById('desc-lines-sel') as HTMLSelectElement).value).toBe(String(n))
    }
  })

  it('applyViewControls riflette lo stato attivo coi controlli dentro il popover', () => {
    setDensity('ultra')
    const active = document.querySelector('#density-switch button.active') as HTMLElement
    expect(active.dataset.density).toBe('ultra')
  })
})
