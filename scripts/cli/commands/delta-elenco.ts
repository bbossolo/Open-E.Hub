/**
 * Comando `delta:elenco` — ispezione di un elenco elaborati (.xlsx/.csv) con
 * gli stessi rilevatori della UI δ: riga d'intestazione, orientamento,
 * confidenza, colonne normalizzate, righe. Utile prima di `delta:copertine`
 * per capire cosa vede δ nel file.
 */
import {
  detectHeaderRow, detectOrientation, elencoConfidence, parseElenco, parseProjectMeta, transposeGrid,
} from '../../../src/tools/delta/engine'
import { grigliaDiFoglio, leggiWorkbook } from './xls-common'
import { CliError, type ComandoCli, type EsitoComando, type ValoriArgs } from '../types'

export const deltaElenco: ComandoCli = {
  nome: 'delta:elenco',
  descrizione: 'Ispeziona un elenco elaborati (.xlsx/.csv): fogli, riga intestazione, colonne, righe riconosciute',
  argomenti: [
    { nome: 'elenco', tipo: 'posizionale', obbligatorio: true, descrizione: 'file elenco elaborati (.xlsx, .xls o .csv)' },
    { nome: 'foglio', tipo: 'valore', obbligatorio: false, descrizione: 'solo questo foglio (default: tutti i fogli-dati)' },
    { nome: 'json', tipo: 'boolean', obbligatorio: false, descrizione: 'output JSON machine-readable' },
  ],
  esempi: ['npm run ehub -- delta:elenco elaborati.xlsx', 'npm run ehub -- delta:elenco elaborati.xlsx --json'],
  run(args: ValoriArgs): EsitoComando {
    const path = String(args['elenco'])
    const wb = leggiWorkbook(path)
    const nomi = args['foglio'] ? [String(args['foglio'])] : wb.SheetNames
    const fogli = nomi.map((nome) => {
      const ws = wb.Sheets[nome]
      if (!ws) throw new CliError(`Foglio "${nome}" non trovato. Fogli: ${wb.SheetNames.join(', ')}`)
      let grid = grigliaDiFoglio(ws)
      const orient = detectOrientation(grid)
      if (orient.orientation === 'columns') grid = transposeGrid(grid)
      const header = detectHeaderRow(grid)
      const elenco = parseElenco(grid, path, header)
      const meta = parseProjectMeta(grid)
      return {
        foglio: nome,
        orientamento: orient.orientation,
        rigaIntestazione: header + 1,
        confidenza: Math.round(elencoConfidence(grid) * 100) / 100,
        colonne: elenco.headers,
        righe: elenco.rows.length,
        metaProgetto: Object.keys(meta).length ? meta : undefined,
      }
    })
    if (args['json']) return { stdout: [JSON.stringify(fogli, null, 2)], stderr: [] }
    const stdout: string[] = []
    for (const f of fogli) {
      stdout.push(`${f.foglio}: ${f.righe} righe · intestazione a riga ${f.rigaIntestazione} · confidenza ${f.confidenza} · ${f.orientamento}`)
      stdout.push(`  colonne: ${f.colonne.join(' · ') || '(nessuna)'}`)
      if (f.metaProgetto) stdout.push(`  meta progetto: ${Object.keys(f.metaProgetto).join(', ')}`)
    }
    return { stdout, stderr: [`${fogli.length} fogli letti da ${path}`] }
  },
}
