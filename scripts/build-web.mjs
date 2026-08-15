/**
 * Build di TUTTI gli HTML self-contained (hub + tool) in un colpo solo,
 * cross-platform (niente sintassi POSIX `TOOL=… vite build`, che su Windows
 * non funziona). Imposta TOOL via env per ogni target e poi fa il cutover.
 *   npm run build:web
 *
 * Open E.Hub è offline-first: unica edizione 'desktop', nessun backend/login.
 */
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS = ['miu', 'alfa', 'beta', 'delta', 'chi', 'hub']

for (const tool of TOOLS) {
  console.log(`\n▶ vite build — ${tool}`)
  execSync('vite build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, TOOL: tool } })
}

console.log('\n▶ cutover (place-builds)')
execSync('node scripts/place-builds.mjs', { cwd: ROOT, stdio: 'inherit' })
