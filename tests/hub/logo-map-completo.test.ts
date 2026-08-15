import { describe, it, expect } from 'vitest'
import { APP_REGISTRY } from '../../src/hub/data/registry'
import { hubSource } from './hub-src'

/**
 * Guardia anti-drift: LOGO_MAP (src/hub/ui/shell.js) è una SECONDA lista dei tool,
 * separata da TOOL_GLYPH_KEY (src/shared/ui/glyphs.ts) — un tool registrato in
 * `APP_REGISTRY` ma dimenticato qui non va in errore: cade silenziosamente sul
 * fallback `{ tool: 'hub', glyph: '◇' }` (accento grigio neutro, glifo a diamante
 * invece della lettera del tool). Già successo due volte — un
 * bug visivo che passa i test finché nessuno lo guarda a schermo.
 *
 * shell.js è codice sorgente non tipizzato (niente allowJs nel tsconfig): come il
 * resto dei test hub (vedi hub-src.ts), si verifica sul TESTO sorgente invece di
 * importarlo — stesso pattern di sidebar-live-glyphs.test.ts.
 */
describe('LOGO_MAP · nessun tool del registry cade sul fallback ◇', () => {
  const src = hubSource()
  const blocco = /const LOGO_MAP = \{([\s\S]*?)\n\};/.exec(src)

  it('LOGO_MAP è presente e non vuoto nel sorgente hub', () => {
    expect(blocco, 'LOGO_MAP non trovato in src/hub/ui/shell.js (spostato o rinominato?)').toBeTruthy()
  })

  const chiavi = new Set([...(blocco?.[1] || '').matchAll(/^\s*([a-zA-Z0-9_-]+):\s*\{/gm)].map((m) => m[1]!))

  it('ogni logoType di APP_REGISTRY ha una voce in LOGO_MAP', () => {
    for (const app of APP_REGISTRY) {
      expect(chiavi.has(app.logoType), `LOGO_MAP non ha '${app.logoType}' (${app.name}) — la card cadrebbe sul fallback hub/◇`).toBe(true)
    }
  })
})
