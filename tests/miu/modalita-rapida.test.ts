// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { miuSource } from './miu-src'

/**
 * Modalità Rapida / Completa di μ — implementazione del mockup approvato
 * (docs/mockups/miu-modalita-rapida/index.html).
 *
 * «Rapida» (predefinita) è la consultazione: cerca nei prezzari, seleziona,
 * copia l'Elenco Prezzi. «Completa» è il flusso di computo intero,
 * invariato. Il contratto che questi test presidiano è che la Rapida NASCONDA
 * soltanto — nessuna funzione rimossa, nessun dato toccato: il computo resta
 * popolato e torna intatto rientrando in Completa.
 */

const html = miuSource()
const doc = (): Document => new JSDOM(html).window.document
const css = readFileSync(resolve(__dirname, '../../src/tools/miu/styles/pricelist.css'), 'utf8')

describe('il toggle di modalità', () => {
  it('vive in testa alla barra filtri, con due sole posizioni', () => {
    const d = doc()
    const toggle = d.getElementById('mode-toggle')!
    expect(toggle).toBeTruthy()
    expect(toggle.closest('.filter-toolbar'), 'il toggle governa i comandi che lo seguono').toBeTruthy()
    const modi = [...toggle.querySelectorAll('button')].map((b) => b.getAttribute('data-mode'))
    expect(modi).toEqual(['rapida', 'completa'])
    for (const b of toggle.querySelectorAll('button')) {
      expect(b.getAttribute('onclick')).toMatch(/^setMode\('(rapida|completa)'\)$/)
    }
  })

  it('setMode commuta la classe sul body e ricorda la scelta in miu:mode', () => {
    const fn = html.slice(html.indexOf('function setMode('), html.indexOf('function setMode(') + 1200)
    expect(fn).toContain("classList.toggle('miu-rapida'")
    expect(fn).toContain("classList.toggle('miu-completa'")
    expect(fn).toContain('localStorage.setItem(MIU_MODE_KEY')
    expect(html).toContain("const MIU_MODE_KEY='miu:mode'")
  })

  it('la modalità predefinita è Rapida, ma un computo già popolato apre in Completa', () => {
    const init = html.slice(html.indexOf('function initMiuMode('), html.indexOf('function initMiuMode(') + 400)
    expect(init, "senza preferenza salvata si parte in Rapida").toContain(
      "setMode(saved==='completa'?'completa':'rapida', false)",
    )
    const auto = html.slice(html.indexOf('function miuAutoModeForComputo('), html.indexOf('function miuAutoModeForComputo(') + 500)
    expect(auto).toContain("setMode('completa', false)")
    expect(auto, 'una scelta esplicita dell\'utente non viene scavalcata').toContain('if(saved) return')
  })
})

describe('cosa la Rapida mette a tacere', () => {
  const richiestiFullOnly = [
    'cart-btn', 'btn-cart-clear',      // Computo Metrico
    'btn-add-sel',                     // ＋ Aggiungi al computo
    'export-menu-wrap',                // export avanzati
    'componi-btn', 'ap-compose-btn',   // compositore e analisi prezzi
    'carts-btn', 'ampere-btn', // computi salvati e distinta Ampère
    'detail-add-cart', 'detail-compose',
    'rail-computo',
  ]

  it.each(richiestiFullOnly)('%s è marcato [data-full]', (id) => {
    expect(doc().getElementById(id)!.hasAttribute('data-full')).toBe(true)
  })

  it('del binario resta solo il passo "Cerca o componi"', () => {
    const d = doc()
    const passi = [...d.querySelectorAll('#miu-rail .ehb-rail-step')]
    const visibili = passi.filter((p) => !p.hasAttribute('data-full')).map((p) => p.getAttribute('data-step'))
    expect(visibili).toEqual(['cerca'])
  })

  it('ciò che serve a consultare e copiare NON è marcato [data-full]', () => {
    const d = doc()
    for (const id of ['search-input', 'filtri-btn', 'copy-btn', 'btn-sel-all', 'sel-dock-cta']) {
      expect(d.getElementById(id)!.hasAttribute('data-full'), `#${id} deve restare in Rapida`).toBe(false)
    }
  })

  it('il CSS nasconde [data-full] e la colonna Misura solo in Rapida', () => {
    expect(css).toContain('body.miu-rapida [data-full] { display: none !important; }')
    expect(css).toMatch(/body\.miu-rapida \.tmis-h/)
    expect(css).toMatch(/body\.miu-rapida \.tv-mis/)
    expect(css).toMatch(/body\.miu-rapida \.li-mis/)
  })

  it('nascondere non cancella: nessuna svuotata del computo nel cambio di modalità', () => {
    const fn = html.slice(html.indexOf('function setMode('), html.indexOf('function setMode(') + 1200)
    expect(fn).not.toContain('clearCart')
    expect(fn).not.toContain('S.sel.clear')
    expect(fn).not.toContain('S.custom.clear')
  })

  it('in Rapida le scorciatoie dei passi 2·3·4 non portano su viste invisibili', () => {
    expect(html).toContain("if(CURRENT_MODE==='rapida') return;")
  })
})

describe('il dock non si mangia i risultati', () => {
  it('l\'elenco ha un tetto regolabile e una maniglia di trascinamento', () => {
    expect(doc().getElementById('sel-dock-resize'), 'maniglia sul bordo superiore').toBeTruthy()
    expect(css).toMatch(/#sel-dock-list \{[^}]*max-height: var\(--sel-dock-h, \d+px\)/s)
    expect(css).toMatch(/#sel-dock-resize \{[^}]*cursor: row-resize/s)
  })

  it('il resizer è quello condiviso, su asse y e limitato a metà finestra', () => {
    const main = readFileSync(resolve(__dirname, '../../src/tools/miu/main.ts'), 'utf8')
    const call = main.slice(main.indexOf("cssVar: '--sel-dock-h'") - 120, main.indexOf("cssVar: '--sel-dock-h'") + 260)
    expect(call).toContain('makeResizer(')
    expect(call).toContain("axis: 'y'")
    expect(call).toContain('window.innerHeight * 0.5')
    expect(call).toContain("storageKey: 'miu:sel-dock-h'")
  })
})
