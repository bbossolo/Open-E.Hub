/**
 * Lettura del Progetto Open E.Hub (.ehub, JSON puro) condivisa dei comandi CLI:
 * file → `parseEhubProject` → stato del singolo tool per appId, con errori
 * "attesi" parlanti (CliError) se il file non è un progetto o il tool non ha
 * mai salvato uno stato dentro.
 */
import { readFileSync } from 'node:fs'
import { parseEhubProject, type EhubProject } from '../../../src/shared/ehub-project'
import { CliError } from '../types'

export function caricaProgetto(path: string): EhubProject {
  let raw: string
  try { raw = readFileSync(path, 'utf-8') } catch { throw new CliError(`File non leggibile: ${path}`) }
  try { return parseEhubProject(raw) } catch (err) {
    throw new CliError(`${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Stato di un tool dentro il progetto (CliError con l'elenco se assente). */
export function statoTool<T>(path: string, appId: string): T {
  const p = caricaProgetto(path)
  const stato = p.tools[appId]
  if (stato == null) {
    const presenti = Object.keys(p.tools)
    const elenco = presenti.length ? `Tool presenti nel progetto: ${presenti.join(', ')}` : 'Il progetto non contiene stati di alcun tool'
    throw new CliError(`Il progetto ${path} non contiene lo stato "${appId}". ${elenco}`)
  }
  return stato as T
}
