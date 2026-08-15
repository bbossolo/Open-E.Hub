import { describe, it, expect } from 'vitest'
import { syncDocs, TARGETS } from '../../scripts/sync-docs'

/**
 * Guardia anti-drift della documentazione: i blocchi AUTO nei doc (elenco tool,
 * stati, flusso di integrazione, "primi passi" del tour guidato) DEVONO combaciare
 * con le fonti di verità: src/hub/data/registry.ts e i vari data/tour.ts (hub +
 * ogni tool). Se questo test fallisce, la fonte è cambiata ma i doc no
 * → esegui `npm run sync:docs` (lo fa anche da solo la release su main).
 *
 * Fa parte di `npm test` (quindi di `npm run build`): un doc stale blocca il build.
 */
describe('doc sempre allineati al registry (anti-drift)', () => {
  it('nessun blocco AUTO è fuori sync — altrimenti: npm run sync:docs', () => {
    const { changed } = syncDocs(undefined, { check: true })
    expect(changed, `doc da rigenerare: ${changed.join(', ') || '—'}`).toEqual([])
  })

  it('i file target dichiarati esistono', () => {
    expect(TARGETS.length).toBeGreaterThan(0)
  })
})
