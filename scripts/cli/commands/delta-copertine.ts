/**
 * Comando `delta:copertine` — genera le copertine PDF di δ (una per riga
 * dell'elenco, mai un multipagina) da un Progetto Open E.Hub o da uno stato δ JSON
 * col template già caricato (il raster del PDF cartiglio nasce in UI: da un
 * PDF grezzo servirebbe pdf.js+canvas, assenti in Node).
 * pdf-lib e @pdf-lib/fontkit sono dependencies reali, iniettate come nei test
 * (tests/delta/pdf-export.test.ts): stesso motore della UI, `run` async.
 *
 * L'elenco può venire dallo stato salvato oppure da un file esterno
 * (`--elenco`), per rigenerare le copertine su un elenco aggiornato senza
 * riaprire la UI.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  buildAllCoverPdfs, detectHeaderRow, detectOrientation, mergeSheets, parseState, transposeGrid,
  type DeltaState,
} from '../../../src/tools/delta/engine'
import { caricaProgetto } from './ehub-common'
import { grigliaDiFoglio, leggiWorkbook } from './xls-common'
import { CliError, type ComandoCli, type EsitoComando, type ValoriArgs } from '../types'

const APP_ID = 'delta'

/** Stato δ dal Progetto Open E.Hub (o da un JSON di stato δ puro). */
function caricaStato(path: string): DeltaState {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  // Un .ehub ha `tools`; un file di stato δ nudo ha direttamente template/fields.
  if (raw && typeof raw === 'object' && raw.tools) {
    const p = caricaProgetto(path)
    const s = p.tools[APP_ID]
    if (!s) throw new CliError(`Il progetto ${path} non contiene lo stato δ ("${APP_ID}"). Tool presenti: ${Object.keys(p.tools).join(', ')}`)
    return parseState(s as object)
  }
  return parseState(raw)
}

function elencoDaFile(path: string): DeltaState['elenco'] {
  const wb = leggiWorkbook(path)
  const sheets = wb.SheetNames.map((name) => {
    let grid = grigliaDiFoglio(wb.Sheets[name]!)
    if (detectOrientation(grid).orientation === 'columns') grid = transposeGrid(grid)
    return { name, grid: grid.slice(detectHeaderRow(grid)) }
  })
  return mergeSheets(sheets, path)
}

export const deltaCopertine: ComandoCli = {
  nome: 'delta:copertine',
  descrizione: 'Genera le copertine PDF di δ (una per riga dell\'elenco) da un Progetto Open E.Hub con template salvato',
  argomenti: [
    { nome: 'progetto', tipo: 'posizionale', obbligatorio: true, descrizione: 'Progetto Open E.Hub (o JSON di stato δ) con template e campi' },
    { nome: 'elenco', tipo: 'valore', obbligatorio: false, descrizione: 'elenco elaborati esterno (.xlsx/.csv) al posto di quello salvato' },
    { nome: 'filename-col', tipo: 'valore', obbligatorio: false, descrizione: 'colonna dell\'elenco che nomina i PDF (default: quella salvata)' },
    { nome: 'out', tipo: 'valore', obbligatorio: false, default: '.', descrizione: 'cartella di destinazione dei PDF' },
  ],
  esempi: [
    'npm run ehub -- delta:copertine progetto.ehub --out copertine/',
    'npm run ehub -- delta:copertine progetto.ehub --elenco elaborati.xlsx --filename-col "N. Elaborato"',
  ],
  async run(args: ValoriArgs): Promise<EsitoComando> {
    const state = caricaStato(String(args['progetto']))
    if (!state.template) throw new CliError('Lo stato δ non contiene un template: caricare il cartiglio in δ e salvare il progetto')
    if (!state.fields.length) throw new CliError('Lo stato δ non contiene campi da compilare')
    if (args['elenco']) state.elenco = elencoDaFile(String(args['elenco']))
    if (!state.elenco || !state.elenco.rows.length) throw new CliError('Nessuna riga di elenco: passare --elenco o salvare l\'elenco nello stato δ')

    const filenameCol = args['filename-col'] ? String(args['filename-col']) : state.filenameColumn || null
    if (filenameCol && !state.elenco.headers.includes(filenameCol)) {
      throw new CliError(`Colonna "${filenameCol}" assente nell'elenco. Colonne: ${state.elenco.headers.join(', ')}`)
    }

    const pdfs = await buildAllCoverPdfs(state, filenameCol, { PDFDocument, StandardFonts }, undefined, fontkit)
    const outDir = String(args['out'])
    mkdirSync(outDir, { recursive: true })
    const stdout: string[] = []
    for (const p of pdfs) {
      const path = join(outDir, p.name) // `name` include già l'estensione .pdf
      writeFileSync(path, Buffer.from(p.bytes))
      stdout.push(path)
    }
    return { stdout, stderr: [`✓ ${pdfs.length} copertine PDF in ${outDir} (${state.elenco.rows.length} righe di elenco)`] }
  },
}
