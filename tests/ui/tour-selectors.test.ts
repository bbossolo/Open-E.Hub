import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Tour } from '../../src/shared/ui/components/tour'
import { HUB_TOUR } from '../../src/hub/data/tour'
import { MIU_TOUR } from '../../src/tools/miu/data/tour'

/**
 * GUARDIA DEL TOUR GUIDATO: ogni step punta a un elemento che esiste DAVVERO.
 *
 * Un tour era morto in silenzio: il refactor del rail aveva rinominato i pulsanti
 * (`#oCentraleBtn` → `#rtCentrale`…) e 4 step su 5 puntavano nel vuoto. `visibleTarget()`
 * salta gli step senza bersaglio, quindi non c'era né errore né schermata rotta: il tour
 * semplicemente non compariva più. E siccome i «primi passi» della Guida Utente si
 * generano dagli step (`AUTO:guide:<tool>`), la documentazione ereditava lo stesso buco.
 *
 * Un selettore morto non fa rumore da solo: questo test è il rumore.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

const TOURS: Array<{ tour: Tour; html: string }> = [
  { tour: HUB_TOUR, html: 'src/hub/index.html' },
  { tour: MIU_TOUR, html: 'src/tools/miu/index.html' },
]

/** Il bersaglio è dichiarato nell'HTML? (`#id` → `id="…"`, `.classe` → `class="… …"`) */
function esisteNelMarkup(selector: string, html: string): boolean {
  if (selector.startsWith('#')) {
    const id = selector.slice(1)
    return new RegExp(`id=["']${id}["']`).test(html)
  }
  if (selector.startsWith('.')) {
    const cls = selector.slice(1)
    return new RegExp(`class=["'][^"']*\\b${cls}\\b`).test(html)
  }
  return new RegExp(`<${selector}\\b`).test(html)
}

describe('tour guidato: ogni step ha un bersaglio che esiste', () => {
  for (const { tour, html } of TOURS) {
    it(`«${tour.id}» — tutti i selettori esistono in ${html}`, () => {
      const markup = readFileSync(resolve(ROOT, html), 'utf8')
      const morti = tour.steps.map(s => s.selector).filter(sel => !esisteNelMarkup(sel, markup))
      expect(morti, `selettori inesistenti nel tour «${tour.id}»: ${morti.join(', ')}`).toEqual([])
    })

    it(`«${tour.id}» — ha almeno uno step`, () => {
      expect(tour.steps.length).toBeGreaterThan(0)
    })
  }
})
