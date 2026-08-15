// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * E2E REALE: carica index.html + moduli legacy veri in jsdom, dispatcha eventi
 * mouse veri sulla riga renderizzata da render.js/attachRowEvents (selezione.js)
 * e verifica il DOM risultante.
 *
 * Il click singolo su una riga dei risultati NON deve
 * più selezionare/aggiungere la voce (comportamento percepito come troppo
 * invasivo per la sola consultazione) — deve invece aprire il pannello dettaglio
 * laterale. Il doppio click prende il posto del vecchio click singolo (selezione).
 */
const ROOT = resolve(__dirname, '../..')

function loadIndexHtmlBody(): string {
  const html = readFileSync(resolve(ROOT, 'src/tools/miu/index.html'), 'utf8')
  return html.replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '')
}

function rigaTest() {
  return {
    codice: 'TEST.001', regione: 'Veneto', anno: '2026',
    disciplina: 'Impianti Elettrici', sistema: 'Quadri', settore: 'Quadro generale',
    desc_short: 'Quadro elettrico da test', declaratoria: 'Quadro elettrico da test, fornitura e posa',
    um: 'cad', prezzo: 100,
  }
}

async function setupMiu() {
  document.body.innerHTML = loadIndexHtmlBody()
  // @ts-expect-error — moduli JS legacy senza dichiarazioni (stesso pattern di ampere-add-to-cart-e2e.test.ts).
  const stato = await import('../../src/tools/miu/legacy/stato.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni.
  await import('../../src/tools/miu/legacy/index.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni.
  const renderMod = await import('../../src/tools/miu/legacy/render.js')
  return { S: stato.S as { filtered: unknown[]; view: string; searchSel: Set<string> }, render: renderMod.render as () => void }
}

describe('μ — click singolo vs doppio-click sulla riga dei risultati', () => {
  it('un click singolo apre il pannello dettaglio e NON tocca la selezione', async () => {
    const { S, render } = await setupMiu()
    S.filtered = [rigaTest()]
    S.view = 'table'
    render()

    const row = document.querySelector('#tbody tr[data-key]') as HTMLElement
    expect(row, 'riga renderizzata in tbody').toBeTruthy()
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(document.getElementById('detail-panel')!.classList.contains('open')).toBe(true)
    expect(document.getElementById('detail-code')!.textContent).toBe('TEST.001')
    expect(S.searchSel.size, 'il click singolo non deve selezionare la voce').toBe(0)
  })

  it('un doppio-click seleziona la voce (ex comportamento del click singolo) e NON apre il dettaglio', async () => {
    const { S, render } = await setupMiu()
    S.filtered = [rigaTest()]
    S.view = 'table'
    render()

    const row = document.querySelector('#tbody tr[data-key]') as HTMLElement
    expect(row, 'riga renderizzata in tbody').toBeTruthy()
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))

    expect(S.searchSel.size, 'il doppio-click deve selezionare la voce').toBe(1)
    expect(document.getElementById('detail-panel')!.classList.contains('open')).toBe(false)
  })
})
