import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { miuSource } from './miu-src'

/**
 * Sistema dei pulsanti a 5 famiglie (✨ Livia, mockup approvato
 * docs/mockups/miu-sistema-pulsanti/), condiviso da tutta la suite: le
 * classi `.ehb-btn-fam-*`/`.ehb-rail*` vivono in src/shared/ui/components.css
 * (+ tokens.css per --fam-assign/--fam-export), μ le applica ai suoi
 * pulsanti in index.html/pricelist.css. Pin di contratto: se una futura
 * modifica toglie una classe famiglia da un'azione elencata qui, o
 * ri-accoppia i colori dedicati a un accento-tool, il test lo segnala.
 */

const html = miuSource()
const css = readFileSync(resolve(__dirname, '../../src/tools/miu/styles/pricelist.css'), 'utf8')
const sharedComponents = readFileSync(resolve(__dirname, '../../src/shared/ui/components.css'), 'utf8')
const sharedTokens = readFileSync(resolve(__dirname, '../../src/shared/ui/tokens.css'), 'utf8')

describe('shared/ui — le 5 famiglie e il rail sono nello SHARED, non duplicate per tool', () => {
  it('classi utility ehb-btn-fam-* per ognuna delle 5 famiglie, in components.css', () => {
    for (const cls of ['.ehb-btn-fam-nav', '.ehb-btn-fam-create', '.ehb-btn-fam-create-ghost', '.ehb-btn-fam-assign', '.ehb-btn-fam-danger-ghost', '.ehb-btn-fam-danger-outline', '.ehb-btn-fam-export']) {
      expect(sharedComponents, cls).toContain(cls + ' {')
    }
  })

  it('il rail di flusso (ehb-rail/ehb-rail-step) è nello shared', () => {
    expect(sharedComponents).toContain('.ehb-rail {')
    expect(sharedComponents).toContain('.ehb-rail-step {')
    expect(sharedComponents).toContain('[data-fam="create"]')
    expect(sharedComponents).toContain('[data-fam="assign"]')
    expect(sharedComponents).toContain('[data-fam="export"]')
  })

  it('Componi/Crea segue l\'accento del tool attivo (var(--accent)); Assegna/Esporta usano DUE COLORI DEDICATI, non un accento-tool esistente', () => {
    expect(sharedComponents).toMatch(/\.ehb-btn-fam-create\s*\{[^}]*var\(--accent\)/)
    expect(sharedComponents).toMatch(/\.ehb-btn-fam-assign\s*\{[^}]*var\(--fam-assign\)/)
    expect(sharedComponents).toMatch(/\.ehb-btn-fam-export\s*\{[^}]*var\(--fam-export\)/)
    expect(sharedTokens).toMatch(/--fam-assign:\s*#e0668c/)
    expect(sharedTokens).toMatch(/--fam-export:\s*#4fa8f2/)
    // i due colori dedicati non devono coincidere con NESSUNO dei 7 accenti-tool
    const toolAccents = ['#1ca371', '#19b6d8', '#df9a12', '#7d61e8', '#b23a5c', '#2d6ae0', '#9fb0c6']
    expect(toolAccents).not.toContain('#e0668c')
    expect(toolAccents).not.toContain('#4fa8f2')
  })

  it('pricelist.css NON duplica più le classi famiglia/rail (rimosse, si consumano dallo shared)', () => {
    expect(css).not.toMatch(/^\.btn-fam-nav\s*\{/m)
    expect(css).not.toMatch(/^\.rail\s*\{/m)
  })
})

describe('index.html — le famiglie sono applicate ai pulsanti reali (classi ehb-*)', () => {
  it('il rail è la NAVIGAZIONE persistente (4 passi, sopra ogni schermata), non un breadcrumb nei filtri', () => {
    // Il binario è uscito dal filter-bar: ora è un <nav> persistente sotto l'header e
    // guida setStep() — Cerca o componi · Misura · Categorizza · Esporta.
    const rail = html.match(/<nav id="miu-rail"[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(rail).toContain('class="ehb-rail miu-rail"')
    for (const step of ['cerca', 'misura', 'categorizza', 'esporta']) {
      expect(rail).toContain(`setStep('${step}')`)
    }
    expect(rail).toContain('Cerca o componi')
    // non è più duplicato dentro i filtri né nell'header del Computo
    const filterBar = html.match(/<div id="filter-bar"[\s\S]*?<div class="filter-toolbar">/)?.[0] ?? ''
    expect(filterBar).not.toContain('ehb-rail')
    const openCart = html.match(/function openCart\(\)[\s\S]*?\n}\n/)?.[0] ?? ''
    expect(openCart).not.toContain('class="ehb-rail"')
  })

  it('Componi/Crea: #componi-btn pieno, #ap-compose-btn ghost, Aggiungi/Aggiorna al computo pieni', () => {
    expect(css).toMatch(/#componi-btn\s*\{[^}]*background:\s*var\(--accent\)/)
    expect(css).toMatch(/#ap-compose-btn\s*\{[^}]*border:\s*1px dashed var\(--accent\)/)
    expect(html).toContain('cmp-tbtn cmp-tbtn--create')
    expect(html).toContain('class="ehb-btn-fam-create-ghost" onclick="misAddRiga(')
  })

  it('Assegna/Smart: popover categoria, selection-bar e 3 pulsanti rapidi in --fam-assign (mai --src-import, che marca i dati importati)', () => {
    expect(css).toMatch(/\.cart-ctx-item\.primary\s*\{\s*color:\s*var\(--fam-assign\)/)
    expect(css).toMatch(/\.cart-ctx-lv3 button\s*\{[^}]*var\(--fam-assign\)/)
    expect(css).toMatch(/\.cm-selbar button\.fam-assign\s*\{[^}]*var\(--fam-assign\)/)
    expect(html).toContain('class="fam-assign" onclick="cartOpenCatPopoverForSel')
  })

  it('Distruttivo: Svuota computo outline, riga di misura ghost, entrambi famiglia danger', () => {
    // «Svuota computo» torna alla home (setStep) invece di chiudere un modale: la famiglia resta danger-outline
    expect(html).toContain('ehb-btn-fam-danger-outline" onclick="clearCart();setStep(\'cerca\')"')
    expect(html).toContain('ehb-btn-fam-danger-ghost" onclick="misRemoveRiga(')
  })

  it('Esporta/Interscambio: copia Elenco Prezzi/▤ Computi in --fam-export', () => {
    expect(html).toContain('id="copy-btn" class="ehb-btn-fam-export"')
    expect(css).toMatch(/\.exp-grp button:hover\s*\{[^}]*var\(--fam-export\)/)
    expect(css).toMatch(/#carts-btn:hover\s*\{[^}]*var\(--fam-export\)/)
  })

  it('Naviga/Filtra: Reset filtri resta neutro (mai tinto d\'accento in hover)', () => {
    const rule = css.match(/#btn-reset:hover\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toContain('var(--accent)')
  })
})

describe('fix: "Σ modifica" apriva il Compositore dietro il Computo Metrico (z-index)', () => {
  it('.overlay (Compositore) sta sopra il Computo Metrico e le distinte (z-index:9999 via JS) e i loro popover/menu (10015-10030)', () => {
    const rule = css.match(/\.overlay\s*\{[^}]*\}/)?.[0] ?? ''
    const m = rule.match(/z-index:\s*(\d+)/)
    expect(m).toBeTruthy()
    const overlayZ = Number(m![1])
    expect(overlayZ).toBeGreaterThan(9999) // sopra cart/distinte-overlay
    expect(overlayZ).toBeGreaterThan(10030) // sopra cart-ctx (il più alto fra i popover del computo)
  })
})
