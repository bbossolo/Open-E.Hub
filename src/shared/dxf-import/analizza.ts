/**
 * Inventario di un DXF: cosa c'è dentro, prima di decidere cosa farne.
 *
 * È la passata che precede `riscrivi.ts`. Serve a tre cose che il riscrittore non può sapere da
 * solo: quali layer esistono davvero (con colore, spessore, stato acceso/spento), **quanto pesa**
 * ciascuno in numero di entità — perché su una tavola da 177 layer l'attenzione va data ai
 * cinque che contengono il disegno, non ai centoventi che contengono tre linee — e da dove
 * partono gli handle liberi.
 *
 * Perché non riusa `read.ts`: quello costruisce la geometria per disegnarla, e su una tavola
 * grande (240 MB) ci mette secondi e centinaia di MB. Qui non si alloca nulla per entità: si
 * contano e basta.
 */

/** Un layer come sta nel file, non come vorremmo che fosse. */
export interface LayerTrovato {
  nome: string
  /** `TAV-B-XREF|muri` → `TAV-B-XREF`. null se il layer è locale. */
  prefissoXref: string | null
  /** Il nome senza il prefisso del riferimento esterno. */
  base: string
  /** Colore ACI così come dichiarato: negativo = layer spento. */
  colore: number
  spento: boolean
  /** Gruppo 70, bit 1 = congelato. */
  congelato: boolean
  bloccato: boolean
  linetype: string
  lineweight: number
  /** Entità nella sezione ENTITIES (il disegno vero, non i blocchi). */
  nEntita: number
  /** Di quelle, quante portano testo. */
  nTesti: number
  /** Riferimenti a blocchi (INSERT): è il motivo per cui il layer 0 non si tocca. */
  nInsert: number
  /** Solo nella tabella, mai usato da un'entità: candidato naturale allo spegnimento. */
  vuoto: boolean
}

export interface AnalisiDxf {
  acadver: string
  /** $INSUNITS dichiarato. Attenzione: i DXF mentono, va sempre verificato sul bbox. */
  insunits: number | null
  measurement: number | null
  /** Primo handle libero: da qui partono i layer che creeremo. */
  handseed: number
  extmin: [number, number] | null
  extmax: [number, number] | null
  layer: LayerTrovato[]
  nEntita: number
  /** Righe dove ci si aspettava un codice di gruppo: se > 0 il file è malformato. */
  disallineamenti: number
}

const TIPI_TESTO = new Set(['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'])

/** Spezza `TAV-B-XREF|muri` in prefisso e base. Gli xref annidati danno `A|B|LAYER`. */
export function appiattisci(nome: string): { prefissoXref: string | null; base: string } {
  const i = nome.lastIndexOf('|')
  return i < 0 ? { prefissoXref: null, base: nome } : { prefissoXref: nome.slice(0, i), base: nome.slice(i + 1) }
}

interface Grezzo {
  colore: number; flag: number; linetype: string; lineweight: number
  nEntita: number; nTesti: number; nInsert: number
}

const nuovo = (): Grezzo => ({ colore: 7, flag: 0, linetype: 'Continuous', lineweight: -3, nEntita: 0, nTesti: 0, nInsert: 0 })

export class AnalizzatoreDxf {
  private resto = ''
  private codice: number | null = null

  private sezione = ''
  private attesaNomeSezione = false
  private tipo = ''
  private variabile = ''
  private inTabellaLayer = false

  private layer = new Map<string, Grezzo>()
  private corrente: Grezzo | null = null
  /** Il layer dell'entità in corso: si conta una volta sola per entità. */
  private contata = false

  private acadver = ''
  private insunits: number | null = null
  private measurement: number | null = null
  private handseed = 0
  private extmin: [number, number] | null = null
  private extmax: [number, number] | null = null
  private nEntita = 0
  private disallineamenti = 0

  push(chunk: string): void {
    const testo = this.resto ? this.resto + chunk : chunk
    let inizio = 0
    for (;;) {
      const fine = testo.indexOf('\n', inizio)
      if (fine < 0) break
      let taglio = fine
      if (taglio > inizio && testo.charCodeAt(taglio - 1) === 13) taglio--
      this.riga(testo.slice(inizio, taglio))
      inizio = fine + 1
    }
    this.resto = testo.slice(inizio)
  }

  chiudi(): AnalisiDxf {
    if (this.resto) { this.riga(this.resto); this.resto = '' }
    const layer: LayerTrovato[] = []
    for (const [nome, g] of this.layer) {
      layer.push({
        nome, ...appiattisci(nome),
        colore: g.colore, spento: g.colore < 0,
        congelato: (g.flag & 1) !== 0, bloccato: (g.flag & 4) !== 0,
        linetype: g.linetype, lineweight: g.lineweight,
        nEntita: g.nEntita, nTesti: g.nTesti, nInsert: g.nInsert, vuoto: g.nEntita === 0,
      })
    }
    // Ordine di lavoro, non alfabetico: davanti chi contiene il disegno.
    layer.sort((a, b) => (b.nEntita - a.nEntita) || a.nome.localeCompare(b.nome))
    return {
      acadver: this.acadver, insunits: this.insunits, measurement: this.measurement,
      handseed: this.handseed, extmin: this.extmin, extmax: this.extmax,
      layer, nEntita: this.nEntita, disallineamenti: this.disallineamenti,
    }
  }

  private riga(s: string): void {
    if (this.codice === null) {
      const c = parseInt(s, 10)
      if (Number.isNaN(c)) { this.disallineamenti++; return }
      this.codice = c
      return
    }
    const codice = this.codice
    this.codice = null
    this.coppia(codice, s.trim())
  }

  private coppia(codice: number, valore: string): void {
    if (codice === 0) {
      this.tipo = valore
      this.contata = false
      if (valore === 'SECTION') { this.attesaNomeSezione = true; return }
      if (valore === 'ENDSEC') { this.sezione = ''; this.inTabellaLayer = false; return }
      if (this.sezione === 'TABLES') {
        if (valore === 'ENDTAB') { this.inTabellaLayer = false }
        else if (valore === 'LAYER' && this.inTabellaLayer) this.corrente = null
      }
      return
    }

    if (this.attesaNomeSezione && codice === 2) {
      this.sezione = valore
      this.attesaNomeSezione = false
      return
    }

    if (this.sezione === 'HEADER') { this.header(codice, valore); return }

    if (this.sezione === 'TABLES') {
      if (this.tipo === 'TABLE' && codice === 2) {
        this.inTabellaLayer = valore === 'LAYER'
        return
      }
      if (!this.inTabellaLayer || this.tipo !== 'LAYER') return
      if (codice === 2) {
        this.corrente = this.layer.get(valore) || nuovo()
        this.layer.set(valore, this.corrente)
        return
      }
      const g = this.corrente
      if (!g) return
      if (codice === 62) g.colore = parseInt(valore, 10) || 7
      else if (codice === 70) g.flag = parseInt(valore, 10) || 0
      else if (codice === 6) g.linetype = valore
      else if (codice === 370) g.lineweight = parseInt(valore, 10) || -3
      return
    }

    // Le entità: si conta il primo gruppo 8 di ciascuna. Quelli successivi appartengono a XDATA
    // di terzi (1001…) e non dicono nulla sul layer dell'entità.
    if (this.sezione === 'ENTITIES' && codice === 8 && !this.contata) {
      this.contata = true
      this.nEntita++
      let g = this.layer.get(valore)
      if (!g) { g = nuovo(); this.layer.set(valore, g) }
      g.nEntita++
      if (TIPI_TESTO.has(this.tipo)) g.nTesti++
      if (this.tipo === 'INSERT') g.nInsert++
    }
  }

  private header(codice: number, valore: string): void {
    if (codice === 9) { this.variabile = valore; return }
    switch (this.variabile) {
      case '$ACADVER': if (codice === 1) this.acadver = valore; break
      case '$INSUNITS': if (codice === 70) this.insunits = parseInt(valore, 10); break
      case '$MEASUREMENT': if (codice === 70) this.measurement = parseInt(valore, 10); break
      case '$HANDSEED': if (codice === 5) { const h = parseInt(valore, 16); if (Number.isFinite(h)) this.handseed = h } break
      case '$EXTMIN':
        if (codice === 10) this.extmin = [parseFloat(valore) || 0, this.extmin ? this.extmin[1] : 0]
        else if (codice === 20 && this.extmin) this.extmin[1] = parseFloat(valore) || 0
        break
      case '$EXTMAX':
        if (codice === 10) this.extmax = [parseFloat(valore) || 0, this.extmax ? this.extmax[1] : 0]
        else if (codice === 20 && this.extmax) this.extmax[1] = parseFloat(valore) || 0
        break
      default: break
    }
  }
}

export function analizzaDxf(testo: string): AnalisiDxf {
  const a = new AnalizzatoreDxf()
  const PEZZO = 4 << 20
  for (let i = 0; i < testo.length; i += PEZZO) a.push(testo.slice(i, i + PEZZO))
  return a.chiudi()
}

/* $INSUNITS → unità di disegno per metro. Stessa tabella di `read.ts`. */
const INSUNITS: Record<number, number> = { 1: 39.3701, 2: 3.28084, 4: 1000, 5: 100, 6: 1, 10: 1.09361, 14: 10 }

export interface EsitoScala {
  /** Unità per metro ritenute vere. null = non deducibile, serve calibrare a mano. */
  unitaPerMetro: number | null
  /** Quanto misura la diagonale dell'edificio con le unità dedotte. */
  diagonaleM: number | null
  /** Fattore per portare il disegno a millimetri (1 unità = 1 mm). */
  fattoreVersoMm: number | null
  dichiaratoAttendibile: boolean
  nota: string
}

/**
 * Che scala ha davvero questo disegno.
 *
 * Non ci si fida di `$INSUNITS`: **i DXF mentono**. Una tavola reale dichiarava millimetri
 * ed era disegnata in metri — un import ci è già inciampato, con marker grandi come l'edificio e tutte
 * le lunghezze sbagliate di 1000×. Quindi il valore dichiarato si usa solo se supera la prova
 * dei fatti: un edificio è
 * largo fra 2 m e 5 km. Se non torna, si prova con le altre unità plausibili; se non torna
 * nessuna, si dichiara l'ignoranza e si chiede una calibrazione a due punti.
 */
export function deduciScala(a: AnalisiDxf): EsitoScala {
  const plausibile = (m: number): boolean => m >= 2 && m <= 5000
  const latoX = a.extmin && a.extmax ? Math.abs(a.extmax[0] - a.extmin[0]) : 0
  const latoY = a.extmin && a.extmax ? Math.abs(a.extmax[1] - a.extmin[1]) : 0
  const diag = latoX || latoY ? Math.hypot(latoX, latoY) : null

  if (!diag || !Number.isFinite(diag) || diag <= 0) {
    return { unitaPerMetro: null, diagonaleM: null, fattoreVersoMm: null, dichiaratoAttendibile: false,
      nota: 'Il file non dichiara l’ingombro del disegno: calibra su una misura nota.' }
  }

  // L'ingombro dichiarato NON è garantito. Su una tavola reale andava da -270 a 180 in X ma
  // arrivava a -26288 in Y: una manciata di entità perse a chilometri di distanza — capita di
  // continuo — e la
  // diagonale che ne esce è pura invenzione. Un edificio con un lato sessanta volte l'altro non
  // esiste: quando il rapporto è assurdo, l'ingombro è sporco e da lì non si deduce niente.
  const lungo = Math.max(latoX, latoY)
  const corto = Math.min(latoX, latoY)
  if (corto > 0 && lungo / corto > 20) {
    return { unitaPerMetro: null, diagonaleM: null, fattoreVersoMm: null, dichiaratoAttendibile: false,
      nota: `L’ingombro dichiarato è sporco (${lungo.toFixed(0)} × ${corto.toFixed(0)}: c’è geometria vagante lontanissima dal disegno), quindi la scala non è deducibile. Calibra su una misura che conosci.` }
  }

  const dichiarato = a.insunits !== null ? INSUNITS[a.insunits] ?? null : null
  if (dichiarato && plausibile(diag / dichiarato)) {
    return { unitaPerMetro: dichiarato, diagonaleM: diag / dichiarato, fattoreVersoMm: 1000 / dichiarato,
      dichiaratoAttendibile: true, nota: `Il file dichiara ${etichetta(a.insunits!)} e i conti tornano.` }
  }

  // Il dichiarato non regge: si cerca l'unità che rende l'edificio di dimensioni umane.
  // L'ORDINE conta: più di una unità può dare un numero plausibile (20 unità sono 6 m in piedi
  // e 20 m in metri, entrambi edifici credibili), quindi si prova prima quello che uno studio
  // italiano usa davvero — millimetri, centimetri, metri — e solo dopo le unità imperiali.
  for (const dedotta of [4, 5, 6, 14, 1, 2, 10]) {
    const upm = INSUNITS[dedotta]
    if (!plausibile(diag / upm)) continue
    return { unitaPerMetro: upm, diagonaleM: diag / upm, fattoreVersoMm: 1000 / upm, dichiaratoAttendibile: false,
      nota: dichiarato
        ? `Il file dichiara ${etichetta(a.insunits!)}, ma con quelle unità l’edificio misurerebbe ${formatta(diag / dichiarato)}: è disegnato in ${etichetta(dedotta)}.`
        : `Il file non dichiara le unità: dalle dimensioni è disegnato in ${etichetta(dedotta)}.` }
  }

  return { unitaPerMetro: null, diagonaleM: null, fattoreVersoMm: null, dichiaratoAttendibile: false,
    nota: 'Nessuna unità rende plausibili le dimensioni del disegno: calibra su una misura nota.' }
}

const ETICHETTE: Record<number, string> = {
  1: 'pollici', 2: 'piedi', 4: 'millimetri', 5: 'centimetri', 6: 'metri', 10: 'iarde', 14: 'decimetri',
}
const etichetta = (ins: number): string => ETICHETTE[ins] || `unità ${ins}`
const formatta = (m: number): string => (m < 2 ? `${m.toFixed(2)} m` : m > 5000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(1)} m`)
