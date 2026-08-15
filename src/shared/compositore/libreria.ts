/**
 * LIBRERIA di VOCI PRONTE — un set di voci di computo già composte, distillate
 * dai computi golden reali (computi/*.xls, discipline elettrico/speciali/
 * meccanico/antincendio). A differenza del FRASARIO (che è un DB di *template*:
 * famiglia + slot da compilare), qui ogni voce è già *finita*: porta il preset
 * di selezioni con cui è stata composta, così può essere caricata nel
 * compositore (CMP) e rifinita, oppure aggiunta direttamente al carrello.
 *
 * Il testo (breve/estesa) NON viene congelato nella costante: quando la voce ha
 * una `famigliaId` nota, `voceProntaText()` lo ricalcola con `componiDescrizione`
 * (stessa fonte del compositore) — niente drift col motore. `breve`/`estesa`
 * restano come override opzionale per le voci senza famiglia guidata.
 *
 * Le voci PERSONALI dell'utente («salva in libreria») NON vivono qui: sono
 * persistite in localStorage lato μ (miu:libreria), con lo stesso schema.
 */

import { componiDescrizione, type Descrizione } from './componi'
import type { MacroCategoria } from './macrocategorie'
import type { AnalisiPrezzi } from './analisi-prezzi'
import { VOCI_PRONTE_DATA } from 'compositore-catalog:libreria'

export interface VocePronta {
  /** id stabile (kebab) della voce pronta */
  id: string
  /** etichetta breve mostrata nel pannello Libreria */
  nome: string
  /** FK verso FRASARIO[].famigliaId — se presente, il testo è ricalcolato dal motore */
  famigliaId?: string
  /** preset di selezioni con cui la voce è stata composta (chip evidenziati al caricamento) */
  misura?: string
  materiale?: string
  posa?: string
  opzioni?: string[]
  /** unità di misura della voce */
  um: string
  /** macrotemi per il raggruppamento nel pannello (come il picker famiglie) */
  macro?: MacroCategoria[]
  /** override del testo per voci SENZA famiglia guidata (personalizzate) */
  breve?: string
  estesa?: string
  /** provenienza (computo golden da cui è stata minata) — solo informativa */
  origine?: string
  /** Se presente, la voce è un'ANALISI PREZZI (manodopera/materiale/noli/varie +
   *  SG%/UI%) invece di una semplice descrizione: caricarla riapre la scheda
   *  Analisi Prezzi del compositore precompilata, non la scheda Descrizione. */
  analisiPrezzi?: AnalisiPrezzi
}

/**
 * Testo di una voce pronta. Priorità:
 *  1. testo salvato esplicitamente (`breve` override) — voci personali che
 *     l'utente può aver rifinito a mano nell'editor;
 *  2. ricalcolo dal motore quando c'è una `famigliaId` (seed curato, sempre
 *     coerente col compositore);
 *  3. fallback sul solo `nome`.
 */
export function voceProntaText(v: VocePronta): Descrizione {
  const override = (v.breve || '').trim()
  if (override) return { breve: override, estesa: (v.estesa || override).trim() }
  if (v.famigliaId) {
    return componiDescrizione({
      famigliaId: v.famigliaId,
      misura: v.misura || undefined,
      materiale: v.materiale || undefined,
      posa: v.posa || undefined,
      opzioni: v.opzioni,
    })
  }
  const breve = (v.nome || '').trim()
  return { breve, estesa: breve }
}

/**
 * Seed curato — voci ricorrenti nei computi golden reali, una per disciplina
 * principale. `compositore-catalog:libreria` risolve (alias di build, vedi
 * vite.config.ts) ai dati veri; Open E.Hub non porta dataset proprietari,
 * quindi il bundle parte sempre dallo stub vuoto (lo studio importa il
 * proprio catalogo).
 */
export const VOCI_PRONTE: VocePronta[] = VOCI_PRONTE_DATA
