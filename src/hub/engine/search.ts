/* Filtro ricerca dei tool. Porta FEDELE dalla logica di filterList(). */
import type { AppDef } from '../data/registry'

/**
 * Filtra le app per query (case-insensitive) su nome, tagline e tag.
 * Query vuota → ritorna tutte le app (stesso array).
 */
export function filterApps(apps: AppDef[], query: string): AppDef[] {
  const q = query.toLowerCase().trim()
  if (!q) return apps
  return apps.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      (a.tagline || '').toLowerCase().includes(q) ||
      (a.tags || []).some((t) => t.toLowerCase().includes(q)),
  )
}
