/**
 * LA RIGA DI AVVIO CHE NESSUNO GUARDAVA.
 *
 * Ogni punto d'ingresso della suite apre con `initAnalytics()`, prima di
 * qualunque altra cosa.
 *
 * Sta fra gli import, prima della prima dichiarazione: una zona che gli
 * strumenti di split trattano come «intestazione» e possono riscrivere. È
 * successo davvero — uno split di moduli l'ha persa in silenzio, senza
 * che nessuno dei ~3000 test se ne accorgesse, perché nessuno la asseriva.
 * Questo test è quella sentinella mancante.
 *
 * Open E.Hub è mono-studio locale (edizione 'server' rimossa): non esiste più
 * `blockIfNoSession()` (guardia di sessione, aveva senso solo con un login
 * reale) né un redirect a una login page — vedi tests/hub/login-gate.test.ts
 * per l'assenza del gate di accesso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

/** Punto d'ingresso di ogni tool (l'estensione varia: alcuni sono già TypeScript). */
const ENTRIES = ['miu', 'beta', 'delta', 'chi', 'alfa'].map((t) => {
  const js = `src/tools/${t}/main.js`
  return { tool: t, file: existsSync(resolve(ROOT, js)) ? js : `src/tools/${t}/main.ts` }
})

describe('avvio: analytics su ogni punto d\'ingresso', () => {
  for (const { tool, file } of ENTRIES) {
    it(`${tool} — inizializza le analytics`, () => {
      expect(read(file), file).toMatch(/^initAnalytics\(\)/m)
    })
  }

  it('l\'hub inizializza le analytics', () => {
    // `initAnalytics()` deve stare nel BARREL (gira per primo, una volta sola).
    expect(read('src/hub/main.js')).toMatch(/^initAnalytics\(\)/m)
  })
})
