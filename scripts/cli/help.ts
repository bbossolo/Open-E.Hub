/**
 * Rendering dell'help della CLI «ehub»: umano (tabellare, in italiano) e
 * machine-readable (`help --json` — lo "schema function-calling" che un agente
 * può leggere per scoprire i comandi senza consultare la doc).
 */
import { usage } from './args'
import type { ComandoCli } from './types'

/** Help generale: un rigo per comando, raggruppato per namespace tool. */
export function renderHelp(comandi: ComandoCli[]): string[] {
  const out = [
    'CLI unificata Open E.Hub — comandi batch headless della suite',
    '',
    'Uso: npm run ehub -- <comando> [argomenti]',
    '     npm run ehub -- help [comando] [--json]',
    '',
  ]
  const wNome = Math.max(...comandi.map((c) => c.nome.length), 4)
  let ns = ''
  for (const c of [...comandi].sort((a, b) => a.nome.localeCompare(b.nome))) {
    const tool = c.nome.split(':')[0]!
    if (tool !== ns) { if (ns) out.push(''); ns = tool }
    out.push(`  ${c.nome.padEnd(wNome)}  ${c.descrizione}`)
  }
  return out
}

/** Dettaglio di un singolo comando: descrizione, uso, argomenti, esempi. */
export function renderHelpComando(cmd: ComandoCli): string[] {
  const out = [cmd.nome + ' — ' + cmd.descrizione, '', 'Uso: ' + usage(cmd)]
  if (cmd.argomenti.length) {
    out.push('', 'Argomenti:')
    const wNome = Math.max(...cmd.argomenti.map((a) => a.nome.length))
    for (const a of cmd.argomenti) {
      const flag = a.tipo === 'posizionale' ? a.nome : `--${a.nome}`
      const extra = [a.obbligatorio ? 'obbligatorio' : '', a.default !== undefined ? `default: ${a.default}` : ''].filter(Boolean).join(', ')
      out.push(`  ${flag.padEnd(wNome + 2)}  ${a.descrizione}${extra ? ` (${extra})` : ''}`)
    }
  }
  if (cmd.esempi.length) out.push('', 'Esempi:', ...cmd.esempi.map((e) => '  ' + e))
  return out
}

/** Dump JSON del registry (senza le funzioni run): contratto stabile per agenti. */
export function renderHelpJson(comandi: ComandoCli[]): string {
  const dump = comandi.map((c) => ({
    nome: c.nome,
    descrizione: c.descrizione,
    uso: usage(c),
    argomenti: c.argomenti,
    esempi: c.esempi,
  }))
  return JSON.stringify(dump, null, 2)
}
