/* Risoluzione file-da-cartella per ogni app. I file hanno NOME STABILE (senza
   versione, vedi registry.file): la versione è unica e vive in versions.js. */
import type { AppDef } from '../data/registry'

/**
 * Per ogni app del registry, segna `resolvedFile` = `app.file` se presente nella
 * cartella, altrimenti null. Mutua e ritorna il registry (come scanFolder()).
 */
export function resolveFiles(htmlFiles: string[], registry: AppDef[]): AppDef[] {
  const present = new Set(htmlFiles)
  for (const app of registry) {
    app.resolvedFile = present.has(app.file) ? app.file : null
  }
  return registry
}
