/**
 * Bump MANUALE della versione Open E.Hub. Fonte unica `versions.js`; tiene allineato
 * package.json, il lockfile e il README. C'è UNA sola versione per tutta la suite
 * (niente numeri per-tool) e i file HTML hanno nome stabile (nessun rename). Lo
 * storico delle modifiche resta nei commit/tag git, non in versions.js.
 *
 *   npm run bump -- <major|minor|patch>
 *   npm run bump -- --sync     # riallinea solo package.json/lock a versions.js
 *
 * Uso tipico MANUALE: `major` per una riscrittura o una rottura di compatibilità.
 * I rilasci ordinari (minor/patch) li fa da solo release.mjs dai commit, su push a main.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { syncReadme } from './sync-readme.mjs'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VPATH = resolve(ROOT, 'versions.js')
const V = require(VPATH)

function writeVersions() {
  const header = '/**\n * FONTE DI VERITÀ delle versioni Open E.Hub. Caricato dall\'hub (browser)\n' +
    ' * e dagli script (Node). NON modificare a mano: usare `npm run bump`.\n */\n'
  writeFileSync(VPATH,
    header + '(function (root) {\n  var V = ' + JSON.stringify(V, null, 2).replace(/\n/g, '\n  ') + '\n\n' +
    '  if (typeof window !== \'undefined\') root.EHUB_VERSIONS = V\n' +
    '  if (typeof module !== \'undefined\' && module.exports) module.exports = V\n' +
    '})(typeof window !== \'undefined\' ? window : this)\n')
  syncReadme(ROOT, V)
}
function syncPackage() {
  const p = resolve(ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(p, 'utf-8'))
  if (pkg.version !== V.app.version) { pkg.version = V.app.version; writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n') }
  // Il lockfile ripete la versione in due punti: se resta indietro, il primo
  // `npm install` la riscrive da sé e lascia l'albero sporco senza motivo.
  const lp = resolve(ROOT, 'package-lock.json')
  try {
    const lock = JSON.parse(readFileSync(lp, 'utf-8'))
    if (lock.version !== V.app.version) {
      lock.version = V.app.version
      if (lock.packages?.['']) lock.packages[''].version = V.app.version
      writeFileSync(lp, JSON.stringify(lock, null, 2) + '\n')
    }
  } catch { /* lockfile assente */ }
  console.log(`package.json + package-lock.json version = ${V.app.version}`)
}
function bumpVer(v, type) {
  const a = v.split('.').map(Number); while (a.length < 3) a.push(0)
  if (type === 'major') { a[0]++; a[1] = 0; a[2] = 0 }
  else if (type === 'minor') { a[1]++; a[2] = 0 }
  else if (type === 'patch') { a[2]++ }
  else throw new Error('tipo non valido: ' + type + ' (major|minor|patch)')
  return a.slice(0, 3).join('.')
}

const args = process.argv.slice(2)
if (args[0] === '--sync') { syncPackage(); process.exit(0) }

const [type] = args
if (!type) {
  console.error('Uso: npm run bump -- <major|minor|patch>'); process.exit(1)
}
V.app.version = bumpVer(V.app.version, type)
console.log(`Open E.Hub → ${V.app.version} (${type})`)
writeVersions(); syncPackage()
