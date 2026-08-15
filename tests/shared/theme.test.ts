// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { migrateSuiteTheme, resolveInitialTheme, resolvePalette, resolveStartupMode, applySuiteAesthetics } from '../../src/shared/theme'
import { PALETTES, DEFAULT_PALETTE, type HubToTool } from '../../src/shared/bus'

describe('resolveInitialTheme — default per-tool', () => {
  it('un data-theme già valido vince sul default', () => {
    expect(resolveInitialTheme('light', 'dark')).toBe('light')
    expect(resolveInitialTheme('dark', 'light')).toBe('dark')
  })
  it('senza data-theme valido usa il default del tool', () => {
    expect(resolveInitialTheme(undefined, 'light')).toBe('light')   // es. μ Prezzi
    expect(resolveInitialTheme(null, 'dark')).toBe('dark')
    expect(resolveInitialTheme('', 'dark')).toBe('dark')
    expect(resolveInitialTheme('garbage', 'dark')).toBe('dark')
  })
})

describe('resolvePalette — dimensione palette', () => {
  it('una palette nota già impostata vince sul default', () => {
    expect(resolvePalette('carbonio')).toBe('carbonio')
    expect(resolvePalette('pergamena')).toBe('pergamena')
    expect(resolvePalette('ardesia')).toBe('ardesia')
  })
  it('usa il fallback quando fornito e valido', () => {
    expect(resolvePalette(undefined, 'carbonio')).toBe('carbonio')
    expect(resolvePalette('garbage', 'pergamena')).toBe('pergamena')
  })
  it('valori sconosciuti/null/vuoti ricadono su inchiostro (default)', () => {
    expect(resolvePalette(null)).toBe('inchiostro')
    expect(resolvePalette('')).toBe('inchiostro')
    expect(resolvePalette(undefined)).toBe('inchiostro')
    expect(resolvePalette('blu')).toBe('inchiostro')
    expect(resolvePalette(42)).toBe('inchiostro')
    expect(resolvePalette('garbage', 'anch-essa-ignota' as never)).toBe('inchiostro')
  })
  it('è ortogonale al modo: palette e modo si risolvono in modo indipendente', () => {
    expect(resolvePalette('carbonio')).toBe('carbonio')
    expect(resolveInitialTheme('light', 'dark')).toBe('light')
    expect(resolveInitialTheme('dark', 'light')).toBe('dark')
    expect(resolvePalette('pergamena')).toBe('pergamena')
  })
  // Il catalogo cresce a ≥5 palette nominate; le 2 nuove risolvono a sé.
  it('risolve le nuove palette (notturno, inchiostro) a sé stesse', () => {
    expect(resolvePalette('notturno')).toBe('notturno')
    expect(resolvePalette('inchiostro')).toBe('inchiostro')
  })
  it('le nuove palette valgono come fallback valido', () => {
    expect(resolvePalette(undefined, 'notturno')).toBe('notturno')
    expect(resolvePalette('garbage', 'inchiostro')).toBe('inchiostro')
  })
})

describe('resolveStartupMode — modo unico di suite segue il sistema', () => {
  it('senza scelta utente segue il modo di sistema, ignorando lo stored', () => {
    expect(resolveStartupMode('dark', false, 'light')).toBe('light')
    expect(resolveStartupMode('light', false, 'dark')).toBe('dark')
  })
  it('con scelta utente "pinnata" vince lo stored, non il sistema', () => {
    expect(resolveStartupMode('light', true, 'dark')).toBe('light')
    expect(resolveStartupMode('dark', true, 'light')).toBe('dark')
  })
})

describe('catalogo PALETTES (≥5 palette, default invariato)', () => {
  it('contiene almeno 5 palette nominate', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(5)
  })
  it('include le 3 storiche + le 2 nuove (notturno, inchiostro)', () => {
    for (const p of ['ardesia', 'carbonio', 'pergamena', 'notturno', 'inchiostro']) {
      expect(PALETTES).toContain(p)
    }
  })
  it('inchiostro è la palette di default', () => {
    expect(DEFAULT_PALETTE).toBe('inchiostro')
    expect(resolvePalette('valore-ignoto')).toBe('inchiostro')
  })
  it('ogni voce del catalogo risolve a sé stessa', () => {
    for (const p of PALETTES) expect(resolvePalette(p)).toBe(p)
  })
})

describe('migrateSuiteTheme — stato persistito hub:theme', () => {
  it('migra la stringa legacy light/dark in {palette:ardesia, mode}', () => {
    expect(migrateSuiteTheme('light')).toEqual({ palette: 'inchiostro', mode: 'light' })
    expect(migrateSuiteTheme('dark')).toEqual({ palette: 'inchiostro', mode: 'dark' })
  })
  it('lascia invariato un oggetto valido (anche serializzato)', () => {
    const obj = { palette: 'carbonio', mode: 'light' }
    expect(migrateSuiteTheme(obj)).toEqual(obj)
    expect(migrateSuiteTheme(JSON.stringify(obj))).toEqual(obj)
    expect(migrateSuiteTheme({ palette: 'pergamena', mode: 'dark' }))
      .toEqual({ palette: 'pergamena', mode: 'dark' })
  })
  it('completa i campi mancanti/ignoti coi default senza scartare il valido', () => {
    expect(migrateSuiteTheme({ palette: 'carbonio' })).toEqual({ palette: 'carbonio', mode: 'dark' })
    expect(migrateSuiteTheme({ mode: 'light' })).toEqual({ palette: 'inchiostro', mode: 'light' })
    expect(migrateSuiteTheme({ palette: 'ignota', mode: 'blu' })).toEqual({ palette: 'inchiostro', mode: 'dark' })
  })
  it('ricade sul default per null/JSON corrotto/tipi non gestiti', () => {
    expect(migrateSuiteTheme(null)).toEqual({ palette: 'inchiostro', mode: 'dark' })
    expect(migrateSuiteTheme(undefined)).toEqual({ palette: 'inchiostro', mode: 'dark' })
    expect(migrateSuiteTheme('{corrotto')).toEqual({ palette: 'inchiostro', mode: 'dark' })
    expect(migrateSuiteTheme(123)).toEqual({ palette: 'inchiostro', mode: 'dark' })
  })
  // Anche le 2 nuove palette sono uno stato persistito valido invariato.
  it('lascia invariato uno stato con palette (notturno, inchiostro)', () => {
    expect(migrateSuiteTheme({ palette: 'notturno', mode: 'dark' }))
      .toEqual({ palette: 'notturno', mode: 'dark' })
    expect(migrateSuiteTheme({ palette: 'inchiostro', mode: 'light' }))
      .toEqual({ palette: 'inchiostro', mode: 'light' })
    expect(migrateSuiteTheme(JSON.stringify({ palette: 'notturno', mode: 'light' })))
      .toEqual({ palette: 'notturno', mode: 'light' })
  })
})

describe('applySuiteAesthetics — un solo punto per palette/font/text-size/motion/shadow', () => {
  const root = document.documentElement
  beforeEach(() => {
    delete root.dataset.palette; delete root.dataset.font; delete root.dataset.textScale
    delete root.dataset.motion; delete root.dataset.shadow
    root.style.removeProperty('--ui-scale')
  })

  it('hub:set-palette scrive data-palette', () => {
    applySuiteAesthetics({ type: 'hub:set-palette', palette: 'carbonio' } as HubToTool)
    expect(root.dataset.palette).toBe('carbonio')
  })
  it('hub:set-font scrive data-font', () => {
    applySuiteAesthetics({ type: 'hub:set-font', font: 'cormorant' } as HubToTool)
    expect(root.dataset.font).toBe('cormorant')
  })
  it('hub:set-text-size scrive data-text-scale e, se presente, la custom property --ui-scale', () => {
    applySuiteAesthetics({ type: 'hub:set-text-size', size: 'lg' } as HubToTool)
    expect(root.dataset.textScale).toBe('lg')
    expect(root.style.getPropertyValue('--ui-scale')).toBe('')
    applySuiteAesthetics({ type: 'hub:set-text-size', size: 'md', scale: 1.25 } as HubToTool)
    expect(root.style.getPropertyValue('--ui-scale')).toBe('1.25')
  })
  it('hub:set-motion scrive data-motion', () => {
    applySuiteAesthetics({ type: 'hub:set-motion', motion: 'reduced' } as HubToTool)
    expect(root.dataset.motion).toBe('reduced')
  })
  it('hub:set-shadow scrive data-shadow', () => {
    applySuiteAesthetics({ type: 'hub:set-shadow', shadow: 'flat' } as HubToTool)
    expect(root.dataset.shadow).toBe('flat')
  })
  it('un messaggio non estetico è no-op (non tocca il root)', () => {
    applySuiteAesthetics({ type: 'hub:set-theme', theme: 'dark' } as HubToTool)
    expect(root.dataset.palette).toBeUndefined()
    expect(root.dataset.font).toBeUndefined()
  })
})
