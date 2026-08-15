/**
 * Lettura DXF a PASSAGGIO SINGOLO e A CHUNK, pensata per file grandi.
 *
 * Perché esiste: un parser ingenuo fa `text.split(/\r\n|\r|\n/)` sull'intero file e poi
 * costruisce un array di coppie codice/valore. Su una tavola vera dello studio (240 MB,
 * 29 milioni di righe) sono ~30 M di stringhe più ~15 M di array a due elementi: alcuni
 * gigabyte prima ancora di aver disegnato un pixel — e ripetuti a ogni passata.
 *
 * Qui invece:
 * - si consuma il file **a pezzi** (`push`), così il worker può leggerlo con `Blob.stream()`
 *   senza mai materializzare la stringa intera (che in JS peserebbe fino al doppio del file);
 * - ogni entità è un oggetto a **forma fissa** con i numeri già convertiti. Sembra un
 *   dettaglio ed è la differenza fra aprire e non aprire: la versione con
 *   `Record<number, string[]>` costava ~1,6 KB per entità (le chiavi numeriche mandano V8 in
 *   modalità dizionario) e su una tavola grande arrivava a 1,3 GB di picco.
 */

/** Tipi di entità che sappiamo disegnare: tutto il resto non viene nemmeno allocato. */
const TIPI_UTILI = new Set([
  'LINE', 'LWPOLYLINE', 'POLYLINE', 'VERTEX', 'SEQEND', 'CIRCLE', 'ARC',
  'TEXT', 'MTEXT', 'INSERT', 'ATTRIB',
])

/**
 * Entità DXF a forma fissa. Alcuni slot sono condivisi da group-code che nel DXF hanno lo
 * stesso numero ma significato diverso a seconda del tipo — è la convenzione del formato,
 * non una scorciatoia: `h` (40) è l'altezza di un TEXT e il raggio di un CIRCLE/ARC; `a1`
 * (50) è la rotazione di un TEXT/INSERT e l'angolo iniziale di un ARC; `flag` (70) sono i
 * flag di chiusura di una polilinea e il numero di colonne di un INSERT.
 */
export interface DxfEnt {
  t: string
  layer: string
  /** 10/20 — primo punto. */
  x: number
  y: number
  /** 11/21 — secondo punto (LINE). */
  x2: number
  y2: number
  /** 40 — altezza testo · raggio cerchio/arco. */
  h: number
  /** 50 — rotazione testo/INSERT · angolo iniziale arco. */
  a1: number
  /** 51 — angolo finale arco. */
  a2: number
  /** 41/42 — scala X/Y dell'INSERT. */
  sx: number
  sy: number
  /** 44/45 — passo colonne/righe dell'INSERT a matrice. */
  cspc: number
  rspc: number
  /** 70 — flag chiusura polilinea · colonne INSERT. */
  flag: number
  /** 71 — righe INSERT. */
  flag2: number
  /** 2 — nome del blocco (INSERT) · tag (ATTRIB). */
  name: string
  /** 1 — testo (TEXT/MTEXT/ATTRIB); i frammenti MTEXT arrivano su più righe e si concatenano. */
  txt: string
  /** Vertici: LWPOLYLINE (10/20 ripetuti) e POLYLINE (VERTEX successivi). */
  xs: number[] | null
  ys: number[] | null
  /**
   * 42 sulle POLILINEE — bulge per segmento (bulges[i] = arco fra vertice i e i+1;
   * 0 = tratto dritto). Storicamente il 42 finiva in `sy` (scala Y dell'INSERT)
   * per QUALUNQUE entità: gli archi delle polilinee diventavano corde dritte.
   */
  bulges: number[] | null
  /** 42 su un VERTEX (POLYLINE vecchio stile): bulge del segmento che parte da qui. */
  bulge: number
  /** 67 — 1 = paperspace (layout), 0/assente = model space. */
  ps: number
  /** 230 — componente Z dell'estrusione: -1 = blocco specchiato (mirror X in OCS). */
  ez: number
}

function nuovaEnt(t: string, layer: string): DxfEnt {
  return {
    t, layer,
    x: 0, y: 0, x2: 0, y2: 0,
    h: 0, a1: 0, a2: 0,
    sx: 1, sy: 1, cspc: 0, rspc: 0,
    flag: 0, flag2: 0,
    name: '', txt: '',
    xs: null, ys: null,
    bulges: null, bulge: 0,
    ps: 0, ez: 1,
  }
}

export interface DxfBlockDef {
  nome: string
  baseX: number
  baseY: number
  ents: DxfEnt[]
}

/** Riga della tabella LAYER (sezione TABLES): colore ACI, congelato, spento. */
export interface DxfLayerDef {
  /** Colore ACI (1-255); il segno negativo del DXF («spento») è già scorporato. */
  aci: number
  /** Flag 70 bit 1: layer congelato (frozen). */
  frozen: boolean
  /** Colore 62 negativo: layer spento (off). */
  spento: boolean
}

export interface DxfLettura {
  blocchi: Map<string, DxfBlockDef>
  /** Entità della sezione ENTITIES (model space). */
  entita: DxfEnt[]
  unitsPerMeter: number | null
  /** Tabella LAYER (colori ACI / frozen / off), se presente nel file. */
  layerTable: Record<string, DxfLayerDef>
  /** Entità NON disegnabili incontrate e scartate, per tipo (HATCH, SPLINE…). */
  saltatePerTipo: Record<string, number>
}

/* $INSUNITS → unità di disegno per metro.
   1=in 2=ft 3=mi 4=mm 5=cm 6=m 7=km 8=µin 9=mil 10=yd 11=Å 12=nm 13=µm 14=dm */
const INSUNITS: Record<number, number> = {
  1: 39.3701, 2: 3.28084, 3: 0.000621371, 4: 1000, 5: 100, 6: 1, 7: 0.001,
  8: 39370078.7, 9: 39370.0787, 10: 1.09361, 11: 1e10, 12: 1e9, 13: 1e6, 14: 10,
}

const numero = (s: string): number => {
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : 0
}

/**
 * Lettore incrementale: gli si danno pezzi di testo con `push()`, alla fine `chiudi()`
 * restituisce la lettura. I pezzi possono spezzare una riga a metà: il resto viene tenuto
 * da parte e ricucito col chunk successivo.
 */
export class LettoreDxf {
  private blocchi = new Map<string, DxfBlockDef>()
  private entita: DxfEnt[] = []
  private unitsPerMeter: number | null = null
  private layerTable: Record<string, DxfLayerDef> = {}
  private saltatePerTipo: Record<string, number> = {}
  /** Riga della tabella LAYER in corso di lettura (sezione TABLES). */
  private layerDef: { nome: string; aci: number; frozen: boolean; spento: boolean } | null = null

  private resto = ''
  /** Il DXF è a coppie: una riga col codice, una col valore. Qui si tiene il codice in attesa. */
  private codiceInSospeso: number | null = null

  private sezione = ''
  private attesaNomeSezione = false
  private attesaInsunits = false
  private blk: DxfBlockDef | null = null
  private inTestataBlocco = false
  private ent: DxfEnt | null = null
  /** true se l'entità corrente è di un tipo che non ci serve: si legge e si butta. */
  private scarto = false
  private dest: DxfEnt[] | null = null

  /** Dà in pasto al lettore un pezzo di file. */
  push(chunk: string): void {
    const testo = this.resto ? this.resto + chunk : chunk
    let inizio = 0
    for (;;) {
      const fine = testo.indexOf('\n', inizio)
      if (fine < 0) break
      let taglio = fine
      if (taglio > inizio && testo.charCodeAt(taglio - 1) === 13) taglio-- // \r\n
      this.riga(testo.slice(inizio, taglio))
      inizio = fine + 1
    }
    this.resto = testo.slice(inizio)
  }

  /** Chiude la lettura (consuma l'ultima riga, che può non avere il \n finale). */
  chiudi(): DxfLettura {
    if (this.resto) { this.riga(this.resto); this.resto = '' }
    this.chiudiEntita()
    this.chiudiLayerDef()
    return {
      blocchi: this.blocchi, entita: this.entita, unitsPerMeter: this.unitsPerMeter,
      layerTable: this.layerTable, saltatePerTipo: this.saltatePerTipo,
    }
  }

  private chiudiLayerDef(): void {
    const ld = this.layerDef
    this.layerDef = null
    if (ld && ld.nome) this.layerTable[ld.nome] = { aci: ld.aci, frozen: ld.frozen, spento: ld.spento }
  }

  private riga(s: string): void {
    if (this.codiceInSospeso === null) {
      const c = parseInt(s, 10)
      // riga spuria (codice non numerico): si tollera e si tira dritto
      this.codiceInSospeso = Number.isNaN(c) ? null : c
      return
    }
    const codice = this.codiceInSospeso
    this.codiceInSospeso = null
    this.coppia(codice, s.trim())
  }

  private chiudiEntita(): void {
    const e = this.ent
    this.ent = null
    this.scarto = false
    if (!e || !this.dest) return

    // POLYLINE vecchio stile: i VERTEX sono entità separate che SEGUONO. Si agganciano al
    // volo, invece di fare un pre-pass su tutto l'array (che su 800k entità costerebbe caro).
    if (e.t === 'VERTEX') {
      const ultimo = this.dest[this.dest.length - 1]
      if (ultimo && ultimo.t === 'POLYLINE' && ultimo.xs && ultimo.ys) {
        ultimo.xs.push(e.x)
        ultimo.ys.push(e.y)
        if (e.bulge) {
          if (!ultimo.bulges) ultimo.bulges = []
          while (ultimo.bulges.length < ultimo.xs.length - 1) ultimo.bulges.push(0)
          ultimo.bulges[ultimo.xs.length - 1] = e.bulge
        }
      }
      return
    }
    if (e.t === 'SEQEND') return
    this.dest.push(e)
  }

  private apriEntita(tipo: string, dest: DxfEnt[]): void {
    if (!TIPI_UTILI.has(tipo)) {
      // Diagnostica MAI muta: si conta cosa viene scartato (HATCH, SPLINE,
      // DIMENSION…) così l'utente sa PERCHÉ nel disegno manca qualcosa.
      this.saltatePerTipo[tipo] = (this.saltatePerTipo[tipo] || 0) + 1
      this.ent = null; this.scarto = true; this.dest = dest; return
    }
    this.scarto = false
    this.dest = dest
    const e = nuovaEnt(tipo, '0')
    if (tipo === 'LWPOLYLINE' || tipo === 'POLYLINE') { e.xs = []; e.ys = [] }
    this.ent = e
  }

  private coppia(codice: number, valore: string): void {
    // ── struttura del file: SECTION / ENDSEC / nuova entità ──
    if (codice === 0) {
      this.chiudiEntita()
      if (valore === 'SECTION') { this.attesaNomeSezione = true; return }
      if (valore === 'ENDSEC') {
        this.chiudiLayerDef()
        this.sezione = ''
        this.dest = null
        this.blk = null
        this.inTestataBlocco = false
        return
      }
      if (valore === 'EOF') return

      // Tabella LAYER (sezione TABLES): colore ACI, frozen, off — serve al
      // consumatore per «Colori CAD» e per partire coi layer congelati spenti.
      if (this.sezione === 'TABLES') {
        this.chiudiLayerDef()
        if (valore === 'LAYER') this.layerDef = { nome: '', aci: 7, frozen: false, spento: false }
        return
      }

      if (this.sezione === 'BLOCKS') {
        if (valore === 'BLOCK') {
          this.blk = { nome: '', baseX: 0, baseY: 0, ents: [] }
          this.inTestataBlocco = true
          this.dest = null
          return
        }
        if (valore === 'ENDBLK') {
          if (this.blk && this.blk.nome) this.blocchi.set(this.blk.nome, this.blk)
          this.blk = null
          this.inTestataBlocco = false
          this.dest = null
          return
        }
        this.inTestataBlocco = false
        if (this.blk) this.apriEntita(valore, this.blk.ents)
        return
      }

      if (this.sezione === 'ENTITIES') { this.apriEntita(valore, this.entita); return }
      return // altre sezioni: nessuna entità da costruire
    }

    if (this.attesaNomeSezione && codice === 2) {
      this.sezione = valore
      this.attesaNomeSezione = false
      return
    }

    if (this.sezione === 'HEADER') {
      if (codice === 9) { this.attesaInsunits = valore === '$INSUNITS'; return }
      if (this.attesaInsunits && codice === 70) {
        this.unitsPerMeter = INSUNITS[parseInt(valore, 10)] ?? null
        this.attesaInsunits = false
      }
      return
    }

    if (this.layerDef) {
      const ld = this.layerDef
      if (codice === 2) ld.nome = valore
      else if (codice === 62) {
        const c = parseInt(valore, 10) || 0
        ld.spento = c < 0
        ld.aci = Math.abs(c) || 7
      } else if (codice === 70) ld.frozen = ((parseInt(valore, 10) || 0) & 1) === 1
      return
    }

    // testata del blocco: nome (2) e punto base (10/20)
    if (this.inTestataBlocco && this.blk) {
      if (codice === 2 && !this.blk.nome) this.blk.nome = valore
      else if (codice === 10) this.blk.baseX = numero(valore)
      else if (codice === 20) this.blk.baseY = numero(valore)
      return
    }

    const e = this.ent
    if (!e || this.scarto) return

    switch (codice) {
      case 8: e.layer = valore; break
      case 2: e.name = valore; break
      case 1: e.txt += valore; break // MTEXT spezza il testo su più righe (codici 1 e 3)
      case 3: e.txt += valore; break
      case 10: if (e.xs) e.xs.push(numero(valore)); else e.x = numero(valore); break
      case 20: if (e.ys) e.ys.push(numero(valore)); else e.y = numero(valore); break
      case 11: e.x2 = numero(valore); break
      case 21: e.y2 = numero(valore); break
      case 40: e.h = numero(valore); break
      case 41: e.sx = numero(valore) || 1; break
      case 42:
        // Il 42 è POLISEMICO: bulge del vertice appena letto su una polilinea
        // (l'arco fra due vertici), scala Y su un INSERT. La versione storica
        // lo mandava SEMPRE in `sy` e gli archi diventavano corde dritte.
        if (e.xs) {
          const b = numero(valore)
          if (b && e.xs.length) {
            if (!e.bulges) e.bulges = []
            while (e.bulges.length < e.xs.length - 1) e.bulges.push(0)
            e.bulges[e.xs.length - 1] = b
          }
        } else if (e.t === 'VERTEX') e.bulge = numero(valore)
        else e.sy = numero(valore) || 1
        break
      case 44: e.cspc = numero(valore); break
      case 45: e.rspc = numero(valore); break
      case 50: e.a1 = numero(valore); break
      case 51: e.a2 = numero(valore); break
      case 67: e.ps = parseInt(valore, 10) || 0; break
      case 70: e.flag = parseInt(valore, 10) || 0; break
      case 71: e.flag2 = parseInt(valore, 10) || 0; break
      case 230: e.ez = numero(valore); break
      default: break
    }
  }
}

/** Comodità per test e uso sincrono: legge un DXF già interamente in memoria. */
export function leggiDxf(text: string, onProgress?: (frazione: number) => void): DxfLettura {
  const lettore = new LettoreDxf()
  const PEZZO = 4 << 20
  for (let i = 0; i < text.length; i += PEZZO) {
    lettore.push(text.slice(i, i + PEZZO))
    if (onProgress) onProgress(Math.min(1, (i + PEZZO) / text.length))
  }
  if (onProgress) onProgress(1)
  return lettore.chiudi()
}
