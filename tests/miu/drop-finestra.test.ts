// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { miuSource } from './miu-src'

/**
 * Bug: trascinare un prezzario nella finestra all'avvio non faceva nulla.
 *
 * Causa: initDropZone() collegava il drop SOLO a #drop-zone — che vive dentro il
 * popover "⋯ Altro" e all'avvio non è nemmeno a schermo — e sulla finestra
 * registrava un `preventDefault` e basta. Così il browser non apriva più il file
 * (default soppresso) e nessun handler lo raccoglieva: il gesto spariva nel nulla.
 *
 * Contratto: il drop di FILE sull'intera finestra deve arrivare ad addFiles(), e
 * i drag INTERNI di μ (chip categoria, voci verso il computo, che usano tipi
 * text/*) non devono essere intercettati.
 *
 * Convenzione dei test DOM di μ: contratto sulla sorgente (miuSource()).
 */

const html = miuSource()
const initDropZone = html.slice(
  html.indexOf('export function initDropZone('),
  html.indexOf('export async function loadItem('),
)

describe('μ — trascinare un prezzario nella finestra', () => {
  it('il drop sulla finestra passa i file ad addFiles (non più solo preventDefault)', () => {
    const dropSuFinestra = initDropZone.slice(initDropZone.indexOf("window.addEventListener('drop'"))
    expect(dropSuFinestra).toContain('addFiles(files)')
  })

  it('reagisce solo ai trascinamenti di FILE, per non rubare i drag interni', () => {
    expect(initDropZone).toContain("Array.from(dt.types||[]).includes('Files')")
    // sia dragover sia drop passano dalla guardia
    const guardie = initDropZone.match(/if\(!isFileDrag\(e\.dataTransfer\)\) return/g) || []
    expect(guardie.length).toBeGreaterThanOrEqual(2)
  })

  it('durante il trascinamento la finestra lo dice (velo .file-dragover), e poi lo toglie', () => {
    expect(initDropZone).toContain("document.body.classList.add('file-dragover')")
    expect(initDropZone).toContain("document.body.classList.remove('file-dragover')")
    const css = readFileSync(
      resolve(__dirname, '../../src/tools/miu/styles/pricelist.css'), 'utf8',
    )
    expect(css).toContain('body.file-dragover::after')
  })

  it('#drop-zone resta collegata: chi apre "⋯ Altro" continua a poterci cliccare sopra', () => {
    expect(initDropZone).toContain("const dz=document.getElementById('drop-zone')")
    expect(initDropZone).toContain('if(dz){')
  })
})

describe('μ — quale formato di prezzario conviene portare', () => {
  it('la schermata iniziale indica .xml come formato consigliato, e dice perché', () => {
    const statePanel = html.slice(html.indexOf('<div id="state-panel"'), html.indexOf('<!-- TABLE AREA -->'))
    expect(statePanel).toMatch(/Formato consigliato: \.xml/)
    expect(statePanel).toMatch(/parser dedicato/)
    expect(statePanel).toMatch(/primo foglio/) // il limite dell'.xlsx, detto esplicitamente
  })

  it('lo dice anche il titolo della zona di trascinamento', () => {
    const dz = html.slice(html.indexOf('<label id="drop-zone"'), html.indexOf('</label>'))
    expect(dz).toMatch(/\.xml \(formato preferibile/)
    expect(dz).toMatch(/METEL/)
  })
})
