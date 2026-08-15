/**
 * Cutover dei tool: copia gli HTML self-contained prodotti da `vite build`
 * (dist/web/<tool>/...) nei file a root che l'hub scopre e che electron-builder
 * impacchetta. Eseguito dopo i vite build (vedi script npm build:web).
 */
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Nomi file STABILI (senza versione): la versione vive in versions.js.
const MAP = [
  ['dist/web/miu/src/tools/miu/index.html', 'miu.html'],
  ['dist/web/alfa/src/tools/alfa/index.html', 'Alfa.html'],
  ['dist/web/beta/src/tools/beta/index.html', 'Beta.html'],
  ['dist/web/delta/src/tools/delta/index.html', 'Delta.html'],
  ['dist/web/chi/src/tools/chi/index.html', 'Chi.html'],
  ['dist/web/hub/src/hub/index.html', 'EHub.html'],
]

let ok = 0
for (const [src, dest] of MAP) {
  if (!existsSync(resolve(src))) continue
  copyFileSync(resolve(src), resolve(dest))
  console.log(`✓ cutover → ${dest}`)
  ok++
}
if (ok === 0) { console.error('✗ nessuna build trovata in dist/web/: esegui prima "vite build".'); process.exit(1) }
