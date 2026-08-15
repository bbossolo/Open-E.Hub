// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initTheme } from '../../src/shared/theme'
import { parseHubMessage } from '../../src/shared/bus'
import { miuSource } from '../miu/miu-src'
import { hubSource } from '../hub/hub-src'

/**
 * TEMA UNICO DI SUITE + TOGGLE IN OGNI APP + PALETTE PROPAGATA.
 *
 * Decisione di prodotto aggiornata dall'utente:
 *  - il MODO (light/dark) è UNICO per tutta la suite (niente più default per-tool):
 *    l'hub inietta il `data-theme` di suite nello srcdoc di OGNI tool;
 *  - ogni tool ESPONE COMUNQUE un toggle ☾/☀ nel suo header, ma al boot ONORA il
 *    `data-theme` iniettato (non hardcoda più 'dark'/'light') e lo ri-annuncia
 *    identico via `app:theme` → l'hub non lo scambia per un toggle e non ribalta;
 *  - un toggle dentro un tool propaga a TUTTA la suite via `app:theme`;
 *  - la PALETTE è di suite e ORTOGONALE: viaggia su `hub:set-palette`.
 */

const SRC = resolve(__dirname, '../..')
function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8')
}

/** Sorgenti per tool (html + script) e default tema atteso. I tool il cui script è
 *  spezzato in più moduli espongono un helper `extra` che li concatena tutti: μ ha
 *  legacy/*.js (estratto da index.html), altri hanno ui/*.js (split di main.js). */
const TOOLS: Record<string, { files: string[]; defaultTheme: 'light' | 'dark'; extra?: () => string }> = {
  'μ Prezzi': { files: [], defaultTheme: 'light', extra: miuSource },
}

describe('tema per-tool — toggle locale ripristinato', () => {
  for (const [tool, { files, extra }] of Object.entries(TOOLS)) {
    const blob = files.map(read).join('\n') + (extra ? '\n' + extra() : '')

    it(`${tool}: espone un button toggle tema nell'header`, () => {
      expect(blob).toMatch(/id="(theme-toggle|btnTheme)"/)
    })

    it(`${tool}: definisce una funzione toggleTheme()`, () => {
      expect(blob).toMatch(/function\s+toggleTheme\b/)
    })

    it(`${tool}: gestisce sia hub:set-theme (push hub) sia hub:set-palette (palette)`, () => {
      expect(blob).toContain('hub:set-theme')
      // direttamente ('hub:set-palette' nel proprio onHubMessage) oppure via
      // l'helper condiviso applySuiteAesthetics (shared/theme.ts), che la gestisce.
      expect(blob).toMatch(/hub:set-palette|applySuiteAesthetics/)
    })
  }

  it('modo UNICO: l\'hub inietta il data-theme di suite nello srcdoc di ogni tool', () => {
    const hub = hubSource()
    // injectSuiteThemeIntoHtml deve iniettare ANCHE il data-theme (oltre alla palette).
    expect(hub).toMatch(/injectSuiteThemeIntoHtml/)
    expect(hub).toMatch(/injectAttr\([^)]*['"]data-theme['"]/)
  })

  it('nessun tool hardcoda il modo al boot: ONORA il data-theme iniettato', () => {
    expect(miuSource()).toMatch(/dataset\.theme|getAttribute\(['"]data-theme['"]\)/)
  })
})

/**
 * La scorciatoia 'T' è cablata nell'hub SOLO per la sua chrome (sidebar/home):
 * un tool vive nel proprio iframe, il keydown non risale al padre — ogni tool
 * deve legarla da sé (bindThemeShortcut condiviso, o l'equivalente inline per
 * μ che non è un modulo ES). Bug corretto: nessun tool la legava prima.
 */
describe('scorciatoia T del tema — legata in OGNI tool (non solo nell\'hub)', () => {
  const MODULE_TOOLS = ['alfa', 'delta']
  for (const tool of MODULE_TOOLS) {
    it(`${tool}: chiama bindThemeShortcut(toggleTheme)`, () => {
      const src = read(`src/tools/${tool}/main.js`)
      expect(src).toMatch(/bindThemeShortcut/)
      expect(src).toMatch(/bindThemeShortcut\s*\(\s*toggleTheme\s*\)/)
    })
  }
  it('μ (script non-modulo): lega un keydown locale su \'t\' che chiama toggleTheme', () => {
    const src = miuSource()
    expect(src).toMatch(/keydown/)
    expect(src).toMatch(/e\.key\.toLowerCase\(\)\s*[!=]==\s*'t'/)
  })
})

describe('bus — hub:set-palette è un messaggio valido e disaccoppiato dal tema', () => {
  it('accetta hub:set-palette con palette nota', () => {
    expect(parseHubMessage({ type: 'hub:set-palette', palette: 'carbonio' }))
      .toEqual({ type: 'hub:set-palette', palette: 'carbonio' })
  })
  it('rifiuta hub:set-palette con palette ignota', () => {
    expect(parseHubMessage({ type: 'hub:set-palette', palette: 'fucsia' })).toBeNull()
  })
})

describe('hub:set-theme aggiorna ancora <html> (push esplicito del picker)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-palette')
  })

  it('applica data-theme e data-palette ricevuti dal picker dell\'hub', () => {
    const stop = initTheme({ defaultTheme: 'dark', defaultPalette: 'ardesia' })
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hub:set-theme', theme: 'light', palette: 'carbonio' },
      }),
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.palette).toBe('carbonio')
    stop()
  })

  it('un messaggio legacy col solo theme lascia la palette invariata', () => {
    document.documentElement.dataset.palette = 'pergamena'
    const stop = initTheme({ defaultTheme: 'dark', defaultPalette: 'pergamena' })
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hub:set-theme', theme: 'dark' },
      }),
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('pergamena')
    stop()
  })
})
