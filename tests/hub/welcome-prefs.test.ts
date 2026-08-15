// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

/**
 * Separazione fra azioni di progetto e preferenze di tema.
 *
 * Il toggle tema chiaro/scuro (prima un gruppo .wlc-prefs/.wlc-theme-toggle
 * nella welcome) è stato spostato in sidebar (#theme-btn, accanto alla
 * versione hub): era duplicato rispetto a quanto ora vive solo lì, e la
 * welcome comprimeva lo spazio verticale di #welcome-cards.
 */

const SRC = resolve(__dirname, '../..')
function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8')
}

describe('welcome hub: nessun toggle tema duplicato', () => {
  const html = read('src/hub/index.html')
  const dom = new JSDOM(html)
  const doc = dom.window.document

  it('il toggle tema NON è più nella welcome (.wlc-prefs/.wlc-theme-toggle rimossi)', () => {
    expect(doc.querySelector('#welcome .wlc-prefs')).toBeNull()
    expect(doc.querySelector('#welcome .wlc-theme-toggle')).toBeNull()
  })

  it('il toggle tema vive in sidebar, #theme-btn accanto alla versione hub', () => {
    const themeBtn = doc.querySelector('#stat-row #theme-btn')
    expect(themeBtn).not.toBeNull()
    expect(themeBtn!.getAttribute('onclick')).toBe('toggleTheme()')
    expect(doc.getElementById('stat-hubver')).not.toBeNull()
  })

  it('la palette resta nel menu grafico separato (Aspetto), non nella welcome', () => {
    expect(doc.querySelector('#welcome [data-palette-opt]')).toBeNull()
    const appearance = doc.querySelector('#appearance-overlay')
    expect(appearance).not.toBeNull()
    expect(appearance!.querySelectorAll('[data-palette-opt]').length).toBe(5)
  })

  it('le azioni progetto (.proj-act) restano FUORI dal welcome', () => {
    expect(doc.querySelector('#welcome .proj-act')).toBeNull()
    expect(doc.querySelectorAll('.proj-act').length).toBeGreaterThan(0)
  })
})

