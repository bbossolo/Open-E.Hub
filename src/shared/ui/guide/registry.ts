/**
 * Registro della guida unica condivisa. In-memory: ogni tool chiama
 * registerGuide(...) al proprio avvio; il visore legge getGuide().
 * Una nuova registrazione con lo stesso id sostituisce la precedente
 * (idempotente rispetto ai re-boot dei tool).
 */
import type { GuideSection } from './types'

const sections = new Map<string, GuideSection>()

/** Registra (o sostituisce) una sezione della guida. */
export function registerGuide(section: GuideSection): void {
  sections.set(section.id, section)
}

/** Tutte le sezioni registrate, ordinate per `order` poi per titolo. */
export function getGuide(): GuideSection[] {
  return [...sections.values()].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title),
  )
}

/** true se non è stato registrato alcun contenuto. */
export function isGuideEmpty(): boolean {
  return sections.size === 0
}
