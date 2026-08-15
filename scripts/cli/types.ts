/**
 * Contratto della CLI unificata «ehub».
 *
 * Ogni comando è un modulo in scripts/cli/commands/ SENZA side-effect all'import
 * (il registry viene importato anche da sync-docs e dai test): dichiara uno spec
 * argomenti DICHIARATIVO che genera insieme validazione (args.ts) e usage/help
 * (help.ts).
 *
 * Convenzione output (stessa di ampere-dxf.run.ts): `stdout` = SOLO output utile
 * (path generati, JSON parsabile), `stderr` = diagnostica (warning, riepiloghi
 * ✓/✗). Errori: SOLO `throw` (CliError per quelli "attesi"), mai process.exit —
 * quello vive nel runner sottile ehub.run.ts.
 */

/** Errore "atteso" (argomenti sbagliati, file mancante…): il runner lo stampa
 *  pulito su stderr ed esce 1, senza stack trace. */
export class CliError extends Error {}

export type TipoArg = 'posizionale' | 'valore' | 'boolean'

export interface ArgSpec {
  /** 'export.xls' (posizionale) oppure 'out' (flag `--out`). */
  nome: string
  tipo: TipoArg
  obbligatorio: boolean
  descrizione: string
  /** Solo per tipo 'valore'/'posizionale' opzionali. */
  default?: string
  /** Solo per l'ULTIMO posizionale: raccoglie tutti i token rimanenti come
   *  ARRAY (es. la query di miu:cerca). */
  variadico?: boolean
}

/** Valori parsati: chiave = ArgSpec.nome; boolean per i flag, string per il
 *  resto, string[] per il posizionale variadico. */
export type ValoriArgs = Record<string, string | boolean | string[] | undefined>

export interface EsitoComando {
  /** Righe di output UTILE (path, JSON) — parsabile da script/agenti. */
  stdout: string[]
  /** Righe di diagnostica: warning, riepiloghi. */
  stderr: string[]
}

export interface ComandoCli {
  /** Namespace `tool:azione`, es. 'gamma:ampere-dxf'. */
  nome: string
  /** Una frase, in italiano. */
  descrizione: string
  argomenti: ArgSpec[]
  /** Almeno un esempio, che inizia con `npm run ehub -- <nome>`. */
  esempi: string[]
  /** Sincrono di regola; async SOLO se una dipendenza lo impone (pdf-lib, JSZip). */
  run(args: ValoriArgs): EsitoComando | Promise<EsitoComando>
}
