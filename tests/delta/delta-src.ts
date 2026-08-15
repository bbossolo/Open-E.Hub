import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * Sorgente di δ per i contract/characterization test: `main.js` PIÙ tutto il
 * codice in `ui/*.js`.
 *
 * Gemello di `tests/gamma/gamma-src.ts`, `tests/pi/pi-src.ts` e
 * `tests/hub/hub-src.ts`: rende i test che cercano pattern nel sorgente
 * indifferenti a QUALE modulo ospiti il codice.
 */
export function deltaSource(): string {
  const parts = [readFileSync(resolve(ROOT, 'src/tools/delta/main.js'), 'utf8')]
  const dir = resolve(ROOT, 'src/tools/delta/ui')
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
      parts.push(readFileSync(resolve(dir, f), 'utf8'))
    }
  }
  return parts.join('\n')
}
