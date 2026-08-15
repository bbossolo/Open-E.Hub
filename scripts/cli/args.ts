/**
 * Parser argv condiviso della CLI «ehub» — dichiarativo, a mano, zero dipendenze
 * (stile del repo: niente commander/yargs). Lo spec `ArgSpec[]` di un comando è
 * la SOLA fonte: da lì nascono validazione, messaggio d'uso e doc.
 */
import { CliError, type ComandoCli, type ValoriArgs } from './types'

/** Riga d'uso generata dallo spec, es.
 *  `ehub miu:cerca <slug> <query…> [--limite <val>] [--json]`. */
export function usage(cmd: Pick<ComandoCli, 'nome' | 'argomenti'>): string {
  const parts = [`ehub ${cmd.nome}`]
  for (const a of cmd.argomenti) {
    if (a.tipo === 'posizionale') {
      const nome = a.variadico ? `${a.nome}…` : a.nome
      parts.push(a.obbligatorio ? `<${nome}>` : `[${nome}]`)
    } else if (a.tipo === 'boolean') {
      parts.push(a.obbligatorio ? `--${a.nome}` : `[--${a.nome}]`)
    } else {
      parts.push(a.obbligatorio ? `--${a.nome} <val>` : `[--${a.nome} <val>]`)
    }
  }
  return parts.join(' ')
}

/**
 * Parsa `argv` (già privo del nome comando) contro lo spec: posizionali in
 * ordine, `--flag valore`, `--flag` boolean; l'eventuale ultimo posizionale
 * `variadico` raccoglie tutti i token non-flag rimanenti (uniti da spazio).
 * `throw CliError` (con l'usage) su obbligatorio mancante, flag ignoto o
 * valore mancante dopo un flag.
 */
export function parseArgsSpec(cmd: Pick<ComandoCli, 'nome' | 'argomenti'>, argv: string[]): ValoriArgs {
  const spec = cmd.argomenti
  const flags = new Map(spec.filter((a) => a.tipo !== 'posizionale').map((a) => [a.nome, a]))
  const posizionali = spec.filter((a) => a.tipo === 'posizionale')
  const out: ValoriArgs = {}
  const restanti: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!
    if (tok.startsWith('--')) {
      const f = flags.get(tok.slice(2))
      if (!f) throw new CliError(`Flag sconosciuto ${tok}\nUso: ${usage(cmd)}`)
      if (f.tipo === 'boolean') { out[f.nome] = true; continue }
      const val = argv[++i]
      if (val === undefined) throw new CliError(`Manca il valore dopo --${f.nome}\nUso: ${usage(cmd)}`)
      out[f.nome] = val
      continue
    }
    restanti.push(tok)
  }

  for (let p = 0; p < posizionali.length; p++) {
    const a = posizionali[p]!
    if (a.variadico && p === posizionali.length - 1) {
      const resto = restanti.slice(p)
      if (resto.length) out[a.nome] = resto
    } else if (restanti[p] !== undefined) {
      out[a.nome] = restanti[p]
    }
  }
  const attesi = posizionali[posizionali.length - 1]?.variadico ? Infinity : posizionali.length
  if (restanti.length > attesi) {
    throw new CliError(`Argomento inatteso "${restanti[posizionali.length]}"\nUso: ${usage(cmd)}`)
  }

  for (const a of spec) {
    if (out[a.nome] === undefined && a.default !== undefined) out[a.nome] = a.default
    if (a.tipo === 'boolean' && out[a.nome] === undefined) out[a.nome] = false
    if (a.obbligatorio && (out[a.nome] === undefined || out[a.nome] === '')) {
      const come = a.tipo === 'posizionale' ? `<${a.nome}>` : `--${a.nome}`
      throw new CliError(`Manca l'argomento obbligatorio ${come}\nUso: ${usage(cmd)}`)
    }
  }
  return out
}
