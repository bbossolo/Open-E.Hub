/**
 * MACROCATEGORIE impianti — livello di filtro A MONTE delle tematiche.
 *
 * Le 4 macrocategorie (ELETTRICI / SPECIALI / MECCANICI / ANTINCENDIO) servono al
 * professionista impiantista per ridurre subito i capitoli visibili. Sono derivate
 * dalla tematica già assegnata da `classifyTematica` più keyword di affinamento:
 * l'appartenenza è MOLTI-A-MOLTI (es. HVAC condiviso meccanici/antincendio,
 * rivelazione incendi condivisa speciali/antincendio). Le voci non impiantistiche
 * ritornano [] e restano visibili solo senza filtro attivo.
 */

import { classifyTematica, type ClassifiableRow } from './tematiche'
import {
  MACROCATEGORIE_DATA, BASE_DATA,
  CH_NEG_SOURCE, CH_EDILI_SOURCE, CH_ELETTRICI_SOURCE, CH_ILLUMINAZIONE_SOURCE, CH_SPECIALI_SOURCE, CH_MECCANICI_SOURCE, CH_ANTINCENDIO_SOURCE,
  KW_SPECIALI_SOURCE, KW_ILLUMINAZIONE_SOURCE, KW_ANTINCENDIO_SOURCE,
} from 'compositore-catalog:macrocategorie'

export type MacroCategoria =
  | 'IMPIANTI ELETTRICI'
  | 'ILLUMINAZIONE'
  | 'IMPIANTI SPECIALI'
  | 'IMPIANTI MECCANICI'
  | 'IMPIANTI ANTINCENDIO'
  | 'OPERE EDILI'

/**
 * Elenco ufficiale (ordine di visualizzazione dei chip nel filtro).
 * `compositore-catalog:macrocategorie` risolve (alias di build, vedi
 * vite.config.ts) ai dati veri; Open E.Hub non porta dataset proprietari,
 * quindi il bundle parte sempre dallo stub vuoto (lo studio importa il
 * proprio catalogo).
 */
export const MACROCATEGORIE: MacroCategoria[] = MACROCATEGORIE_DATA

/** Tematiche impiantistiche → macrocategorie di partenza (poi affinate per keyword). */
const BASE: Record<string, MacroCategoria[]> = BASE_DATA

// ── Segnale di CAPITOLO (rilievo falsi positivi Basilicata) ──
// Le etichette di capitolo (disciplina/sistema/settore) sono più affidabili delle
// keyword nella descrizione: un capitolo dichiaratamente edile/agronomico/marittimo
// NON entra in nessuna macrocategoria anche se una voce cita «acciaio» o «elettrico».
let CH_NEG = new RegExp(CH_NEG_SOURCE)
// Capitolo EDILE positivo: dentro CH_NEG distingue la merce edile (→ OPERE EDILI)
// dai capitoli senza merce cercabile (noleggi, manodopera, sicurezza, verde…).
let CH_EDILI = new RegExp(CH_EDILI_SOURCE)
let CH_ELETTRICI = new RegExp(CH_ELETTRICI_SOURCE)
// ILLUMINAZIONE: categoria a sé — fuori da elettrici/speciali. Sia il
// capitolo dedicato sia le voci chiaramente di apparecchi illuminanti.
let CH_ILLUMINAZIONE = new RegExp(CH_ILLUMINAZIONE_SOURCE)
let CH_SPECIALI = new RegExp(CH_SPECIALI_SOURCE)
let CH_MECCANICI = new RegExp(CH_MECCANICI_SOURCE)
let CH_ANTINCENDIO = new RegExp(CH_ANTINCENDIO_SOURCE)

// Keyword di affinamento (stessa filosofia di tematiche.ts: minuscole senza accenti).
let KW_SPECIALI = new RegExp(KW_SPECIALI_SOURCE)
let KW_ILLUMINAZIONE = new RegExp(KW_ILLUMINAZIONE_SOURCE)
let KW_ANTINCENDIO = new RegExp(KW_ANTINCENDIO_SOURCE)

/** Normalizza: minuscole + rimozione accenti (allineata a tematiche.ts). */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Macrocategorie di una voce di prezzario (0..n). Usa `row.tematica` se già
 * assegnata, altrimenti la calcola; affina con keyword su etichette+descrizione.
 */
export function macrocategorieFor(row: ClassifiableRow & { tematica?: string }): MacroCategoria[] {
  const capitolo = norm([row.disciplina, row.sistema, row.settore].filter(Boolean).join(' · '))
  const hay = norm(
    [row.disciplina, row.sistema, row.settore, row.materia, row.tipologia, row.desc_short]
      .filter(Boolean).join(' · '),
  )
  const out = new Set<MacroCategoria>()
  // 1) segnale di capitolo: domina le keyword della singola voce
  if (capitolo) {
    if (CH_NEG.test(capitolo) && !CH_ELETTRICI.test(capitolo) && !CH_MECCANICI.test(capitolo)
      && !CH_ANTINCENDIO.test(capitolo) && !CH_SPECIALI.test(capitolo)) {
      // merce edile → OPERE EDILI; capitoli senza merce (noleggi, manodopera,
      // sicurezza, verde, marittime…) restano fuori da ogni macrocategoria
      return CH_EDILI.test(capitolo) ? ['OPERE EDILI'] : []
    }
    if (CH_ELETTRICI.test(capitolo)) out.add('IMPIANTI ELETTRICI')
    if (CH_ILLUMINAZIONE.test(capitolo)) out.add('ILLUMINAZIONE')
    if (CH_SPECIALI.test(capitolo)) { out.add('IMPIANTI SPECIALI'); out.add('IMPIANTI ELETTRICI') }
    if (CH_MECCANICI.test(capitolo)) out.add('IMPIANTI MECCANICI')
    if (CH_ANTINCENDIO.test(capitolo)) { out.add('IMPIANTI ANTINCENDIO'); out.add('IMPIANTI MECCANICI') }
  }
  // 2) fallback: mapping dalla tematica (capitolo muto o non impiantistico)
  if (!out.size) {
    const tema = row.tematica || classifyTematica(row)
    for (const m of BASE[tema] ?? []) out.add(m)
    if (!out.size) return []
  }
  // 3) affinamento keyword sulla voce (appartenenze multiple condivise)
  if (out.has('IMPIANTI ELETTRICI') && KW_SPECIALI.test(hay)) out.add('IMPIANTI SPECIALI')
  if (out.has('IMPIANTI ELETTRICI') && KW_ILLUMINAZIONE.test(hay)) out.add('ILLUMINAZIONE')
  if (KW_ANTINCENDIO.test(hay)) out.add('IMPIANTI ANTINCENDIO')
  return [...out]
}
