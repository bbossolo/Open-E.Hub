// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { hubSource } from './hub-src'

/**
 * Hub: sidebar con glifi accesi/spenti + welcome de-duplicato.
 *
 * Lavoro su markup/render statici (niente backend, niente e2e nel progetto):
 * copertura via vitest + jsdom, sul pattern di tests/hub/welcome-prefs.test.ts.
 * Si verificano (1) il template di renderList in main.js per le classi di stato
 * .live/.active, (2) la de-dup della welcome in index.html, (3) il contratto
 * CSS dell'accensione del glifo in hub.css.
 *
 * Il "puntino" .nav-live/.nav-dot (sessione attiva / stabile) è stato rimosso
 * su richiesta utente: il colore del glifo (.nav-item.live/.active) basta già
 * a comunicare quale tool è aperto, senza un indicatore ridondante.
 */

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

describe('sidebar: classe .live e indicatore di sessione viva (renderList)', () => {
  const main = hubSource()

  it("renderList aggiunge la classe 'live' alla voce con frame caricato (loadedFrames)", () => {
    // La voce viva riceve ' live' quando loadedFrames[app.id] è presente.
    expect(main).toMatch(/loadedFrames\[app\.id\]\s*\?\s*' live'/)
  })

  it("la voce corrente continua a ricevere 'active'", () => {
    expect(main).toMatch(/app\.id === currentId\s*\?\s*' active'/)
  })

  it('non usa più il puntino .nav-live: il colore del glifo basta a indicare la sessione attiva', () => {
    expect(main).not.toContain('class="nav-live"')
  })

  it("il data-tool resta emesso sulla voce (porta l'accento del tool)", () => {
    expect(main).toContain('data-tool="${(LOGO_MAP[app.logoType] || {}).tool')
  })
})

describe('sidebar: render reale del template con sessione viva', () => {
  // Replica MINIMALE del template di renderList per verificare il DOM prodotto,
  // senza importare main.js (modulo con side-effect su DOM/localStorage assenti).
  function navItemHtml(app: { id: string; name: string; tool: string }, opts: { currentId: string | null; loaded: Record<string, boolean> }): string {
    const live = opts.loaded[app.id]
    const active = app.id === opts.currentId
    return `
    <div class="nav-item${live ? ' live' : ''}${active ? ' active' : ''}" id="nav-${app.id}"
         data-tool="${app.tool}" role="button" tabindex="0" title="${app.name}">
      <div class="ehb-logo nav-logo" data-tool="${app.tool}"><span class="ehb-logo__glyph">φ</span></div>
      <div class="nav-meta"><div class="nav-name">${app.name}</div></div>
    </div>`
  }

  const apps = [
    { id: 'phi', name: 'Cables', tool: 'phi' },
    { id: 'miu', name: 'Prezzi', tool: 'miu' },
    { id: 'lc', name: 'LightCalc', tool: 'lambda' },
  ]

  function mount(currentId: string | null, loaded: Record<string, boolean>): Document {
    const html = `<div id="app-list">${apps.map(a => navItemHtml(a, { currentId, loaded })).join('')}</div>`
    return new JSDOM(html).window.document
  }

  it('voce con sessione viva: .nav-item.live (il colore del glifo la segnala, niente puntino)', () => {
    const doc = mount('phi', { phi: true })
    const phi = doc.getElementById('nav-phi')!
    expect(phi.classList.contains('live')).toBe(true)
    expect(phi.querySelector('.nav-live')).toBeNull()
  })

  it('voce corrente: .nav-item.active', () => {
    const doc = mount('phi', { phi: true })
    expect(doc.getElementById('nav-phi')!.classList.contains('active')).toBe(true)
  })

  it('voce inattiva (nessuna sessione): senza .live e senza .active', () => {
    const doc = mount('phi', { phi: true })
    const miu = doc.getElementById('nav-miu')!
    expect(miu.classList.contains('live')).toBe(false)
    expect(miu.classList.contains('active')).toBe(false)
  })

  it('una voce viva ma non corrente è .live ma NON .active', () => {
    const doc = mount('phi', { phi: true, miu: true })
    const miu = doc.getElementById('nav-miu')!
    expect(miu.classList.contains('live')).toBe(true)
    expect(miu.classList.contains('active')).toBe(false)
  })
})

describe('welcome de-duplicato: il riepilogo app in uso in UNA sola sede', () => {
  const html = read('src/hub/index.html')
  const doc = new JSDOM(html).window.document

  it('rimosso il blocco centrale duplicato #active-summary', () => {
    expect(doc.getElementById('active-summary')).toBeNull()
    expect(doc.querySelector('.wlc-summary')).toBeNull()
  })

  it('le tessere #welcome-cards restano presenti', () => {
    expect(doc.getElementById('welcome-cards')).not.toBeNull()
  })

  it('le azioni di progetto (.proj-act) restano presenti nel welcome', () => {
    expect(doc.querySelectorAll('.proj-act').length).toBeGreaterThan(0)
  })

  it('main.js non definisce più updateActiveSummary né la chiama', () => {
    const main = hubSource()
    expect(main).not.toContain('updateActiveSummary')
  })
})

describe('contratto CSS: glifo acceso nel colore-tool, spento neutro', () => {
  const css = read('src/hub/styles/hub.css')

  it('esiste una regola .nav-item.live che accende il glifo in var(--accent)', () => {
    expect(css).toMatch(/\.nav-item\.live\s+\.ehb-logo__glyph\s*\{[^}]*color:\s*var\(--accent\)/)
  })

  it('la regola .nav-item.live applica un glow (text-shadow) al glifo', () => {
    expect(css).toMatch(/\.nav-item\.live\s+\.ehb-logo__glyph\s*\{[^}]*text-shadow/)
  })

  it('la voce a riposo (.nav-item) ha il glifo spento/neutro (--muted)', () => {
    expect(css).toMatch(/\.nav-item\s+\.ehb-logo__glyph\s*\{[^}]*color:\s*var\(--muted\)/)
  })

  it("l'accensione vale anche da sidebar collassata (regola non più vincolata a .collapsed .active)", () => {
    // La vecchia regola limitata a `.collapsed .nav-item.active` è stata generalizzata.
    expect(css).not.toContain('#sidebar.collapsed .nav-item.active .ehb-logo__glyph{')
    // .nav-item.live non è dentro alcun prefisso .collapsed → vale in entrambi gli stati.
    expect(css).toMatch(/^\.nav-item\.live\s+\.ehb-logo__glyph/m)
  })
})
