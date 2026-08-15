/**
 * Comando `beta:atti` — genera gli atti contabili/di direzione lavori di β da
 * un Progetto Open E.Hub salvato (stato `beta-contabilita`): frontespizio, giornale,
 * libretto, registro, sommario, SAL, certificato, conto finale, relazione,
 * verbali, liste in economia. HTML (generatori puri dell'engine, testata
 * istituzionale dell'ente); per sal/registro/sommario anche .xlsx dagli AOA
 * puri (`XLSX.write` su buffer: la build ESM di xlsx non registra fs).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import {
  aoaColWidths, certificatoHTML, contoFinaleHTML, frontespizioHTML, giornaleHTML,
  librettoHTML, listaEconomiaHTML, registroAOA, registroHTML, relazioneFinaleHTML,
  salAOA, salHTML, sommarioAOA, sommarioHTML, verbaleHTML,
} from '../../../src/tools/beta/engine'
import type { StatoBeta } from '../../../src/tools/beta/engine/types'
import { statoTool } from './ehub-common'
import { CliError, type ComandoCli, type EsitoComando, type ValoriArgs } from '../types'

const APP_ID = 'beta-contabilita'
const TIPI = ['frontespizio', 'giornale', 'libretto', 'registro', 'sommario', 'sal', 'certificato', 'conto-finale', 'relazione', 'verbali', 'economia', 'tutti'] as const
type Tipo = typeof TIPI[number]

/** Atti HTML per tipo (i verbali/economia possono essere più d'uno). */
function attiHTML(S: StatoBeta, tipo: Exclude<Tipo, 'tutti'>, numero: number): Array<{ nome: string; html: string }> {
  const { appalto, partite, sals } = S
  switch (tipo) {
    case 'frontespizio': return [{ nome: 'frontespizio', html: frontespizioHTML(appalto, partite) }]
    case 'giornale': return [{ nome: 'giornale', html: giornaleHTML(appalto, S.giornale || []) }]
    case 'libretto': {
      const sal = sals.find((s) => s.numero === numero)
      if (!sal) throw new CliError(`SAL n. ${numero} non presente (SAL disponibili: ${sals.map((s) => s.numero).join(', ') || 'nessuno'})`)
      return [{ nome: `libretto-sal${numero}`, html: librettoHTML(appalto, partite, sal, S.economia) }]
    }
    case 'registro': return [{ nome: 'registro', html: registroHTML(appalto, partite, sals, S.riserve, S.economia) }]
    case 'sommario': return [{ nome: `sommario-sal${numero}`, html: sommarioHTML(appalto, partite, sals, numero, S.economia) }]
    case 'sal': return [{ nome: `sal${numero}`, html: salHTML(appalto, partite, sals, numero, S.economia) }]
    case 'certificato': return [{ nome: `certificato-sal${numero}`, html: certificatoHTML(appalto, partite, sals, numero) }]
    case 'conto-finale': return [{ nome: 'conto-finale', html: contoFinaleHTML(appalto, partite, sals, S.verbali, S.economia) }]
    case 'relazione': return [{ nome: 'relazione-finale', html: relazioneFinaleHTML(appalto, partite, sals, S.riserve, S.relazione, S.verbali, S.economia) }]
    case 'verbali': return (S.verbali || []).map((v) => ({ nome: `verbale-${v.tipo}-${v.id}`, html: verbaleHTML(appalto, v) }))
    case 'economia': return (S.economia || []).map((l, i) => ({ nome: `economia-${i + 1}`, html: listaEconomiaHTML(appalto, l) }))
  }
}

function scriviXlsx(S: StatoBeta, tipo: 'sal' | 'registro' | 'sommario', numero: number, outDir: string): string {
  const aoa = tipo === 'sal' ? salAOA(S.appalto, S.partite, S.sals, numero, S.economia)
    : tipo === 'registro' ? registroAOA(S.appalto, S.partite, S.sals, S.economia)
    : sommarioAOA(S.appalto, S.partite, S.sals, numero, S.economia)
  const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][])
  ws['!cols'] = aoaColWidths(aoa).map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, (tipo === 'registro' ? 'Registro' : `${tipo} ${numero}`).slice(0, 31))
  const path = join(outDir, `${tipo === 'registro' ? 'registro' : `${tipo}${numero}`}.xlsx`)
  writeFileSync(path, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer)
  return path
}

export const betaAtti: ComandoCli = {
  nome: 'beta:atti',
  descrizione: 'Genera gli atti contabili/DL di β da un Progetto Open E.Hub (SAL, libretto, registro, verbali, …)',
  argomenti: [
    { nome: 'progetto.ehub', tipo: 'posizionale', obbligatorio: true, descrizione: 'Progetto Open E.Hub con lo stato β (beta-contabilita)' },
    { nome: 'tipo', tipo: 'valore', obbligatorio: false, default: 'tutti', descrizione: `atto da generare: ${TIPI.join(' | ')}` },
    { nome: 'numero', tipo: 'valore', obbligatorio: false, descrizione: 'numero SAL per libretto/sommario/sal/certificato (default: ultimo)' },
    { nome: 'formato', tipo: 'valore', obbligatorio: false, default: 'html', descrizione: 'html | xlsx | both (xlsx solo per sal/registro/sommario)' },
    { nome: 'out', tipo: 'valore', obbligatorio: false, default: '.', descrizione: 'cartella di destinazione' },
  ],
  esempi: [
    'npm run ehub -- beta:atti progetto.ehub --tipo sal --numero 2',
    'npm run ehub -- beta:atti progetto.ehub --tipo registro --formato both',
    'npm run ehub -- beta:atti progetto.ehub --out atti/',
  ],
  run(args: ValoriArgs): EsitoComando {
    const S = statoTool<StatoBeta>(String(args['progetto.ehub']), APP_ID)
    if (!S.appalto || !Array.isArray(S.partite)) throw new CliError('Stato β incompleto (manca appalto o partite)')

    const tipo = String(args['tipo']) as Tipo
    if (!TIPI.includes(tipo)) throw new CliError(`Tipo sconosciuto "${tipo}" (${TIPI.join(' | ')})`)
    const formato = String(args['formato'])
    if (!['html', 'xlsx', 'both'].includes(formato)) throw new CliError(`Formato sconosciuto "${formato}" (html | xlsx | both)`)

    const ultimo = S.sals.length ? Math.max(...S.sals.map((s) => s.numero)) : 0
    const numero = args['numero'] !== undefined ? Number(args['numero']) : ultimo
    if (args['numero'] !== undefined && !S.sals.some((s) => s.numero === numero)) {
      throw new CliError(`SAL n. ${numero} non presente (SAL disponibili: ${S.sals.map((s) => s.numero).join(', ') || 'nessuno'})`)
    }

    const daFare: Array<Exclude<Tipo, 'tutti'>> = tipo === 'tutti'
      ? (TIPI.filter((t) => t !== 'tutti') as Array<Exclude<Tipo, 'tutti'>>).filter((t) => {
          // «tutti»: salta gli atti che richiedono un SAL quando non ce n'è nessuno.
          if (['libretto', 'sommario', 'sal', 'certificato'].includes(t)) return ultimo > 0
          return true
        })
      : [tipo]

    const outDir = String(args['out'])
    mkdirSync(outDir, { recursive: true })
    const stdout: string[] = []
    const stderr: string[] = []

    for (const t of daFare) {
      if (formato !== 'xlsx') {
        const atti = attiHTML(S, t, numero)
        if (!atti.length) stderr.push(`  (nessun atto "${t}" nel progetto — saltato)`)
        for (const a of atti) {
          const path = join(outDir, `${a.nome}.html`)
          writeFileSync(path, a.html, 'utf-8')
          stdout.push(path)
        }
      }
      if (formato !== 'html' && (t === 'sal' || t === 'registro' || t === 'sommario')) {
        stdout.push(scriviXlsx(S, t, numero, outDir))
      }
    }
    if (!stdout.length) throw new CliError('Nessun atto generato (il progetto contiene i dati per questo tipo?)')
    stderr.push(`✓ ${stdout.length} file generati in ${outDir} (${S.appalto.oggetto || 'appalto senza oggetto'})`)
    return { stdout, stderr }
  },
}
