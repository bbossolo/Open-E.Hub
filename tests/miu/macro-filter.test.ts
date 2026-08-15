// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { miuSource } from './miu-src'

/**
 * μ: macrocategorie impianti come filtro a monte dei capitoli.
 *
 * Verifica il contratto DOM del chip-group (#macro-chips a monte della
 * filter-grid) e il wiring dei punti di caricamento (r.macro assegnato ovunque
 * si assegna r.tematica), come da convenzione dei test DOM di μ (vedi
 * settore-filter.test.ts).
 *
 * NOTA (Open E.Hub): il flusso utente end-to-end (classificazione reale di
 * righe in macrocategorie/tematiche, ed elenco ufficiale MACROCATEGORIE) è
 * stato rimosso da questo file — dipende dal vocabolario proprietario in
 * `compositore-catalog:*`, che in questa distribuzione è vuoto per design
 * (vedi src/shared/compositore/catalog-data-empty.ts). Con dati vuoti
 * `macrocategorieFor`/`classifyTematica` non hanno un output "corretto" da
 * asserire: quel comportamento è responsabilità del catalogo che l'utente
 * finale porta con sé, non di questo codice.
 */

const html = miuSource()
const indexDom = (): Document => new JSDOM(html).window.document

describe('contratto DOM del filtro macrocategorie', () => {
  it('#macro-chips esiste dentro #filter-bar, a monte della filter-grid', () => {
    const doc = indexDom()
    const chips = doc.getElementById('macro-chips')
    expect(chips).toBeTruthy()
    expect(chips!.closest('#filter-bar')).toBeTruthy()
    const bar = doc.getElementById('filter-bar')!
    const order = [...bar.querySelectorAll('#macro-chips, .filter-grid')]
    expect(order[0]!.id).toBe('macro-chips')
  })

  it('la sorgente inline contiene la guardia macro in doFilter e il reset della chiave', () => {
    expect(html).toContain("if(macro&&!(r.macro||[]).includes(macro)) return false;")
    expect(html).toContain("sessionStorage.removeItem(MACRO_KEY)")
  })

  it('entrambi i punti di caricamento legacy assegnano r.macro accanto a r.tematica', () => {
    const n = html.split('r.macro=window.macrocategorieFor(r)').length - 1
    expect(n).toBe(2)
  })
})
