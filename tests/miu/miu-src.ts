import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * Sorgente di μ per i contract/characterization test: markup di `index.html` PIÙ
 * tutto il codice in `legacy/*.js`.
 *
 * Lo script un tempo inline in `index.html` è stato estratto in `src/tools/miu/legacy/`
 * (STEP 1 dello snellimento HTML). Questi test asseriscono su pattern del codice E del
 * markup, quindi devono vedere entrambe le sorgenti. Il glob su `legacy/*.js` regge anche
 * lo split in moduli tematici (STEP 2): il codice resta trovabile ovunque finisca.
 */
export function miuSource(): string {
  const html = readFileSync(resolve(ROOT, 'src/tools/miu/index.html'), 'utf8')
  const dir = resolve(ROOT, 'src/tools/miu/legacy')
  const js = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .join('\n')
  return html + '\n' + js
}
