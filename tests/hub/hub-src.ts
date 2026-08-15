import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * Sorgente dell'hub per i contract/characterization test: `main.js` PIÙ tutto il
 * codice in `ui/*.js`.
 *
 * Gemello di `tests/miu/miu-src.ts` e `tests/gamma/gamma-src.ts`. Molti test
 * asseriscono su pattern del sorgente dell'hub leggendo `src/hub/main.js` come
 * testo: appena una funzione esce da lì per finire in un modulo tematico quei
 * test falliscono pur essendo il codice corretto. Il glob li rende indifferenti a
 * DOVE vive il codice, senza toccare COSA asseriscono.
 */
export function hubSource(): string {
  const parts = [readFileSync(resolve(ROOT, 'src/hub/main.js'), 'utf8')]
  const dir = resolve(ROOT, 'src/hub/ui')
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
      parts.push(readFileSync(resolve(dir, f), 'utf8'))
    }
  }
  return parts.join('\n')
}
