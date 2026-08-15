/**
 * Comando `chi:smista` — smistamento automatico dei layer di una base DXF
 * esterna sullo standard V-* dello studio, con la STESSA catena della UI χ:
 * analizzaDxf → suggerisciTutti → rigaDaSuggerimento (preset) →
 * costruisciPiano → riscriviDxf (riscrittura SENZA PERDITE, byte-fedele fuori
 * dai layer toccati). Codifica simmetrica: input cp1252 ⇒ output ri-codificato
 * cp1252 (regola χ, vedi memoria di progetto).
 *
 * A differenza della UI (che parte con le destinazioni vuote e chiede
 * all'utente), il batch applica subito i suggerimenti: i layer a confidenza
 * bassa restano NON decisi (= non toccati) e vengono segnalati su stderr —
 * `--dry-run` mostra tutto prima di scrivere.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  analizzaDxf, costruisciPiano, nomeUscita, OPZIONI_DEFAULT, riepiloga,
  rigaDaSuggerimento, riscriviDxf, suggerisciTutti, type Preset, type Riga,
} from '../../../src/tools/chi/engine'
import { CodificatoreCp1252 } from '../../../src/shared/dxf-import/codifica'
import { CliError, type ComandoCli, type EsitoComando, type ValoriArgs } from '../types'

/** Legge il DXF come testo: UTF-8 se valido, altrimenti cp1252 (letto latin1). */
function leggiDxf(path: string): { testo: string; cp1252: boolean } {
  let buf: Buffer
  try { buf = readFileSync(path) } catch { throw new CliError(`File non leggibile: ${path}`) }
  try {
    return { testo: new TextDecoder('utf-8', { fatal: true }).decode(buf), cp1252: false }
  } catch {
    return { testo: buf.toString('latin1'), cp1252: true }
  }
}

export const chiSmista: ComandoCli = {
  nome: 'chi:smista',
  descrizione: 'Smista i layer di una base DXF esterna sullo standard V-* dello studio (riscrittura senza perdite)',
  argomenti: [
    { nome: 'input.dxf', tipo: 'posizionale', obbligatorio: true, descrizione: 'DXF del collaboratore da smistare' },
    { nome: 'preset', tipo: 'valore', obbligatorio: false, default: 'essenziale', descrizione: 'preset destinazioni: essenziale | completo' },
    { nome: 'out', tipo: 'valore', obbligatorio: false, default: '.', descrizione: 'cartella di destinazione del DXF smistato' },
    { nome: 'dry-run', tipo: 'boolean', obbligatorio: false, descrizione: 'solo anteprima: riepilogo JSON del piano, nessun file scritto' },
  ],
  esempi: [
    'npm run ehub -- chi:smista tavola.dxf --out /tmp',
    'npm run ehub -- chi:smista tavola.dxf --dry-run',
    'npm run ehub -- chi:smista tavola.dxf --preset completo',
  ],
  run(args: ValoriArgs): EsitoComando {
    const path = String(args['input.dxf'])
    const preset = String(args['preset']) as Preset
    if (preset !== 'essenziale' && preset !== 'completo') throw new CliError(`Preset sconosciuto "${preset}" (essenziale | completo)`)

    const { testo, cp1252 } = leggiDxf(path)
    const analisi = analizzaDxf(testo)
    if (!analisi.layer.length) throw new CliError(`${path}: nessun layer trovato (è un DXF?)`)

    const righe: Riga[] = suggerisciTutti(analisi.layer).map((r) => rigaDaSuggerimento(r, preset))
    const riep = riepiloga(righe)

    if (args['dry-run']) {
      const anteprima = {
        riepilogo: riep,
        righe: righe.filter((r) => !r.layer.vuoto).map((r) => ({
          layer: r.layer.nome, nEntita: r.layer.nEntita, destinazione: r.destinazione || '(da decidere)',
        })),
      }
      return { stdout: [JSON.stringify(anteprima, null, 2)], stderr: [`Anteprima: nessun file scritto (${analisi.nEntita} entità, ${analisi.layer.length} layer)`] }
    }

    const piano = costruisciPiano(righe, analisi, OPZIONI_DEFAULT)
    const { dxf, esito } = riscriviDxf(testo, piano)

    const outDir = String(args['out'])
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, nomeUscita(basename(path)))
    if (cp1252) writeFileSync(outPath, Buffer.from(new CodificatoreCp1252().codifica(dxf)))
    else writeFileSync(outPath, dxf, 'utf-8')

    const stderr: string[] = []
    stderr.push(`  ${riep.spostati} layer smistati (${riep.entitaSpostate} entità) · ${riep.spenti} spenti (${riep.entitaSpente} entità)`)
    if (riep.daDecidere) stderr.push(`  ⚠ ${riep.daDecidere} layer NON decisi (${riep.entitaDaDecidere} entità, confidenza bassa): restano com'erano — rifinire in χ`)
    if (esito.avvisi.length) stderr.push(...esito.avvisi.map((a) => `  ⚠ ${a}`))
    stderr.push(`✓ DXF smistato (${cp1252 ? 'cp1252' : 'utf-8'}): ${outPath}`)
    return { stdout: [outPath], stderr }
  },
}
