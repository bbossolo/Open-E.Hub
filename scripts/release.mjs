/**
 * RELEASE AUTOMATICA (push su main). Calcola la versione dai COMMIT, aggiorna
 * versions.js, committa `release:` e crea il tag `vX.Y.Z`. Lo storico delle
 * modifiche resta nei commit/tag git (non più duplicato in versions.js): il
 * riepilogo qui serve solo a scrivere il messaggio del commit di release.
 * Nessuna voce a mano, nessuna chat: la decisione è nel prefisso del commit.
 *
 * Schema versioni Open E.Hub:
 *   X.Y.Z — UN solo numero di versione per tutto l'hub (niente più numeri per-tool).
 *   - X (major) = versione MAGGIORE del prodotto. La 1.0.0 è la prima release
 *     pubblica open source; prima il numero contava i tool, convenzione lasciata
 *     cadere col rilascio open. Si muove RARO e A MANO (`npm run bump -- major "…"`),
 *     per una riscrittura o una rottura di compatibilità: release.mjs NON alza mai X.
 *   - Y (minor) = AUTOMATICO: la modifica tocca l'HUB, il livello condiviso o la
 *     shell Electron (src/hub, src/shared o main.js) dall'ultima release.
 *   - Z (patch) = AUTOMATICO: la modifica tocca SOLO un tool (src/tools/...).
 *
 * I nomi file degli artefatti sono STABILI (EHub.html, Gamma.html, …): nessun rename.
 * Niente release se i commit nuovi sono tutti interni (chore/refactor/test/docs):
 * si accumulano e usciranno col prossimo commit user-facing. Override esplicito
 * (`release.mjs major|minor|patch`) forza il rilascio.
 *
 * Idempotente: se HEAD è già un commit `release:` non fa nulla. Usato dal hook
 * .githooks/pre-push quando si pusha su main.
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { syncReadme } from './sync-readme.mjs'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VPATH = resolve(ROOT, 'versions.js')
const V = require(VPATH)
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf-8' }).trim()

// Se HEAD è già una release, niente da fare.
if (/^release:/i.test(sh('git log -1 --format=%s'))) {
  console.log('release: HEAD è già un commit di release, niente da fare.'); process.exit(0)
}

// Commit dal rilascio precedente (ultimo "release:") fino a HEAD.
let range = 'HEAD'
try { const prev = sh('git log --grep="^release:" -1 --format=%H'); if (prev) range = `${prev}..HEAD` } catch { /* primo rilascio */ }
const subjects = sh(`git log ${range} --no-merges --format=%s`).split('\n').map((s) => s.trim()).filter(Boolean)
if (!subjects.length) { console.log('release: nessun commit nuovo.'); process.exit(0) }

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const override = argv.find((a) => !a.startsWith('--')) // major|minor|patch (X solo a mano)

function bumpVer(v, t) {
  const a = v.split('.').map(Number); while (a.length < 3) a.push(0)
  if (t === 'major') { a[0]++; a[1] = 0; a[2] = 0 }
  else if (t === 'minor') { a[1]++; a[2] = 0 }
  else a[2]++
  return a.slice(0, 3).join('.')
}

const USER_FACING = /^(feat|fix|perf)(\(|!|:)/i
const TYPED = /^[a-z]+(\([^)]*\))?!?:/i
function toItems(subs) {
  const out = [], seen = new Set()
  for (const s of subs) {
    if (/^release:/i.test(s)) continue
    if (TYPED.test(s) && !USER_FACING.test(s)) continue // commit tecnico → fuori dal ticker
    const clean = s.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean); out.push(clean.charAt(0).toUpperCase() + clean.slice(1))
    if (out.length >= 8) break
  }
  if (!out.length) out.push('Migliorie interne e di stabilità')
  return out
}

// Niente release se tutti i commit sono interni (nessun feat/fix/perf né subject
// senza prefisso). Override esplicito forza comunque.
const hasUserFacing = subjects.some((s) => !/^release:/i.test(s) && (USER_FACING.test(s) || !TYPED.test(s)))
if (!override && !hasUserFacing) {
  console.log('release: solo commit interni — niente release, push diretto.'); process.exit(0)
}

// Tipo (schema Open E.Hub): override esplicito vince; altrimenti MINOR se la modifica
// tocca l'hub o il livello condiviso (src/hub|src/shared), PATCH se tocca solo un
// tool (src/tools/...). X (major) = numero di tool: mai automatico (a mano).
const changedFiles = sh(`git log ${range} --no-merges --name-only --format=`)
  .split('\n').map((s) => s.trim()).filter(Boolean)
const touchesHub = changedFiles.some((f) =>
  f.startsWith('src/hub/') || f.startsWith('src/shared/') || f === 'main.js')
const type = ['major', 'minor', 'patch'].includes(override) ? override
  : touchesHub ? 'minor' : 'patch'
const items = toItems(subjects)
const newVersion = bumpVer(V.app.version, type)

if (DRY) {
  console.log(`[dry] Open E.Hub ${V.app.version} → ${newVersion} (${type})`)
  for (const it of items) console.log('   · ' + it)
  process.exit(0)
}

V.app.version = newVersion

const header =
  '/**\n * FONTE DI VERITÀ delle versioni Open E.Hub. Caricato dall\'hub (browser)\n' +
  ' * e dagli script (Node). NON modificare a mano: usare `npm run bump`.\n */\n'
writeFileSync(VPATH,
  header + '(function (root) {\n  var V = ' + JSON.stringify(V, null, 2).replace(/\n/g, '\n  ') + '\n\n' +
  '  if (typeof window !== \'undefined\') root.EHUB_VERSIONS = V\n' +
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = V\n' +
  '})(typeof window !== \'undefined\' ? window : this)\n')

const pkgPath = resolve(ROOT, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')); pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// Anche il LOCKFILE porta la versione del pacchetto (in due punti). Se resta
// indietro, ogni `npm install` successivo lo riscrive e sporca l'albero di
// lavoro con una modifica che nessuno ha chiesto.
const lockPath = resolve(ROOT, 'package-lock.json')
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
  lock.version = newVersion
  if (lock.packages?.['']) lock.packages[''].version = newVersion
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
} catch { /* lockfile assente: non è un errore bloccante */ }

syncReadme(ROOT, V)

// Doc SEMPRE allineati al catalogo tool (src/hub/data/registry.ts): rigenera i
// blocchi AUTO nei doc e includili nel commit di release. Gira via vite-node
// (il generatore è TS e importa il registry, unica fonte di verità).
// Un sync-docs rotto DEVE fermare la release: proseguire significherebbe firmare
// un commit `release:` con dentro doc disallineati dal codice — esattamente ciò
// che questo meccanismo esiste per impedire.
try {
  execSync('npx vite-node scripts/sync-docs.run.ts', { cwd: ROOT, stdio: 'inherit' })
} catch (e) {
  console.error('✗ sync-docs fallito — release annullata:', e?.message || e)
  console.error('  Correggi (spesso: `npm run sync:docs` e leggi l\'errore), poi ripeti il push.')
  process.exit(1)
}

sh('git add -A versions.js package.json package-lock.json README.md Docs')
const commitMsg = `release: Open E.Hub v${newVersion} — ${items[0].slice(0, 60)}`
const commitResult = spawnSync('git', ['commit', '-m', commitMsg], { cwd: ROOT, stdio: 'inherit' })
if (commitResult.status !== 0) { process.exit(commitResult.status ?? 1) }
// Tag annotato → il push con --follow-tags fa partire la build Windows (Action su v*).
try { sh(`git tag -a v${newVersion} -m "Open E.Hub v${newVersion}"`) } catch { /* tag già presente */ }
console.log(`\n✓ release: Open E.Hub v${newVersion} (${type}) — ${items.length} voci, tag v${newVersion} creato.`)
console.log('  Push con: git push --follow-tags')
