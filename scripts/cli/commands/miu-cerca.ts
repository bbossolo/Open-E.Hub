/**
 * Comando `miu:cerca` — ricerca naturale in un prezzario interno col motore di
 * μ (searchRows: AND vincolanti, stemming, sinonimi del thesaurus).
 * La parte pura `cercaInRighe` è separata dal loader per i test.
 */
import { searchRows } from '../../../src/tools/miu/engine/search'
import type { PriceRow } from '../../../src/tools/miu/engine/types'
import { caricaPrezzario } from './miu-common'
import type { ComandoCli, EsitoComando, ValoriArgs } from '../types'

/** Ricerca pura: righe già cariche → prime `limite` voci rankizzate. */
export function cercaInRighe(rows: PriceRow[], query: string, limite: number): PriceRow[] {
  return searchRows(rows, query).slice(0, Math.max(1, limite))
}

export const miuCerca: ComandoCli = {
  nome: 'miu:cerca',
  descrizione: 'Cerca voci in un prezzario interno col motore di ricerca di μ (ranking, sinonimi, stemming)',
  argomenti: [
    { nome: 'slug', tipo: 'posizionale', obbligatorio: true, descrizione: 'slug del prezzario (vedi miu:elenco)' },
    { nome: 'query', tipo: 'posizionale', obbligatorio: true, variadico: true, descrizione: 'testo di ricerca (più parole = AND)' },
    { nome: 'limite', tipo: 'valore', obbligatorio: false, default: '10', descrizione: 'numero massimo di risultati' },
    { nome: 'json', tipo: 'boolean', obbligatorio: false, descrizione: 'output JSON machine-readable (voce completa)' },
  ],
  esempi: [
    'npm run ehub -- miu:cerca veneto-2026 tubo corrugato 32',
    'npm run ehub -- miu:cerca veneto-2026 cavo FG16 3G2.5 --limite 5 --json',
  ],
  run(args: ValoriArgs): EsitoComando {
    const { meta, rows } = caricaPrezzario(String(args['slug']))
    const limite = Number(args['limite']) || 10
    const query = Array.isArray(args['query']) ? args['query'].join(' ') : String(args['query'])
    const trovate = cercaInRighe(rows, query, limite)
    const stderr = [`${meta.regione ?? ''} ${meta.anno ?? ''}: ${trovate.length} risultati (su ${rows.length} voci)`.trim()]
    if (args['json']) return { stdout: [JSON.stringify(trovate, null, 2)], stderr }
    return {
      stdout: trovate.map((r) => `${r.codice}  ${r.um.padEnd(4)} ${String(r.prezzo).padStart(10)} €  ${r.desc_short}`),
      stderr,
    }
  },
}
