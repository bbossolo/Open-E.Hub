/**
 * Quali numeri di un DXF sono LUNGHEZZE, e quali no.
 *
 * Serve per la riscalatura geometrica: moltiplicare le coordinate è facile, sbagliare un
 * group code è invisibile finché non si apre il disegno e ci si accorge che le polilinee hanno
 * archi impazziti. Il formato riusa lo stesso numero con significati diversi a seconda
 * dell'entità, e tre casi in particolare fanno danni silenziosi:
 *
 * - `42` su LWPOLYLINE è il **bulge**, cioè la tangente di un quarto dell'angolo dell'arco:
 *   è un rapporto. Scalarlo trasforma i raccordi in curve sbagliate.
 * - `41`/`42`/`43` su INSERT sono i **fattori di scala** del blocco. Scalarli insieme al punto
 *   d'inserimento raddoppia la scala, perché il contenuto del blocco è già stato scalato.
 * - `40` su ELLIPSE è il **rapporto** fra gli assi, non una misura.
 *
 * Il principio, scritto una volta e valido per tutto il file: **una lunghezza si moltiplica una
 * volta sola; i rapporti e gli adimensionali non si toccano mai.** Quello che non è dichiarato
 * qui non viene scalato, e viene segnalato: meglio un avviso che un disegno rotto.
 */

/** Coordinate: X (10-18), Y (20-28), Z (30-37), quota (38), spessore (39). */
function coordinata(c: number): boolean {
  return (c >= 10 && c <= 18) || (c >= 20 && c <= 28) || (c >= 30 && c <= 39)
}

/**
 * Eccezioni dentro l'intervallo delle coordinate: numeri che stanno fra 10 e 39 ma NON sono
 * posizioni. Sono pochi e vanno saputi a memoria, perché la regola generica li prenderebbe.
 */
const NON_COORDINATA: Record<string, Set<number>> = {
  // 11/21/31 è il VERSORE della direzione X del testo, non un punto: ha modulo 1.
  MTEXT: new Set([11, 21, 31]),
  // 13/23 è la dimensione dell'immagine in PIXEL. 11/12 (vettori U/V) invece sono lunghezze.
  IMAGE: new Set([13, 23]),
  WIPEOUT: new Set([13, 23]),
}

/**
 * I `40` e dintorni che SONO lunghezze, entità per entità. Chi non compare qui non viene
 * scalato oltre le coordinate.
 */
const LUNGHEZZE: Record<string, number[]> = {
  CIRCLE: [40], // raggio
  ARC: [40], // raggio
  TEXT: [40], // altezza (41 è il rapporto di larghezza: NON si scala)
  ATTRIB: [40],
  ATTDEF: [40],
  MTEXT: [40, 41, 42, 43], // altezza, larghezza del riquadro, larghezza e altezza effettive
  LWPOLYLINE: [40, 41, 43], // larghezza iniziale, finale, costante (42 è il bulge)
  POLYLINE: [40, 41],
  VERTEX: [40, 41], // (42 è il bulge)
  INSERT: [44, 45], // passi della matrice (41/42/43 sono i fattori di scala del blocco)
  HATCH: [40, 41, 47], // raggio del bordo ad arco, scala del motivo, dimensione del pixel
  DIMENSION: [40, 41, 42], // lunghezza della linea guida, altezza del testo, misura effettiva
  LEADER: [40, 41],
  MULTILEADER: [40, 41],
  POINT: [],
  LINE: [],
  SOLID: [],
  TRACE: [],
  '3DFACE': [],
  ELLIPSE: [], // 40 è il RAPPORTO fra gli assi, 41/42 sono parametri: nessuno si scala
  SPLINE: [], // 40 sono i nodi (spazio parametrico), 41 i pesi: nessuno si scala
  VIEWPORT: [], // vive nello spazio carta, che è escluso a monte
  IMAGE: [], // 11/12 (vettori U/V) sono lunghezze e passano dalla regola generica
  WIPEOUT: [],
  // Record di struttura, non entità: BLOCK ha il punto base (10/20/30), gli altri niente.
  // Stanno qui perché altrimenti farebbero scattare l'avviso «tipo non noto» su ogni blocco.
  BLOCK: [],
  ENDBLK: [],
  SEQEND: [],
  ATTRIB_END: [],
}

/** Entità che portano geometria in cache non riscalabile in sicurezza: si avvisa e basta. */
export const NON_SCALABILI = new Set(['OLE2FRAME', 'ACAD_TABLE', 'REGION', 'BODY', '3DSOLID', 'SURFACE'])

/** Questo group code, su questa entità, è una lunghezza da moltiplicare? */
export function daScalare(tipo: string, codice: number): boolean {
  if (coordinata(codice)) {
    const ecc = NON_COORDINATA[tipo]
    return !ecc || !ecc.has(codice)
  }
  const l = LUNGHEZZE[tipo]
  return !!l && l.includes(codice)
}

/** Il tipo è fra quelli di cui conosciamo le misure? Se no, si scalano solo le coordinate. */
export function tipoNoto(tipo: string): boolean {
  return tipo in LUNGHEZZE
}

/**
 * Variabili di header che sono lunghezze. `$DIMSCALE` non è in elenco di proposito: è già un
 * moltiplicatore, e si scala quello (vedi `scalaHeader`) invece delle venti variabili di quota,
 * che è molto meno rischioso e visivamente equivalente.
 */
export const HEADER_LUNGHEZZE = new Set([
  '$EXTMIN', '$EXTMAX', '$LIMMIN', '$LIMMAX', '$INSBASE', '$VIEWCTR',
  '$VIEWSIZE', '$LTSCALE', '$TEXTSIZE', '$TRACEWID', '$FILLETRAD', '$THICKNESS',
  '$CHAMFERA', '$CHAMFERB', '$CHAMFERC', '$CHAMFERD',
])

/** Il moltiplicatore di scala delle quote: si scala questo, non le sue venti derivate. */
export const HEADER_MOLTIPLICATORE = new Set(['$DIMSCALE'])

/**
 * Formatta un numero riscalato senza notazione esponenziale: alcuni lettori rigidi la
 * digeriscono male, e un DXF che AutoCAD non apre non serve a nulla.
 */
export function formattaNumero(v: number): string {
  if (!Number.isFinite(v)) return '0'
  if (v === 0) return '0.0'
  const a = Math.abs(v)
  // 12 cifre significative bastano e avanzano per un disegno; sotto il micron si tronca.
  const dec = a >= 1000 ? 4 : a >= 1 ? 8 : 12
  let s = v.toFixed(dec)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '.0')
  return s
}
