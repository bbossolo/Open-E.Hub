/**
 * Comando `miu:elenco` — il "discovery" dei prezzari interni: elenca gli slug
 * disponibili in prezzari/ coi metadati del pack (regione, anno, voci), senza
 * spacchettare le righe. `--json` per gli agenti.
 */
import { caricaPacked, elencaSlugs } from './miu-common'
import type { ComandoCli, EsitoComando, ValoriArgs } from '../types'

export const miuElenco: ComandoCli = {
  nome: 'miu:elenco',
  descrizione: 'Elenca i prezzari interni disponibili (slug, regione, anno, numero voci)',
  argomenti: [
    { nome: 'json', tipo: 'boolean', obbligatorio: false, descrizione: 'output JSON machine-readable' },
  ],
  esempi: ['npm run ehub -- miu:elenco', 'npm run ehub -- miu:elenco --json'],
  run(args: ValoriArgs): EsitoComando {
    const righe = elencaSlugs().map((slug) => {
      const { meta } = caricaPacked(slug)
      return { slug, regione: meta.regione ?? '', anno: meta.anno ?? '', voci: meta.count, categoria: meta.categoria ?? 'pubblico' }
    })
    if (args['json']) return { stdout: [JSON.stringify(righe, null, 2)], stderr: [] }
    const wSlug = Math.max(...righe.map((r) => r.slug.length), 4)
    return {
      stdout: righe.map((r) => `${r.slug.padEnd(wSlug)}  ${String(r.voci).padStart(6)} voci  ${r.regione} ${r.anno}`.trimEnd()),
      stderr: [`${righe.length} prezzari in prezzari/`],
    }
  },
}
