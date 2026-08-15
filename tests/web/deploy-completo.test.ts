import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_REGISTRY } from '../../src/hub/data/registry'
import { hubSource } from '../hub/hub-src'

/**
 * Guardia: OGNI tool registrato nell'hub deve essere davvero costruito e
 * spedito, in tutte le catene di build.
 *
 * È già successo che un tool nuovo restasse fuori da una di queste liste
 * (Gamma mancante dalla demo pubblica, fix v9.4.1, quando esisteva ancora
 * un'edizione web separata da quella desktop). Il sintomo è insidioso —
 * l'hub mostra la card del tool, ma aprirlo dà 404, perché in locale il
 * file a root esiste comunque.
 *
 * Open E.Hub ha una sola edizione (offline-first, nessun backend/login):
 * le catene da tenere allineate al registry sono
 *  - vite.config.ts  → TOOL_INPUT: come si compila il tool
 *  - place-builds.mjs → cutover verso gli HTML a root
 *  - build-web.mjs → TOOLS: compilazione di tutti i tool per la build web/desktop
 */

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

/**
 * Il legame file-a-root ↔ cartella sorgente NON è più duplicato qui: viene da
 * `AppDef.srcDir` (campo obbligatorio del registry). Prima era una mappa scritta
 * a mano — la quinta lista che poteva divergere.
 */
describe('deploy completo — nessun tool registrato resta indietro', () => {
  const tools = APP_REGISTRY.map((a) => ({ file: a.file, dir: a.srcDir }))
  const files = [...new Set(APP_REGISTRY.map((a) => a.file))]

  it('ogni tool del registry dichiara una cartella sorgente esistente', () => {
    for (const t of tools) {
      expect(
        existsSync(resolve(ROOT, 'src/tools', t.dir, 'index.html')),
        `srcDir '${t.dir}' di ${t.file} non esiste in src/tools/`,
      ).toBe(true)
    }
  })

  it('vite.config.ts sa compilare ogni tool del registry', () => {
    const vite = read('vite.config.ts')
    for (const t of tools) {
      expect(vite, `TOOL_INPUT non ha '${t.dir}' (serve per compilare ${t.file})`).toContain(`src/tools/${t.dir}/index.html`)
    }
  })

  it('place-builds.mjs porta ogni tool nel file a root che l\'hub apre', () => {
    const place = read('scripts/place-builds.mjs')
    for (const f of files) {
      expect(place, `place-builds.mjs non copia mai '${f}'`).toContain(`'${f}'`)
    }
  })

  it('build-web.mjs compila ogni tool registrato (il bug di Gamma v9.4.1)', () => {
    const web = read('scripts/build-web.mjs')
    for (const t of tools) {
      expect(web, `il tool '${t.dir}' manca da TOOLS in build-web.mjs`).toMatch(
        new RegExp(`TOOLS\\s*=\\s*\\[[^\\]]*'${t.dir}'`, 's'),
      )
    }
  })

  /**
   * La quarta lista, quella che è sfuggita a questa stessa guardia: in edizione
   * web l'hub non può listare una cartella via HTTP, quindi `listHtml()` ritorna
   * un elenco. Finché era scritto a mano, δ Pages risultava «file non trovato»
   * in produzione pur essendo nel deploy. Deve DERIVARE dal registry: un elenco
   * letterale tornerebbe a poter divergere.
   */
  it('WEB_TOOL_FILES è derivato dal registry, non un elenco scritto a mano', () => {
    const hub = hubSource()
    const decl = /const WEB_TOOL_FILES = \[([^\]]*)\]/.exec(hub)
    expect(decl, 'WEB_TOOL_FILES non trovato in src/hub/main.js').toBeTruthy()
    expect(
      decl![1],
      'WEB_TOOL_FILES deve derivare da APP_REGISTRY (…APP_REGISTRY.map(a => a.file)): ' +
        'un elenco scritto a mano diverge dal registry e i tool nuovi diventano irraggiungibili',
    ).toContain('APP_REGISTRY')
    // nessun file di tool elencato a mano oltre all'hub stesso
    const letterali = [...decl![1].matchAll(/'([^']+\.html)'/g)].map((m) => m[1]).filter((n) => n !== 'EHub.html')
    expect(letterali, `file elencati a mano invece che dal registry: ${letterali.join(', ')}`).toEqual([])
  })
})
