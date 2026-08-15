/**
 * Modello della SCENA DXF — il risultato di un import, in un solo oggetto.
 *
 * Differenza sostanziale da un modello a fondo vettoriale piatto: lì tutta la geometria
 * collassa in UNA stringa `d` e il layer viene buttato via, qui la
 * geometria resta **divisa per layer** e anche i testi portano il loro layer. È il
 * prerequisito per un gestore layer (accendi/spegni come in un CAD) e — più
 * importante — per la CORRETTEZZA del computo: nelle tavole vere dello studio l'abaco dei
 * simboli è incollato sul layer `0`, e contarlo falserebbe le quantità.
 *
 * Convenzione delle coordinate: **Y verso il basso** (la Y del DXF viene riflessa), la
 * stessa in cui vivono lo sfondo e i dispositivi. Anche gli INSERT
 * escono già riflessi: è ciò che elimina alla radice il vecchio bug dei blocchi
 * riconosciuti ma disegnati fuori dal viewBox.
 */

export interface DxfPt { x: number; y: number }

/** Geometria di un singolo layer, già pronta per un `<path d="…">`. */
export interface DxfLayerGeom {
  layer: string
  d: string
  /** Quanti segmenti contiene: è la misura del suo peso a schermo. */
  segmenti: number
  /** Quanti testi stanno su questo layer. */
  testi: number
  /** Quanti blocchi (INSERT) sono posati su questo layer. */
  inserts: number
  /**
   * Ingombro del solo layer. Serve all'«adatta alla vista»: inquadrare il bbox di TUTTO il
   * file significa inquadrare anche l'abaco nell'angolo e le entità sperdute, e ritrovarsi
   * l'edificio grande come un francobollo. Si inquadra ciò che è ACCESO.
   */
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

/** Un testo del disegno, col layer di appartenenza (che il tipo `DxfText` grezzo non ha). */
export interface DxfSceneText {
  x: number
  y: number
  /** Testo già ripulito dai codici di formattazione MTEXT. */
  s: string
  /** Altezza in unità di disegno (NON in pixel): il rendering la usa così com'è. */
  h: number
  /** Rotazione in gradi (DXF, antiorario). */
  r: number
  layer: string
}

/** Un INSERT di primo livello: un blocco POSATO sul disegno (una presa, un punto luce…). */
export interface DxfSceneInsert {
  name: string
  layer: string
  x: number
  y: number
  sx: number
  sy: number
  rot: number
  attrs: Record<string, string>
  /** true = blocco DENTRO un altro blocco (raccolto con opts.profonditaInserts > 0). */
  annidato?: boolean
}

export interface DxfSceneStats {
  /** Entità lette nella sezione ENTITIES. */
  entita: number
  /** Definizioni di blocco indicizzate. */
  blocchi: number
  /** Segmenti di geometria effettivamente generati. */
  segmenti: number
  /** true se il tetto `maxSegmenti` è stato raggiunto e la geometria è incompleta. */
  troncato: boolean
  /**
   * Entità NON disegnabili scartate, per tipo (es. { HATCH: 1200, SPLINE: 40 }).
   * Serve a dirlo all'utente: senza, un disegno con riempimenti/quote mancanti
   * sembra un difetto del tool invece di una scelta dichiarata.
   */
  saltatePerTipo?: Record<string, number>
  /** true se la raccolta polilinee ha superato il tetto ed è incompleta. */
  polilineeTroncate?: boolean
  /** Millisecondi impiegati dal parse. */
  ms: number
}

export interface DxfScene {
  /** Geometria divisa per layer, ordinata per peso decrescente. */
  layers: DxfLayerGeom[]
  texts: DxfSceneText[]
  /** I blocchi posati sul disegno (solo primo livello: quelli che l'utente ha inserito). */
  inserts: DxfSceneInsert[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
  /**
   * Ingombro ROBUSTO: l'intervallo che contiene il 99% dei punti, non gli estremi.
   *
   * È quello da usare per INQUADRARE. Gli estremi veri (`bbox`) su una tavola reale sono spesso
   * inservibili — poche entità perse a chilometri dal disegno li fanno esplodere, e chi ci
   * costruisce sopra un viewBox ottiene un puntino al centro di un foglio vuoto. Null quando la
   * geometria è troppo poca perché un quantile significhi qualcosa: in quel caso vale `bbox`.
   */
  bboxCore: { minX: number; minY: number; maxX: number; maxY: number } | null
  unitsPerMeter: number | null
  /**
   * Tabella LAYER del file (colore ACI, frozen, off) — per «Colori CAD» e per
   * partire coi layer congelati spenti. Vuota se il file non la dichiara.
   */
  layerTable?: Record<string, { aci: number; frozen: boolean; spento: boolean }>
  /**
   * Polilinee GIÀ trasformate (Y-giù) dei layer che matchano
   * opts.raccogliPolilinee — es. i layer muri/ostacoli: il consumatore le usa
   * direttamente senza ri-parsare i path `d` con regex.
   */
  polilinee?: Record<string, DxfPt[][]>
  stats: DxfSceneStats
}

export interface DxfParseOptions {
  /**
   * Rete di sicurezza contro file patologici. NON è il freno di tutti i giorni: una tavola
   * vera dello studio fa ~2 M di segmenti e ci sta dentro comodamente. Se scatta, la
   * geometria è incompleta e `stats.troncato` lo dichiara (mai un troncamento muto).
   */
  maxSegmenti?: number
  /** Profondità massima di annidamento degli INSERT (blocchi dentro blocchi). */
  maxDepth?: number
  /** Chiamata con una frazione 0→1; usata dal worker per la barra di avanzamento. */
  onProgress?: (frazione: number) => void
  /** true = scarta le entità di paperspace/layout (group 67). Default false. */
  escludiPaperspace?: boolean
  /**
   * Profondità di discesa nei blocchi ANNIDATI per `inserts` (0 = solo primo
   * livello, comportamento storico). I figli arrivano con `annidato: true`.
   */
  profonditaInserts?: number
  /**
   * Parole chiave (substring, case-insensitive) dei layer di cui raccogliere le
   * polilinee trasformate in `scene.polilinee` (es. muri/ostacoli).
   */
  raccogliPolilinee?: string[]
  /**
   * Layer da NON costruire affatto (né geometria, né testi, né insert): a
   * differenza dello spegnimento a valle, qui la memoria non viene mai
   * allocata — è il filtro «scegli i layer PRIMA dell'import» (filosofia χ:
   * prima l'inventario leggero con AnalizzatoreDxf, poi il parse pieno dei
   * soli layer che servono). Le entità su layer 0 dentro un blocco seguono
   * l'INSERT che le posa, come da convenzione.
   */
  escludiLayer?: string[]
}

export const DXF_MAX_SEGMENTI = 4_000_000
export const DXF_MAX_DEPTH = 8
/**
 * Tetto della raccolta polilinee (opts.raccogliPolilinee): misurato su una
 * tavola reale, i layer architettonici da soli fanno 147.000 polilinee /
 * 860.000 punti — come oggetti JS sono centinaia di MB che attraversano il
 * postMessage e poi diventerebbero altrettanti muri/nodi DOM. Come ostacoli
 * ne servono al massimo qualche migliaio: oltre, si smette e
 * `stats.polilineeTroncate` lo dichiara.
 */
export const DXF_MAX_POLILINEE = 4_000
export const DXF_MAX_PUNTI_POLILINEE = 100_000

/**
 * Oltre questa soglia un layer è «pesante»: da solo può far arrancare l'SVG.
 *
 * Misurata sul vero: in una tavola reale due soli layer (lo strutturale portante e le tabelle
 * quadri) fanno 1,76 M dei 1,98 M segmenti totali, mentre OGNI layer elettrico — quelli che
 * contano per il computo — sta sotto i 45.000. Un tetto globale sarebbe stato il freno
 * sbagliato: avrebbe buttato via layer leggeri e utili solo perché letti per ultimi. Meglio
 * leggere tutto e lasciare che sia l'interfaccia a tenere spenti i pochi layer ingombranti.
 */
export const DXF_LAYER_PESANTE = 150_000
