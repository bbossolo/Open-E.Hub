/**
 * Riallinea README.md alla FONTE DI VERITÀ (versions.js): rigenera il blocco
 * "Versione corrente" tra i marker <!-- VERSIONS:START/END -->. Dalla v4 c'è UNA
 * sola versione Open E.Hub (i tool non hanno più numeri propri) e i file HTML hanno
 * nome stabile (niente riferimenti versionati da riallineare).
 *
 * Chiamato da bump.mjs e release.mjs dopo aver scritto versions.js, e disponibile
 * standalone via `npm run sync:readme`. NON editare a mano la parte tra i marker.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..')

const START = '<!-- VERSIONS:START'
const END = '<!-- VERSIONS:END -->'

/**
 * Solo il NUMERO di versione: l'elenco degli strumenti NON si scrive qui. Prima
 * arrivava da `V.tools`, un secondo catalogo che è divergito dal registry (δ
 * mancante, un tool con due nomi diversi). L'unico elenco è il blocco
 * `AUTO:tools:list`, generato dal registry da `npm run sync:docs`.
 */
function buildTable(V) {
  return [
    `${START} — auto-generato da versions.js (\`npm run sync:readme\`). NON editare a mano. -->`,
    `**Open E.Hub v${V.app.version}**`,
    END,
  ].join('\n')
}

export function syncReadme(root = DEFAULT_ROOT, V) {
  const require = createRequire(import.meta.url)
  const versions = V || require(resolve(root, 'versions.js'))
  const readmePath = resolve(root, 'README.md')
  let md = readFileSync(readmePath, 'utf-8')

  // blocco "Versione corrente"
  const block = new RegExp(`${START}[\\s\\S]*?${END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`)
  if (!block.test(md)) throw new Error('sync-readme: marker VERSIONS:START/END non trovati in README.md')
  md = md.replace(block, buildTable(versions))
  // file hub a nome stabile (eventuali vecchi riferimenti versionati → EHub.html)
  md = md.replace(/EHub_v\d+_\d+_\d+\.html/g, 'EHub.html')

  writeFileSync(readmePath, md)
  return readmePath
}

// Standalone: `node scripts/sync-readme.mjs`
if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const p = syncReadme()
  console.log(`README.md riallineato a versions.js → ${p}`)
}
