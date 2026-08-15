// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * E2E REALE (non a contratto sul sorgente, come ampere-add-to-cart-e2e.test.ts):
 * carica DAVVERO index.html + i moduli legacy di μ in jsdom, chiama le funzioni
 * vere e verifica il DOM risultante.
 *
 * Copre due funzionalità:
 *  1. Vista "Capitoli" del Computo Metrico (raggruppa per disciplina/sistema/
 *     settore del prezzario sorgente) — e che il clic destro su una voce apra
 *     comunque il menu "Assegna categoria" (le foglie sono .cm-sel-row, quindi
 *     ereditano gratis wireCartSelection).
 *  2. Pannello Elenco Prezzi FLOTTANTE — si monta all'apertura del Computo,
 *     resta visibile a prescindere dal modo (anche in Categorizza, dove il
 *     vecchio dock spariva), e il suo stato (nascosto/aperto) sopravvive a un
 *     cambio vista.
 */
// jsdom/Node non forniscono sempre un vero localStorage nell'ambiente di test
// (stesso problema/stessa soluzione di tests/miu/results-bar.test.ts): senza
// questo shim in-memory, epFloatState/epFloatSave falliscono silenziosamente
// (try/catch) e lo stato del pannello flottante non persisterebbe fra le chiamate.
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

const ROOT = resolve(__dirname, '../..')

function loadIndexHtmlBody(): string {
  const html = readFileSync(resolve(ROOT, 'src/tools/miu/index.html'), 'utf8')
  return html.replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '')
}

type MiuWindow = Window & typeof globalThis & {
  openCart: () => void
  closeCart: () => void
  setStep: (step: string) => void
  cartSetView: (v: string) => void
  cartTreeToggle: (key: string) => void
  rowKey: (r: unknown) => string
  epFloatClose: () => void
  epFloatOpen: () => void
  epFloatSave: (patch: Partial<{ x: number | null; y: number | null; w: number; h: number; closed: boolean }>) => void
  epFloatState: () => { x: number | null; y: number | null; w: number; h: number; closed: boolean }
}

async function setupMiu() {
  document.body.innerHTML = loadIndexHtmlBody()
  localStorage.clear()
  // @ts-expect-error — moduli JS legacy senza dichiarazioni (stesso pattern di ampere-add-to-cart-e2e.test.ts).
  const stato = await import('../../src/tools/miu/legacy/stato.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni.
  await import('../../src/tools/miu/legacy/index.js')
  return { win: window as unknown as MiuWindow, S: stato.S as any }
}

function rigaCavidotto() {
  return {
    codice: 'RM.731012.Za001', regione: 'Veneto', anno: '2026',
    disciplina: 'Impianti Elettrici', sistema: 'Distribuzione', settore: 'Cavidotti',
    desc_short: 'Cavidotto flessibile in PE', declaratoria: 'Cavidotto flessibile in polietilene, corrugato Ø160mm',
    um: 'm', prezzo: 13.05,
  }
}

function rigaPozzetto() {
  return {
    codice: 'LOM261.1C.12.620.0120.a', regione: 'Veneto', anno: '2026',
    disciplina: 'Opere Edili', sistema: 'Pozzetti', settore: 'Prefabbricati',
    desc_short: 'Pozzetto prefabbricato in c.a.', declaratoria: 'Pozzetto prefabbricato in calcestruzzo 40x40',
    um: 'cad', prezzo: 83.65,
  }
}

describe('μ — vista "Capitoli" del Computo Metrico (E2E reale)', () => {
  it('raggruppa le voci per disciplina/sistema/settore, con conteggio e importo per nodo', async () => {
    const { win, S } = await setupMiu()
    const r1 = rigaCavidotto(), r2 = rigaPozzetto()
    S.archive.push({ filename: 'test.xlsx', regione: 'Veneto', anno: '2026', format: 'xlsx', loaded: true, rows: [r1, r2] })
    S.sel.add(win.rowKey(r1)); S.sel.add(win.rowKey(r2))
    S.qty[win.rowKey(r1)] = { qty: 10, um: 'm' }
    S.qty[win.rowKey(r2)] = { qty: 2, um: 'cad' }

    win.setStep('misura')
    win.cartSetView('capitoli')

    const ov = document.getElementById('cart-overlay')!
    expect(ov).not.toBeNull()
    const nodes = [...ov.querySelectorAll('.tnode')].map(n => n.querySelector('.tlabel')?.textContent)
    expect(nodes).toContain('Impianti Elettrici')
    expect(nodes).toContain('Opere Edili')
    // le foglie non sono ancora visibili: i capitoli partono chiusi
    expect(ov.querySelectorAll('.cm-sel-row.cm-lrow').length).toBe(0)
  })

  it('espandendo un capitolo compaiono le voci-foglia (.cm-sel-row): il clic destro apre "Assegna categoria"', async () => {
    const { win, S } = await setupMiu()
    const r1 = rigaCavidotto()
    S.archive.push({ filename: 'test.xlsx', regione: 'Veneto', anno: '2026', format: 'xlsx', loaded: true, rows: [r1] })
    S.sel.add(win.rowKey(r1))
    S.qty[win.rowKey(r1)] = { qty: 10, um: 'm' }

    win.setStep('misura')
    win.cartSetView('capitoli')

    let ov = document.getElementById('cart-overlay')!
    const nodo = [...ov.querySelectorAll<HTMLElement>('.tnode')].find(n => n.querySelector('.tlabel')?.textContent === 'Impianti Elettrici')!
    // chiamata diretta (non .click()): l'onclick inline generato da cartCapitoliNodeHtml
    // è una stringa risolta da jsdom nel contesto dell'elemento, non affidabile in test —
    // stesso motivo per cui gli altri E2E di μ (es. ampere-add-to-cart-e2e) chiamano le
    // funzioni reali invece di simulare il clic sull'attributo inline.
    expect(nodo.getAttribute('onclick')).toContain('cartTreeToggle(')
    // 3 livelli (disciplina › sistema › settore): serve espandere tutta la catena fino
    // alla foglia — stesso percorso costruito da cartCapitoliNodeHtml (prefix+'›'+label).
    win.cartTreeToggle('›Impianti Elettrici')
    win.cartTreeToggle('›Impianti Elettrici›Distribuzione')
    win.cartTreeToggle('›Impianti Elettrici›Distribuzione›Cavidotti')

    ov = document.getElementById('cart-overlay')!
    const foglia = ov.querySelector<HTMLElement>('.cm-sel-row[data-key]')!
    expect(foglia).not.toBeNull()
    expect(foglia.className).toContain('cm-lrow')

    foglia.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    const menu = document.getElementById('cart-ctx-menu')
    expect(menu).not.toBeNull()
    expect(menu!.textContent).toContain('Assegna categoria')
  })
})

describe('μ — pannello Elenco Prezzi FLOTTANTE (E2E reale)', () => {
  beforeEach(() => { localStorage.clear() })

  it('si monta quando il Computo si apre, indipendentemente dal modo (anche in Categorizza)', async () => {
    const { win } = await setupMiu()
    win.setStep('misura')
    expect(document.getElementById('ep-float-wrap')).not.toBeNull()
    expect(document.getElementById('ep-float')).not.toBeNull()

    win.setStep('categorizza')
    // il vecchio dock spariva in Categorizza — il flottante resta
    expect(document.getElementById('ep-float-wrap')).not.toBeNull()
    expect(document.getElementById('ep-float')).not.toBeNull()
  })

  it('si nasconde in una pillola e riappare da lì — lo stato sopravvive a un cambio vista', async () => {
    const { win } = await setupMiu()
    win.setStep('misura')
    expect(document.getElementById('ep-float')).not.toBeNull()

    win.epFloatClose()
    expect(document.getElementById('ep-float')).toBeNull()
    expect(document.querySelector('.ep-pill')).not.toBeNull()

    win.cartSetView('elenco') // cambio vista: refreshCartOverlayIfOpen → openCart → mountEpFloat
    expect(document.getElementById('ep-float')).toBeNull() // resta nascosto, non riappare da solo
    expect(document.querySelector('.ep-pill')).not.toBeNull()

    win.epFloatOpen()
    expect(document.getElementById('ep-float')).not.toBeNull()
  })

  it('si smonta chiudendo il Computo (setStep verso "cerca")', async () => {
    const { win } = await setupMiu()
    win.setStep('misura')
    expect(document.getElementById('ep-float-wrap')).not.toBeNull()
    win.setStep('cerca')
    expect(document.getElementById('ep-float-wrap')).toBeNull()
    expect(document.getElementById('cart-overlay')).toBeNull()
  })

  it('un semplice remount (refresh del Computo) non deve rimpicciolire una dimensione già salvata', async () => {
    // Bug reale: il pannello «tornava sempre piccolo».
    // Causa: ResizeObserver scatta una volta anche solo osservando (spec DOM), non solo
    // sui resize veri — e mountEpFloat ricrea l'observer a ogni refresh del Computo,
    // quindi ogni refresh ri-salvava la dimensione "attuale" del box come se fosse un
    // resize dell'utente, sovrascrivendo silenziosamente lo stato buono.
    // jsdom non implementa ResizeObserver: lo simuliamo qui per riprodurre esattamente
    // lo scatto "gratuito" che accade in un vero browser al primo observe().
    class FakeResizeObserver {
      cb: () => void
      constructor(cb: () => void) { this.cb = cb }
      observe() { this.cb() } // il vero ResizeObserver scatta subito una volta all'observe()
      disconnect() {}
    }
    const prevRO = (window as any).ResizeObserver
    ;(window as any).ResizeObserver = FakeResizeObserver

    try {
      const { win } = await setupMiu()
      // stato "buono", come se l'utente avesse già trascinato/ridimensionato il pannello
      win.epFloatSave({ w: 700, h: 550, x: 200, y: 90 })
      const before = win.epFloatState()
      expect(before.w).toBe(700)

      // un refresh qualunque del Computo (cambio vista, filtro, ecc.) rimonta il pannello
      // e riattacca un ResizeObserver nuovo — che scatta subito una volta da solo
      win.setStep('misura')
      win.cartSetView('elenco')

      const after = win.epFloatState()
      expect(after.w).toBe(700) // non deve essere stato sovrascritto dallo scatto "gratuito"
      expect(after.h).toBe(550)
    } finally {
      ;(window as any).ResizeObserver = prevRO
    }
  })
})
