/**
 * Classificatore TEMATICHE — macro-categorie trasversali ai prezzari, per ridurre
 * i filtri-capitolo (specie Settore/liv3) a un unico filtro "Tematica" usabile.
 *
 * Puro e testabile: `classifyTematica(row)` assegna UNA tematica in base a parole
 * chiave su disciplina/sistema/settore + descrizione breve (i segnali più affidabili,
 * non la declaratoria intera). Ordine = specifico → generico, primo match vince.
 * Euristico: affinabile aggiungendo keyword senza cambiare l'API.
 */
import { RULES_DATA, TEMATICHE_DATA, type RegolaTemaData } from 'compositore-catalog:tematiche'

export interface ClassifiableRow {
  disciplina?: string; sistema?: string; settore?: string
  desc_short?: string; materia?: string; tipologia?: string
}

/**
 * Elenco ufficiale delle tematiche (ordine di visualizzazione nel filtro).
 * `compositore-catalog:tematiche` risolve (alias di build, vedi vite.config.ts)
 * ai dati veri; Open E.Hub non porta dataset proprietari, quindi il bundle
 * parte sempre dallo stub vuoto (lo studio importa il proprio catalogo).
 */
export const TEMATICHE: string[] = TEMATICHE_DATA

export const TEMA_ALTRO = 'Varie / altro'

/** Regole ordinate (specifico → generico), ricostruite da `RULES_DATA` (le regex non sono serializzabili). */
function buildRules(data: RegolaTemaData[]): { tema: string; kw: RegExp }[] {
  return data.map(r => ({ tema: r.tema, kw: new RegExp(r.source) }))
}

/** Regole ordinate: specifico → generico. La prima che combacia assegna la tematica. */
const RULES: { tema: string; kw: RegExp }[] = buildRules(RULES_DATA)

/** Normalizza: minuscole + rimozione accenti (per matchare le keyword senza accenti). */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Assegna la tematica a una voce di prezzario. Ritorna sempre una stringa. */
export function classifyTematica(r: ClassifiableRow): string {
  // Segnale principale: etichette di capitolo + descrizione breve (non la declaratoria intera).
  const hay = norm([r.disciplina, r.sistema, r.settore, r.materia, r.tipologia, r.desc_short].filter(Boolean).join(' · '))
  for (const rule of RULES) if (rule.kw.test(hay)) return rule.tema
  return TEMA_ALTRO
}
