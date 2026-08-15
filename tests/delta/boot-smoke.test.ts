// @vitest-environment jsdom
/**
 * δ SI AVVIA DAVVERO — gemello dei boot smoke degli altri tool e dell'hub.
 *
 * I test di δ coprono bene l'engine PURO (expr, detect, columns, pdf-export…),
 * ma nessuno esegue lo strato DOM: uno split di `main.js` potrebbe lasciare il
 * tool morto senza far fallire niente. Questo test è la rete, scritta e verde
 * SUL MONOLITE prima di toccarlo.
 *
 * δ non aspetta DOMContentLoaded: la coda d'avvio gira all'import del modulo,
 * quindi il DOM di index.html va montato PRIMA.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const errors: unknown[] = []

beforeAll(async () => {
  const html = readFileSync(resolve(ROOT, 'src/tools/delta/index.html'), 'utf8')
  document.body.innerHTML = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '')
  document.documentElement.setAttribute('data-theme', 'light')
  // La guardia di sessione blocca l'apertura diretta di Delta.html: qui serve una
  // sessione valida, altrimenti il modulo lancia prima di arrivare al boot.
  sessionStorage.setItem('ehub:session', JSON.stringify({ user: 'test', exp: Date.now() + 9e6 }))
  window.addEventListener('error', (e) => errors.push(e))
  try {
    // @ts-expect-error — modulo JS senza dichiarazioni di tipo
    await import('../../src/tools/delta/main.js')
  } catch (e) {
    errors.push(e)
  }
})

describe('δ — avvio reale in jsdom', () => {
  it('i moduli valutano e la coda d\'avvio arriva in fondo senza errori', () => {
    expect(errors, errors.map(String).join('\n')).toEqual([])
  })

  it('gli handler degli attributi inline sono su window', () => {
    const w = window as unknown as Record<string, unknown>
    for (const fn of [
      'toggleTheme', 'showView', 'openGuide', 'closeGuide', 'startDeltaTour',
      'onTemplateFile', 'clearTemplate', 'addField', 'addStandardFields', 'detectCampi',
      'toggleDrawField', 'onElencoFile', 'clearElenco', 'previewStep', 'generaPDF', 'generaDXF',
      'confirmElencoVerify', 'cancelElencoVerify', 'detectColumnsNow', 'stampaAnteprimaCorrente',
      'zoomCampi', 'zoomGenera',
    ]) {
      expect(typeof w[fn], `window.${fn}`).toBe('function')
    }
  })

  it('showView commuta le tre viste (Template include l\'editor dei campi) e ne tiene visibile una sola', () => {
    const w = window as unknown as { showView: (v: string) => void }
    const VISTE = ['template', 'elenco', 'genera']
    for (const v of VISTE) {
      expect(() => w.showView(v), `showView('${v}')`).not.toThrow()
      const visibili = VISTE.filter((x) => {
        const el = document.getElementById('view' + x[0].toUpperCase() + x.slice(1))
        return el && !(el as HTMLElement).hidden
      })
      expect(visibili, `vista attiva dopo showView('${v}')`).toEqual([v])
    }
  })

  it('senza template il canvas invita a caricarlo, e il passo Template resta senza spunta finché manca il template (anche con campi già aggiunti)', () => {
    const w = window as unknown as { showView: (v: string) => void, addField: (k: string) => void }
    w.showView('template')
    // Il workbench (canvas + lista campi + proprietà) vive ora dentro viewTemplate
    // non c'è più una vista Campi separata con un proprio
    // empty-state. Senza S.template, renderCampi() mostra l'hint sul canvas.
    expect((document.getElementById('dCanvasEmptyHint') as HTMLElement).hidden, 'invito a caricare il template sul canvas').toBe(false)
    expect(document.getElementById('dTabTemplate')?.classList.contains('is-done'), 'passo Template non ancora spuntato senza template').toBe(false)
    w.addField('fixed')
    // Il passo si spunta solo con template E almeno un campo (updateRailProgress):
    // aggiungere un campo da solo, senza template applicato, non basta.
    expect(document.getElementById('dTabTemplate')?.classList.contains('is-done'), 'passo Template ancora senza spunta: manca il template').toBe(false)
  })

  it('stato di riposo (Home) della vista Template: editor nascosto, anteprima di sola lettura presente', () => {
    const w = window as unknown as { showView: (v: string) => void }
    w.showView('template')
    const home = document.getElementById('dTemplateHome') as HTMLElement
    const editor = document.getElementById('dTemplateEditorWrap') as HTMLElement
    expect(home, '#dTemplateHome presente').toBeTruthy()
    expect(editor, '#dTemplateEditorWrap presente').toBeTruthy()
    expect(home.hidden, 'Home visibile a riposo (editor non ancora aperto)').toBe(false)
    expect(editor.hidden, 'editor nascosto a riposo: nessun canvas/lista campi/proprietà in vista').toBe(true)
    expect(document.getElementById('dTemplatePreview'), 'l\'anteprima di sola lettura resta nella Home (sfondo + campi già composti)').toBeTruthy()
  })

  it('il tema si commuta senza errori', () => {
    const w = window as unknown as { toggleTheme: () => void }
    w.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    w.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
