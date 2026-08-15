/**
 * Dispatch PURO della CLI «ehub»: primo token = nome comando, poi delega al
 * modulo comando via parser condiviso. SOLO `throw` (CliError sugli errori
 * attesi), mai process.exit — quello vive nel runner sottile ehub.run.ts.
 */
import { parseArgsSpec } from './args'
import { renderHelp, renderHelpComando, renderHelpJson } from './help'
import { COMANDI } from './registry'
import { CliError, type ComandoCli, type EsitoComando } from './types'

/** Suggerimento sul nome sbagliato: comandi dello stesso namespace, o con
 *  prefisso comune — abbastanza per «gamma:» → l'elenco dei comandi gamma. */
function suggerisci(nome: string, comandi: ComandoCli[]): string {
  const tool = nome.split(':')[0]!
  const vicini = comandi.filter((c) => c.nome.startsWith(tool)).map((c) => c.nome)
  const elenco = vicini.length ? vicini : comandi.map((c) => c.nome)
  return `Comando sconosciuto "${nome}". Forse cercavi: ${elenco.join(', ')}\n(elenco completo: npm run ehub -- help)`
}

export async function runCli(argv: string[], comandi: ComandoCli[] = COMANDI): Promise<EsitoComando> {
  const [primo, ...resto] = argv
  if (!primo || primo === 'help' || primo === '--help' || primo === '-h') {
    if (primo === 'help' && resto[0] === '--json') return { stdout: [renderHelpJson(comandi)], stderr: [] }
    if (primo === 'help' && resto[0]) {
      const cmd = comandi.find((c) => c.nome === resto[0])
      if (!cmd) throw new CliError(suggerisci(resto[0]!, comandi))
      return { stdout: renderHelpComando(cmd), stderr: [] }
    }
    return { stdout: renderHelp(comandi), stderr: [] }
  }
  const cmd = comandi.find((c) => c.nome === primo)
  if (!cmd) throw new CliError(suggerisci(primo, comandi))
  return await cmd.run(parseArgsSpec(cmd, resto))
}
