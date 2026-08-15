/**
 * β Contabilità — modello dati della CONTABILITÀ dei lavori pubblici (D.Lgs. 36/2023,
 * Allegato II.14). Tipi PURI (nessun DOM), condivisi da import/motore/documenti.
 *
 * Due modalità di contabilizzazione, che possono anche CONVIVERE (appalto misto):
 *  - **a misura**: quantità fisiche effettive × prezzo unitario (il corrispettivo
 *    varia con l'eseguito); mappa sulle `MisurazioneRiga` del computo di μ.
 *  - **a corpo**: corrispettivo fisso, si contabilizza la quota % dell'aliquota
 *    del corpo d'opera eseguita a ogni SAL.
 */
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'

export type Modalita = 'misura' | 'corpo'
/** Modalità dell'appalto: una delle due, o «misto» (partite di entrambe). */
export type ModalitaAppalto = Modalita | 'misto'

/** Una parte del contratto: la stazione appaltante (ente) o l'impresa esecutrice. */
export interface ParteContratto {
  denominazione: string
  indirizzo?: string
  codiceFiscale?: string
  partitaIva?: string
  /** Rappresentante/legale (impresa) o responsabile (ente). */
  rappresentante?: string
  /** Logo (data URL) — usato per la testata istituzionale dei documenti (ente). */
  logo?: string
}

/** Metadati e dati economici dell'appalto (frontespizio + base dei calcoli). */
export interface Appalto {
  oggetto: string
  cup?: string
  cig?: string
  /** Stazione appaltante — testata istituzionale dei documenti (il Comune/ente). */
  ente: ParteContratto
  /** Impresa esecutrice. */
  impresa: ParteContratto
  rup?: string
  direttoreLavori?: string
  /** Importo a base d'asta (soggetto a ribasso). */
  baseAsta?: number | null
  /** Importo offerto (ribassato) — se noto, deriva il ribasso. */
  importoOfferta?: number | null
  /** Ribasso % — se inserito a mano prevale; altrimenti derivato da base/offerta. */
  ribassoPct?: number | null
  /** Oneri per la sicurezza (NON soggetti a ribasso). */
  oneriSicurezza?: number | null
  /** Aliquota IVA % (default 10 nei lavori pubblici; verificare per appalto). */
  ivaPct?: number | null
  dataStipula?: string
  /** Data di consegna/avvio dei lavori (inizio della cronologia di cantiere). */
  dataInizio?: string
  /** Articolo del capitolato richiamato nella formula del certificato di pagamento. */
  articoloCapitolato?: string
  modalita: ModalitaAppalto
}

/** Documento effettivamente generato/consegnato (storico del cantiere). */
export interface Consegna {
  id: string
  /** Tipo tecnico del documento (giornale, libretto, sal, certificato, …). */
  tipo: string
  /** Etichetta leggibile (es. «SAL n. 2»). */
  label: string
  /** Data di riferimento del documento (gg/mm/aaaa). */
  data: string
  /** SAL di riferimento, se pertinente. */
  salNumero?: number
  /** Timestamp di generazione. */
  ts: number
}

/**
 * Una PARTITA contabile: una voce a misura oppure un corpo d'opera a corpo.
 * `modalita` discrimina quali campi contano. `qtyProgetto`/`importoContrattuale`
 * vengono dall'import del computo (μ / Primus / Excel).
 */
export interface Partita {
  id: string
  modalita: Modalita
  codice: string
  descrizione: string
  um?: string
  /** Percorso categoria "Liv1 · Liv2 · Liv3" (categorie di lavorazioni omogenee). */
  categoria?: string
  // ── a misura ──
  prezzoUnitario?: number | null
  /** Quantità di progetto (dal computo); base indicativa, l'eseguito la sostituisce a SAL. */
  qtyProgetto?: number | null
  /** Righe di misura di progetto (dal computo), riferimento per il libretto. */
  misurazioniProgetto?: MisurazioneRiga[]
  // ── a corpo ──
  /** Importo contrattuale del corpo d'opera (fisso). */
  importoContrattuale?: number | null
  // ── tracciabilità contabile (atti pubblici: niente cancellazioni) ──
  /**
   * SAL di prima comparsa della voce (le voci da computo = 1). Un nuovo prezzo
   * introdotto in corso d'opera compare solo dal proprio SAL in avanti: non
   * inquina i libretti già prodotti.
   */
  introdottaSal?: number
  /**
   * SAL in cui la voce è stata SOPPRESSA (stornata): da questo SAL in poi il suo
   * eseguito è azzerato con una detrazione tracciata. La voce NON si cancella —
   * resta negli atti precedenti che l'hanno contabilizzata (D.M. 49/2018 art. 14:
   * niente abrasioni, si porta in detrazione con annotazione).
   */
  soppressaSal?: number
}

/** Stato di una partita a un dato SAL (attestazione del DL, mai stimata dal tool). */
export interface RigaSal {
  partitaId: string
  /** a misura: quantità PROGRESSIVA eseguita a tutto il SAL. */
  quantitaProgressiva?: number | null
  /** a misura: dettaglio libretto (righe di misura) a tutto il SAL — opzionale. */
  misurazioni?: MisurazioneRiga[]
  /** a corpo: quota % (0..100) dell'aliquota del corpo eseguita a tutto il SAL. */
  quotaPct?: number | null
}

/** Uno Stato di Avanzamento Lavori: quote/quantità progressive + detrazioni. */
export interface Sal {
  numero: number
  data?: string
  righe: RigaSal[]
  /** Detrazioni per lavorazioni non conformi/in contestazione (progressive). */
  detrazioni?: number | null
  note?: string
}

/** Riga del giornale dei lavori (art. 12): annotazione giornaliera. */
export interface RigaGiornale {
  data?: string
  meteo?: string
  manodopera?: string
  mezzi?: string
  lavorazioni?: string
  note?: string
}

/** Riserva iscritta dall'esecutore sul registro (art. 14 / art. 7 All. II.14). */
export interface Riserva {
  numero: number
  data?: string
  salNumero?: number
  oggetto: string
  importo?: number | null
  /** Controdeduzioni motivate del DL. */
  controdeduzioni?: string
}

/**
 * Verbali e comunicazioni del Direttore dei Lavori che vivono IN PARALLELO alla
 * contabilità (D.M. 49/2018 artt. 5, 13; D.Lgs. 36/2023 artt. 120-121 e All.
 * II.14). Sono atti pubblici datati che si collocano sulla cronologia di cantiere
 * e costituiscono allegati obbligatori del conto finale.
 */
export type VerbaleTipo =
  | 'consegna'      // verbale di consegna dei lavori (unica/parziale/urgenza)
  | 'ordine'        // ordine di servizio (DL → esecutore)
  | 'sospensione'   // verbale di sospensione dei lavori
  | 'ripresa'       // verbale di ripresa dei lavori
  | 'nuoviprezzi'   // verbale di concordamento nuovi prezzi
  | 'accertamento'  // processo verbale di accertamento (fatti/prove/anomalie)
  | 'ultimazione'   // certificato di ultimazione dei lavori
  | 'relazioneRup'  // relazione/comunicazione al RUP

/** Un verbale/comunicazione del DL. `tipo` discrimina quali campi opzionali contano. */
export interface Verbale {
  id: string
  tipo: VerbaleTipo
  /** Data di riferimento dell'atto (gg/mm/aaaa) — lo colloca sulla timeline. */
  data?: string
  /** Progressivo per tipo (es. «Ordine di servizio n. 3»). */
  numero?: number
  /** Oggetto/titolo dell'atto. */
  oggetto?: string
  /** Corpo libero (paragrafi separati da a-capo). */
  testo?: string
  // ── campi per-tipo (usati solo dai tipi pertinenti) ──
  /** consegna: modalità della consegna. */
  consegnaMod?: 'unica' | 'parziale' | 'urgenza'
  /** sospensione: durata stimata in giorni · ripresa: giorni residui contrattuali. */
  giorniDurata?: number | null
  /** sospensione: motivo/causa della sospensione. */
  motivo?: string
}

/**
 * LAVORI IN ECONOMIA (art. 181 D.Lgs. 36/2023 / All. II.14; D.M. 49/2018 art. 14):
 * lavorazioni eseguite su ordine del DL e contabilizzate non a misura/corpo ma
 * per risorse effettivamente impiegate, tramite le LISTE SETTIMANALI di operai,
 * mezzi/noli e provviste, valorizzate e firmate in contraddittorio (duplice copia,
 * una in bollo). Confluiscono nel libretto/registro/SAL del SAL di competenza.
 */
export interface RigaOperaio { qualifica?: string; nominativo?: string; ore?: number | null; tariffaOraria?: number | null; lavorazione?: string }
export interface RigaMezzo { descrizione: string; ore?: number | null; tariffaOraria?: number | null }
export interface RigaProvvista { descrizione: string; um?: string; quantita?: number | null; prezzoUnitario?: number | null }

/** Una lista settimanale in economia (atto pubblico datato). */
export interface ListaEconomia {
  id: string
  /** Progressivo della lista. */
  numero?: number
  /** Settimana di riferimento (gg/mm/aaaa). */
  data?: string
  /** SAL di competenza: la lista confluisce nel libretto/registro di questo SAL. */
  salNumero?: number
  /** Riferimento all'ordine di servizio del DL che ha disposto i lavori in economia. */
  ordineRef?: string
  operai: RigaOperaio[]
  mezzi: RigaMezzo[]
  provviste: RigaProvvista[]
  note?: string
  /** SAL in cui la lista è stata soppressa (stornata): niente cancellazioni (come le partite). */
  soppressaSal?: number
}

/** Stato completo del tool (serializzabile per .ehub / bozza locale). */
export interface StatoBeta {
  v: 1
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  giornale?: RigaGiornale[]
  riserve?: Riserva[]
  /** Testo libero delle «vicende dell'esecuzione» per la relazione finale. */
  relazione?: string
  /** Verbali e comunicazioni del DL (consegna, sospensione, ordini di servizio, …). */
  verbali?: Verbale[]
  /** Liste settimanali dei lavori in economia. */
  economia?: ListaEconomia[]
  /** Storico dei documenti consegnati. */
  consegne?: Consegna[]
}
