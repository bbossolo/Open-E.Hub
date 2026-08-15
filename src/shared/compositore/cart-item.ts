/**
 * Contratto condiviso per la voce di carrello (CartItem).
 *
 * Formalizza la shape già informalmente usata da μ Prezzi per pubblicare
 * il carrello sull'hub (codice, descrizioni, prezzo, quantità misurata,
 * provenienza del prezzario, tematica, source). Qualunque tool che pubblichi
 * voci di carrello verso l'hub — o le consumi — deve rispettare questo
 * contratto: i tool estendono CartItem con i propri campi aggiuntivi
 * invece di ridichiarare i campi comuni.
 */
import type { Caratteristica } from './datasheet'
import type { AnalisiPrezzi } from './analisi-prezzi'
import type { MisurazioneRiga } from './misurazioni'

export interface CartItem {
  /** Codice voce di prezzario. */
  codice: string
  /** Descrizione ridotta (titolo). */
  desc_short?: string
  /** Descrizione estesa/declaratoria. */
  declaratoria?: string
  /** Unità di misura. */
  um?: string
  /** Prezzo unitario. */
  prezzo?: number
  /** Quantità misurata (da distinta importata o manuale); null/assente = non misurata.
   *  Se `misurazioni` è presente e non vuoto, `qty` è il totale calcolato da
   *  quelle righe (tenuto allineato ad ogni modifica) — resta comunque il
   *  campo che tutto il codice esistente legge per il "quanto è misurata". */
  qty?: number | null
  /** Misurazioni multi-riga (computo metrico), stile PriMus L1×L2×H×n con
   *  descrizione libera per riga. Additivo: se assente/vuoto si usa `qty`
   *  come oggi (retrocompatibile). */
  misurazioni?: MisurazioneRiga[]
  /** Categoria del computo metrico, assegnata MANUALMENTE in μ (nessuna eredità
   *  automatica dal prezzario sorgente per ora — l'utente organizza a mano; in
   *  futuro potrà arrivare da uno standard di studio, senza cambiare questo
   *  campo). Nota di dominio: nel computo metrico si organizza per CATEGORIA,
   *  non per capitolo (i capitoli strutturano l'Elenco Prezzi, un documento
   *  diverso). */
  categoria?: string
  /** Regione del prezzario di provenienza. */
  regione?: string
  /** Anno del prezzario di provenienza. */
  anno?: string
  /** Tematica/macrocategoria della voce. */
  tematica?: string
  /** Provenienza della voce nel carrello. */
  source?: 'phi' | 'manual' | 'xls' | 'analisi-prezzi'
  /** Scomposizione completa (manodopera/materiale/noli/varie + SG%/UI%), presente
   *  solo quando `source === 'analisi-prezzi'` — serve per l'export dedicato. */
  analisiPrezzi?: AnalisiPrezzi
  // ── Identità/caratteristiche (additivo): valorizzati dalle voci COMPOSTE o DA
  // SCHEDA di μ; consumabili da un generatore di capitolato. Assenti sulle voci di
  // prezzario reali (la famiglia si recupera da suggerisciFamiglia sul testo). ──
  /** FK alla famiglia FRASARIO (per normativa/compresi/vocabolario). */
  famigliaId?: string
  /** Caratteristiche tecniche reali (etichetta+valore) lette dalla scheda. */
  caratteristiche?: Caratteristica[]
  /** Produttore / modello / codice di catalogo (prodotto di riferimento). */
  marca?: string
  modello?: string
  codice_prodotto?: string
}
