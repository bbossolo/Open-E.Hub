import { describe, it, expect } from 'vitest'
import { parseHubMessage, PALETTES, type HubToTool, type ToolToHub } from '../../src/shared/bus'
import { bundleEhubProject, parseEhubProject } from '../../src/shared/ehub-project'

/**
 * INTERCONNESSIONE BUS — ciclo "Progetto Open E.Hub".
 *
 * Verifica il giro completo del salvataggio/ripristino dello stato del programma
 * sulle sole strutture dati (niente DOM, niente postMessage reale):
 *   hub:collect-state  → ogni tool risponde con app:full-state
 *                      → bundleEhubProject impacchetta gli stati (.ehub)
 *                      → parseEhubProject li ri-legge
 *                      → hub:restore-state consegna lo stato per appId.
 *
 * Affianca tests/shared/bus.test.ts (validazione set-theme/project-state)
 * coprendo i messaggi del Progetto Open E.Hub richiesti dalla spec.
 */

describe('parseHubMessage — messaggi del Progetto Open E.Hub', () => {
  it('accetta hub:collect-state senza payload', () => {
    const m = parseHubMessage({ type: 'hub:collect-state' })
    expect(m).toEqual({ type: 'hub:collect-state' })
  })

  it('accetta hub:restore-state con state (con o senza appId)', () => {
    expect(parseHubMessage({ type: 'hub:restore-state', appId: 'gamma', state: { v: 5 } })?.type)
      .toBe('hub:restore-state')
    // appId opzionale: lo stato basta a renderlo valido
    expect(parseHubMessage({ type: 'hub:restore-state', state: null })?.type).toBe('hub:restore-state')
  })

  it('rifiuta hub:restore-state senza la chiave state', () => {
    expect(parseHubMessage({ type: 'hub:restore-state', appId: 'gamma' })).toBeNull()
  })

  it('rifiuta messaggi tool→hub e tipi sconosciuti sul canale hub', () => {
    expect(parseHubMessage({ type: 'app:full-state', appId: 'gamma', state: {} })).toBeNull()
    expect(parseHubMessage({ type: 'hub:collect' })).toBeNull()
  })

  it('accetta hub:shared-plan con plan valido (cavidotti/circuiti liste)', () => {
    const m = parseHubMessage({ type: 'hub:shared-plan', plan: { dxf: null, cavidotti: [], circuiti: [] }, replay: true })
    expect(m?.type).toBe('hub:shared-plan')
  })

  it('rifiuta hub:shared-plan senza plan o con liste mancanti', () => {
    expect(parseHubMessage({ type: 'hub:shared-plan' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:shared-plan', plan: { cavidotti: [] } })).toBeNull()
  })
})

describe('ciclo collect-state → app:full-state → bundle/parse → restore-state', () => {
  // Stato "vero" che ciascun tool serializzerebbe (es. il carrello di μ).
  const TOOL_STATES: Record<string, unknown> = {
    'gamma': { v: 5, circuits: [{ id: 'c1' }] },
    'miu-price-list': { cart: ['voce-A', 'voce-B'] },
    'tau-documenti': { computo: { rows: 3 } },
  }
  const NOW = 1_700_000_000_000

  // Simula un tool che riceve hub:collect-state e risponde con app:full-state.
  function respondToCollect(appId: string, collect: HubToTool): ToolToHub {
    expect(collect.type).toBe('hub:collect-state')
    return { type: 'app:full-state', appId, state: TOOL_STATES[appId] }
  }

  it('raccoglie gli stati dei tool e li ripristina identici via .ehub', () => {
    // 1) L'hub trasmette collect-state; ogni tool lo valida e risponde.
    const collect = parseHubMessage({ type: 'hub:collect-state' })
    expect(collect).not.toBeNull()
    const responses = Object.keys(TOOL_STATES).map((id) => respondToCollect(id, collect as HubToTool))
    expect(responses.every((r) => r.type === 'app:full-state')).toBe(true)

    // 2) L'hub impacchetta le app:full-state in un Progetto Open E.Hub.
    const collected = Object.fromEntries(
      responses.map((r) => [(r as { appId: string }).appId, (r as { state: unknown }).state]),
    )
    const bundle = bundleEhubProject(collected, { now: NOW, name: 'Cantiere ciclo' })

    // 3) Serializza in .ehub e rilegge.
    const reopened = parseEhubProject(JSON.stringify(bundle))
    expect(reopened.name).toBe('Cantiere ciclo')
    expect(Object.keys(reopened.tools).sort()).toEqual(Object.keys(TOOL_STATES).sort())

    // 4) L'hub costruisce un restore-state per appId; ogni tool lo riceve valido
    //    e ritrova lo stato originale (chiusura del giro).
    for (const appId of Object.keys(reopened.tools)) {
      const restore = parseHubMessage({ type: 'hub:restore-state', appId, state: reopened.tools[appId] })
      expect(restore, `restore-state per ${appId} deve essere valido`).not.toBeNull()
      expect((restore as { appId: string }).appId).toBe(appId)
      expect((restore as { state: unknown }).state).toEqual(TOOL_STATES[appId])
    }
  })

  it('un tool senza stato (null) non finisce nel .ehub né genera un restore', () => {
    const collected = { 'gamma': { v: 5 }, 'lightcalc-road': null }
    const bundle = bundleEhubProject(collected, { now: NOW })
    const reopened = parseEhubProject(JSON.stringify(bundle))
    expect('lightcalc-road' in reopened.tools).toBe(false)
    expect(Object.keys(reopened.tools)).toEqual(['gamma'])
  })
})

/**
 * INTERCONNESSIONE BUS — ciclo tema/palette.
 *
 * Riproduce, sulle sole strutture dati, il giro che initTheme (src/shared/theme.ts)
 * fa nel tool: l'hub manda hub:set-theme(modo+palette), il tool lo valida, applica
 * e RIBATTE app:theme con entrambe le dimensioni. Verifica che il contratto esteso
 * preservi modo e palette e che i messaggi legacy (solo modo) restino validi.
 */
describe('ciclo hub:set-theme(palette+modo) → app:theme', () => {
  // Eco simmetrica come la fa initTheme: applica modo e (se presente) palette.
  function echoTheme(set: HubToTool): ToolToHub {
    expect(set.type).toBe('hub:set-theme')
    const s = set as { type: 'hub:set-theme'; theme: 'light' | 'dark'; palette?: string }
    const echo: ToolToHub = { type: 'app:theme', theme: s.theme }
    if (s.palette !== undefined) (echo as { palette?: string }).palette = s.palette
    return echo
  }

  it('preserva sia il modo sia la palette lungo il giro set-theme → app:theme', () => {
    for (const palette of ['ardesia', 'carbonio', 'pergamena']) {
      for (const theme of ['light', 'dark'] as const) {
        const set = parseHubMessage({ type: 'hub:set-theme', theme, palette })
        expect(set, `set-theme ${theme}/${palette} deve essere valido`).not.toBeNull()
        const echo = echoTheme(set as HubToTool)
        expect(echo).toEqual({ type: 'app:theme', theme, palette })
      }
    }
  })

  it('il giro legacy col solo modo non introduce una palette', () => {
    const set = parseHubMessage({ type: 'hub:set-theme', theme: 'light' })
    expect(set).toEqual({ type: 'hub:set-theme', theme: 'light' })
    const echo = echoTheme(set as HubToTool)
    expect(echo).toEqual({ type: 'app:theme', theme: 'light' })
    expect('palette' in echo).toBe(false)
  })

  it('una palette malformata rompe il giro a monte (set-theme rifiutato)', () => {
    expect(parseHubMessage({ type: 'hub:set-theme', theme: 'dark', palette: 'arancio' })).toBeNull()
  })

  // Il giro deve preservare anche le nuove palette del catalogo esteso.
  it('preserva ogni voce del catalogo PALETTES (incluse notturno/inchiostro) lungo il giro', () => {
    for (const palette of PALETTES) {
      for (const theme of ['light', 'dark'] as const) {
        const set = parseHubMessage({ type: 'hub:set-theme', theme, palette })
        expect(set, `set-theme ${theme}/${palette} deve essere valido`).not.toBeNull()
        const echo = echoTheme(set as HubToTool)
        expect(echo).toEqual({ type: 'app:theme', theme, palette })
      }
    }
  })
})
