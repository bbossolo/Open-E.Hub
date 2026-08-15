/**
 * δ Pages — tipi dell'engine (puri, senza DOM).
 *
 * Un CAMPO è un pezzo di testo posizionato sul template. La posizione e la
 * dimensione del font sono FRAZIONI 0–1 del box template, non pixel: così
 * l'editor (SVG a scala qualsiasi) e la stampa (pagina A4/mm) rendono identici
 * a ogni DPI/zoom. Un campo è FISSO (stesso valore su ogni copertina) o
 * VARIABILE (valore preso da una colonna dell'elenco, diverso per riga).
 */

export type FieldKind = 'fixed' | 'variable'
/** Punto del testo ancorato a (x,y): top/middle/bottom × left/center/right. */
export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
export type Align = 'left' | 'center' | 'right'

export interface CoverField {
  id: string
  kind: FieldKind
  label: string        // etichetta nell'editor (es. "Titolo elaborato")
  x: number            // 0–1, frazione della larghezza template
  y: number            // 0–1, frazione dell'altezza template
  anchor: Anchor
  align: Align
  fontFrac: number     // font-size come frazione dell'ALTEZZA pagina (scala-invariante)
  bold?: boolean
  value?: string       // solo kind='fixed' — valore letterale (per le firme: "Ruolo: Nome")
  column?: string      // solo kind='variable' — nome-colonna dell'elenco
  /** solo kind='variable' — espressione con token `{Colonna|fn}`/`{@Meta}` (vedi expr.ts).
   *  Quando presente prevale su `column`: permette codici derivati/composti
   *  (Protocollo = {FASE}-{Disciplina}-{TIPO}, Tavola = {CODICE ELABORATO|tail}). */
  expr?: string
  /** Larghezza massima (frazione 0–1 della larghezza pagina) per il wrap multi-riga.
   *  Assente = testo su una riga sola (con auto-riduzione), come storicamente. */
  maxWidthFrac?: number
  /** Altezza massima della casella (frazione 0–1 dell'ALTEZZA pagina): se il
   *  blocco multi-riga non ci sta, il corpo si riduce automaticamente per
   *  starci (fit-in-box). Assente = altezza libera, come storicamente. */
  maxHeightFrac?: number
}

export interface Template {
  dataUrl: string      // PNG/JPEG rasterizzato (pagina 1 del PDF o immagine)
  w: number            // px del raster (per l'aspect ratio della pagina)
  h: number
  kind: 'pdf' | 'image'
  name: string         // nome file d'origine
  /** Dimensioni FISICHE reali in punti PDF (1pt = 1/72"), solo per kind='pdf'
   *  (dalla viewport di pdf.js a scale 1, già in punti). Servono per generare
   *  il PDF export alle dimensioni fisiche corrette invece che al pixel-count
   *  del raster (~140dpi): senza, la pagina uscirebbe grande ~2× il dovuto. */
  ptW?: number
  ptH?: number
  /** Font VERO incorporato nel PDF del template (estratto da `template-font.ts`),
   *  usato nell'export al posto di Helvetica quando presente. `fontName` è solo
   *  per la UI (mostra cosa è stato rilevato/scelto); i bytes sono base64
   *  (persistiti nel Progetto .ehub). Senza `fontBoldB64`, i campi bold usano
   *  comunque Helvetica-Bold: il template spesso incorpora solo il peso Regular. */
  fontName?: string
  fontRegularB64?: string
  fontBoldB64?: string
}

export interface Elenco {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
  /** Nome del/i foglio/i d'origine (uno o più, uniti con ", " se il file aveva più fogli-dati). */
  sheetName?: string
  /** Metadati di progetto (dal foglio PAGINA INIZIALE): Committente, Oggetto,
   *  Commessa, Data… Risolti nei campi via token `{@Chiave}`. Costanti su ogni copertina. */
  meta?: Record<string, string>
}

export interface DeltaState {
  v: 1
  template: Template | null
  fields: CoverField[]
  elenco: Elenco | null
  /** Colonna dell'elenco usata per nominare i file PDF esportati (uno per riga). */
  filenameColumn?: string
}

/** Un campo risolto al suo valore finale per una specifica copertina. */
export interface ResolvedField {
  text: string
  x: number
  y: number
  anchor: Anchor
  align: Align
  fontFrac: number
  bold: boolean
  /** Larghezza massima (frazione 0–1) per il wrap multi-riga; assente = una riga. */
  maxWidthFrac?: number
  /** Altezza massima della casella (frazione 0–1): corpo auto-ridotto per starci. */
  maxHeightFrac?: number
}

/** Una copertina pronta da renderizzare (in editor o in stampa). */
export interface CoverPage {
  bg: Template
  fields: ResolvedField[]
}

/** Documento completo: tutte le copertine, una per riga dell'elenco. */
export interface CoverDoc {
  pages: CoverPage[]
}
