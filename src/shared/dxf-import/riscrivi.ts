/**
 * Riscrittura DXF → DXF a PASSAGGIO SINGOLO, **senza perdite**.
 *
 * Perché esiste: `read.ts` è un lettore per DISEGNARE, e per farlo butta via tutto ciò che non
 * sa disegnare (`TIPI_UTILI`). Va benissimo per l'anteprima, ma è inservibile per consegnare
 * indietro un file: una tavola vera contiene HATCH, SPLINE, DIMENSION, MULTILEADER, WIPEOUT,
 * IMAGE, OLE2FRAME, ACAD_TABLE, REGION, 3DFACE, VIEWPORT — e un giro
 * parse→modello→`dxf.ts` li cancellerebbe tutti, restituendo al collaboratore un disegno rotto.
 *
 * Qui il file non viene mai "capito": viene **ricopiato**. Si cammina sul flusso di coppie
 * codice/valore e si riscrivono soltanto i punti che ci interessano — il gruppo 8 (layer
 * dell'entità), il gruppo 2 dentro la tabella LAYER, le variabili di header. Ogni altra riga
 * esce **identica ai byte in ingresso**, terminatore di riga compreso: da cui il test cardine
 * di questo modulo, «piano vuoto ⇒ output byte-identico all'input».
 *
 * Nota sui terminatori: `read.ts` normalizza \r\n e fa `.trim()` sui valori, perché a lui
 * interessa il numero. Qui NON si può: un `.trim()` di troppo cambierebbe il file. Le righe si
 * conservano grezze, e si guarda la versione ripulita solo per DECIDERE, mai per riscrivere.
 */

import { daScalare, formattaNumero, HEADER_LUNGHEZZE, HEADER_MOLTIPLICATORE, NON_SCALABILI, tipoNoto } from './scala-codici'

/** Una voce della tabella LAYER da emettere in uscita. 62 negativo = layer spento. */
export interface LayerStudio {
  nome: string
  /** Colore ACI. Sempre positivo qui: lo spegnimento si chiede con `spento`. */
  aci: number
  linetype?: string
  /** Gruppo 370. -3 = default. */
  lineweight?: number
  spento?: boolean
}

export interface PianoRiscrittura {
  /** layer di origine → layer di destinazione. Chi non compare resta com'è. */
  rinomina?: Record<string, string>
  /** Tabella LAYER dello studio da garantire in uscita (creata se manca, corretta se c'è). */
  tabella?: LayerStudio[]
  /** Nomi (di destinazione) da spegnere, in aggiunta a quelli marcati nella tabella. */
  spenti?: string[]
  /** Dirotta qui TEXT/MTEXT/ATTRIB qualunque sia il layer d'origine. null = lasciali stare. */
  testiSu?: string | null
  /** Layer d'ORIGINE i cui testi vanno buttati via del tutto (le quote altrui, di solito). */
  scartaTesti?: string[]
  /** Toglie colore/linetype/spessore dalle entità rimappate, così il colore lo detta il layer. */
  forzaByLayer?: boolean
  /** Nuovo $INSUNITS. undefined = non toccare l'header. */
  insunits?: number
  /** Nuovo $MEASUREMENT. */
  measurement?: number
  /**
   * Riscalatura GEOMETRICA vera: moltiplica le lunghezze per `fattore`. È l'opzione invasiva —
   * il default è dichiarare le unità nell'header e non toccare un numero. Serve quando il
   * collaboratore disegna in metri e noi in millimetri e il file va davvero portato a 1:1.
   */
  scala?: { fattore: number } | null
  /**
   * Da dove partire per gli handle dei layer creati ex novo. Va preso da `$HANDSEED`
   * (lo restituisce `analizzaDxf`): inventarlo significa rischiare una collisione.
   */
  handseed?: number
}

export interface EsitoRiscrittura {
  /** Nomi di layer d'origine incontrati sulle entità. */
  layerVisti: Set<string>
  entitaRiscritte: number
  entitaScartate: number
  layerCreati: string[]
  /** Quanti numeri sono stati moltiplicati (0 se non si riscala la geometria). */
  numeriScalati: number
  avvisi: string[]
}

/** Entità che portano testo: sono quelle dirottabili sul layer testi e scartabili. */
const TIPI_TESTO = new Set(['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'])

/** Gruppi che sulle entità sovrascrivono il layer: vanno tolti per tornare a BYLAYER. */
const GRUPPI_ASPETTO = new Set([62, 420, 430, 6, 370, 440])

/** Una coppia codice/valore, con la posizione delle due righe grezze nel record. */
interface Coppia {
  codice: number
  /** Valore ripulito — solo per decidere. Per riscrivere si usa la riga grezza. */
  valore: string
  iCod: number
  iVal: number
}

const HEX = (n: number): string => n.toString(16).toUpperCase()

/** Lo spazio carta (gruppo 67 = 1) non si riscala: il foglio resta un A1. */
const SPAZIO_CARTA = 67

/**
 * I layer che non si toccano MAI, comunque lo si chieda.
 *
 * `0` è quello su cui vivono i blocchi: le entità disegnate lì dentro una definizione ereditano
 * il layer dell'INSERT che le richiama, e i riferimenti a blocchi ci stanno sopra a migliaia.
 * Rinominarlo o spegnerlo fa sparire i simboli del disegno. `Defpoints` è il layer di servizio
 * delle quote, che AutoCAD non stampa e si aspetta di trovare al suo posto.
 *
 * La guardia sta QUI, nel motore, e non solo nell'interfaccia: una regola di sicurezza che vive
 * in un pannello è una regola che prima o poi qualcuno aggira.
 */
const INTOCCABILI = new Set(['0', '_0', 'DEFPOINTS'])
const intoccabile = (nome: string): boolean => INTOCCABILI.has(nome.toUpperCase())

/**
 * Il layer 0, e solo lui (non `Defpoints`): resta intoccabile per nome, rinomina e spegnimento,
 * ma il suo colore no. È il layer su cui vivono i blocchi — se il collaboratore gli ha lasciato
 * addosso un colore qualunque, ogni blocco che eredita ByLayer da lì si porta dietro quel colore
 * a caso. Lo standard dello studio è: layer 0 grigio (ACI 8), sempre.
 */
const LAYER_ZERO_ACI = new Set(['0', '_0'])
const layerZero = (nome: string): boolean => LAYER_ZERO_ACI.has(nome.toUpperCase())
const ACI_LAYER_ZERO = 8

/**
 * Un nome che può davvero finire in un DXF.
 *
 * Le costanti sentinella dell'interfaccia (`*SPEGNI*`, `*MANTIENI*`) usano l'asterisco proprio
 * perché AutoCAD lo vieta nei nomi di layer — ma questo le rende innocue solo finché non entrano
 * nel file. È già successo: `MANTIENI` trattato come una destinazione finiva in `$CLAYER`, e il
 * file usciva dichiarando attivo un layer inesistente. La guardia sta qui, all'ultimo cancello,
 * perché è l'unico punto che nessuna strada può aggirare.
 */
const nomeValido = (nome: string): boolean => !!nome && !nome.includes('*')

/**
 * Riscrittore incrementale: gli si danno pezzi di file con `push()` e lui chiama `out()` con i
 * pezzi del file nuovo. Non tiene mai in memoria più di un "record" (da un gruppo 0 al
 * successivo), quindi regge una tavola da 250 MB senza materializzarla.
 */
export class RiscrittoreDxf {
  private piano: PianoRiscrittura
  private out: (chunk: string) => void

  private rinomina: Map<string, string>
  private tabella: Map<string, LayerStudio>
  private spenti: Set<string>
  private scartaTesti: Set<string>

  private resto = ''
  private codiceInSospeso: number | null = null
  private rigaCodice = ''

  /** Righe grezze del record corrente (terminatore incluso). */
  private righe: string[] = []
  private coppie: Coppia[] = []

  private sezione = ''
  private tabellaCorrente = ''
  private attesaNomeSezione = false
  /** Handle della tabella LAYER: serve come owner (330) dei record che creiamo. */
  private ownerTabellaLayer = ''
  private layerEmessi = new Set<string>()
  private prossimoHandle: number
  private terminatore = '\r\n'
  private terminatoreNoto = false
  private disallineamenti = 0

  private esito: EsitoRiscrittura = {
    layerVisti: new Set(), entitaRiscritte: 0, entitaScartate: 0, layerCreati: [], numeriScalati: 0, avvisi: [],
  }

  constructor(piano: PianoRiscrittura, out: (chunk: string) => void) {
    this.piano = piano
    this.out = out
    this.rinomina = new Map(Object.entries(piano.rinomina || {}))
    this.tabella = new Map((piano.tabella || []).map(l => [l.nome, l]))
    this.spenti = new Set(piano.spenti || [])
    this.scartaTesti = new Set(piano.scartaTesti || [])
    // Valore di ripiego: il seme vero si legge da $HANDSEED mentre si attraversa l'header.
    this.prossimoHandle = piano.handseed || 0xF0000
  }

  push(chunk: string): void {
    const testo = this.resto ? this.resto + chunk : chunk
    let inizio = 0
    for (;;) {
      const fine = testo.indexOf('\n', inizio)
      if (fine < 0) break
      this.riga(testo.slice(inizio, fine + 1))
      inizio = fine + 1
    }
    this.resto = testo.slice(inizio)
  }

  chiudi(): EsitoRiscrittura {
    if (this.resto) { this.riga(this.resto); this.resto = '' }
    // Un codice rimasto senza valore (file troncato): si ricopia comunque, non si inventa nulla.
    if (this.codiceInSospeso !== null) { this.righe.push(this.rigaCodice); this.codiceInSospeso = null }
    this.scaricaRecord()
    if (this.disallineamenti) {
      this.esito.avvisi.push(
        `File malformato: ${this.disallineamenti} righe dove era atteso un codice di gruppo. ` +
        'La copia è fedele, ma la rimappatura dei layer può essere incompleta — di solito è un ' +
        'DXF uscito da un convertitore online, e nemmeno AutoCAD lo apre.',
      )
    }
    return this.esito
  }

  /** Le righe arrivano a coppie: prima il codice, poi il valore. */
  private riga(grezza: string): void {
    if (!this.terminatoreNoto && grezza.endsWith('\n')) {
      this.terminatore = grezza.endsWith('\r\n') ? '\r\n' : '\n'
      this.terminatoreNoto = true
    }
    if (this.codiceInSospeso === null) {
      const c = parseInt(grezza, 10)
      if (Number.isNaN(c)) {
        // Dove ci si aspettava un codice c'è del testo: le coppie si sono disallineate. Succede
        // sul serio — i convertitori online (ImageToStl e simili) producono MTEXT con un a capo
        // dentro il valore, e quei file AutoCAD non li apre nemmeno. La copia resta fedele, ma
        // da qui in poi le decisioni sui layer non sono più affidabili: si dichiara.
        this.disallineamenti++
        this.righe.push(grezza)
        return
      }
      this.codiceInSospeso = c
      this.rigaCodice = grezza
      return
    }
    const codice = this.codiceInSospeso
    this.codiceInSospeso = null
    const valore = grezza.replace(/\r?\n$/, '').trim()

    // Il gruppo 0 apre un nuovo record: prima si chiude quello in corso.
    if (codice === 0) this.scaricaRecord()

    const iCod = this.righe.length
    this.righe.push(this.rigaCodice, grezza)
    this.coppie.push({ codice, valore, iCod, iVal: iCod + 1 })
  }

  /** Cerca la prima coppia con un dato codice nel record corrente. */
  private trova(codice: number): Coppia | undefined {
    return this.coppie.find(c => c.codice === codice)
  }

  /**
   * Sostituisce il valore di una coppia — ma solo se cambia davvero.
   *
   * La guardia non è un'ottimizzazione, è ciò che tiene in piedi l'identità: i file di AutoCAD
   * allineano i valori a destra (`     7`, `    -3`) e riscrivere `7` al posto di `     7`
   * sarebbe una differenza di byte a parità di significato. Chi chiama non deve preoccuparsi di
   * verificare prima: qui il caso «nessun cambiamento» è inerte per costruzione.
   */
  private sostituisci(c: Coppia, valore: string): void {
    if (c.valore === valore) return
    this.righe[c.iVal] = valore + this.terminatore
  }

  private elimina(c: Coppia): void {
    this.righe[c.iCod] = ''
    this.righe[c.iVal] = ''
  }

  /** Emette il record corrente (dopo averlo eventualmente modificato) e riparte. */
  private scaricaRecord(): void {
    if (!this.righe.length && !this.coppie.length) return
    const emetti = this.decidi()
    if (emetti) {
      let buf = ''
      for (const r of this.righe) if (r) buf += r
      if (buf) this.out(buf)
    }
    this.righe = []
    this.coppie = []
  }

  /** Il cuore: cosa fare del record corrente. Ritorna false per buttarlo via. */
  private decidi(): boolean {
    const zero = this.coppie.length && this.coppie[0].codice === 0 ? this.coppie[0] : null
    const tipo = zero ? zero.valore : ''

    // ── struttura del file ──
    if (tipo === 'SECTION') { this.attesaNomeSezione = true }
    if (this.attesaNomeSezione) {
      const nome = this.trova(2)
      if (nome) { this.sezione = nome.valore; this.attesaNomeSezione = false }
      if (this.sezione === 'HEADER') this.riscriviHeader()
      return true
    }
    if (tipo === 'ENDSEC') { this.sezione = ''; this.tabellaCorrente = ''; return true }
    if (tipo === 'EOF') return true

    if (this.sezione === 'TABLES') return this.decidiTabelle(tipo)

    // ── entità (ENTITIES e corpo dei BLOCK) ──
    if (this.sezione === 'ENTITIES' || this.sezione === 'BLOCKS') {
      // La riscalatura vale per TUTTE le entità, anche quelle di cui non si tocca il layer:
      // sono due lavori indipendenti che capitano nello stesso passaggio.
      this.scalaEntita(tipo)
      return this.decidiEntita(tipo)
    }

    return true
  }

  /** HEADER: $CLAYER va rinominato come tutti gli altri, $INSUNITS/$MEASUREMENT si impostano. */
  private riscriviHeader(): void {
    const scala = this.piano.scala && this.piano.scala.fattore !== 1 ? this.piano.scala.fattore : 0
    for (let i = 0; i < this.coppie.length; i++) {
      const c = this.coppie[i]
      if (c.codice !== 9) continue
      const succ = this.coppie[i + 1]
      if (!succ) continue

      // Le variabili di header che sono lunghezze seguono la geometria: se l'ingombro non si
      // aggiorna, «zoom estensione» inquadra il vuoto.
      if (scala && HEADER_LUNGHEZZE.has(c.valore)) {
        for (let j = i + 1; j < this.coppie.length && this.coppie[j].codice !== 9; j++) {
          const p = this.coppie[j]
          const v = parseFloat(p.valore)
          if (Number.isFinite(v)) { this.sostituisci(p, formattaNumero(v * scala)); this.esito.numeriScalati++ }
        }
        continue
      }
      // Delle quote si scala il MOLTIPLICATORE, non le venti variabili che ne dipendono:
      // stesso risultato a schermo, un ventesimo del rischio.
      if (scala && HEADER_MOLTIPLICATORE.has(c.valore)) {
        const v = parseFloat(succ.valore)
        if (Number.isFinite(v) && v > 0) { this.sostituisci(succ, formattaNumero(v * scala)); this.esito.numeriScalati++ }
        continue
      }

      if (c.valore === '$CLAYER' && succ.codice === 8) {
        const dest = this.destinazione(succ.valore)
        if (dest !== succ.valore) this.sostituisci(succ, dest)
      } else if (c.valore === '$INSUNITS' && succ.codice === 70 && this.piano.insunits !== undefined) {
        this.sostituisci(succ, String(this.piano.insunits))
      } else if (c.valore === '$MEASUREMENT' && succ.codice === 70 && this.piano.measurement !== undefined) {
        this.sostituisci(succ, String(this.piano.measurement))
      } else if (c.valore === '$HANDSEED' && succ.codice === 5) {
        // Gli handle dei layer che creeremo devono partire da qui. Inventarli sarebbe una
        // collisione annunciata: su una tavola da 800.000 entità gli handle veri arrivano
        // lontanissimo, e due oggetti con lo stesso handle sono un file rotto. Il seme lo
        // dichiara il file stesso, e l'HEADER viene prima di TABLES: si legge al volo.
        const attuale = parseInt(succ.valore, 16)
        if (Number.isFinite(attuale)) this.prossimoHandle = Math.max(this.prossimoHandle, attuale)
        // Si riscrive solo se davvero creeremo dei layer: a piano vuoto il file non si tocca.
        if (this.tabella.size) this.sostituisci(succ, HEX(this.prossimoHandle + this.tabella.size + 16))
      }
    }
  }

  private decidiTabelle(tipo: string): boolean {
    if (tipo === 'TABLE') {
      const nome = this.trova(2)
      if (nome) this.tabellaCorrente = nome.valore
      if (this.tabellaCorrente === 'LAYER') {
        const h = this.trova(5)
        this.ownerTabellaLayer = h ? h.valore : ''
        this.layerEmessi.clear()
        // Il 70 dell'intestazione è il numero MASSIMO di voci: si alza per far posto a quelle
        // che creeremo. Una sovrastima è legale, una sottostima no — e qui non sappiamo ancora
        // quante ne mancano davvero (la tabella la stiamo per leggere).
        const n = this.trova(70)
        if (n && this.tabella.size) {
          const attuale = parseInt(n.valore, 10)
          this.sostituisci(n, String((Number.isFinite(attuale) ? attuale : 0) + this.tabella.size))
        }
      }
      return true
    }
    if (tipo === 'ENDTAB') {
      if (this.tabellaCorrente === 'LAYER') this.creaLayerMancanti()
      this.tabellaCorrente = ''
      return true
    }
    if (this.tabellaCorrente !== 'LAYER' || tipo !== 'LAYER') return true

    // ── un record della tabella LAYER ──
    //
    // NON si rinomina e NON si elimina, mai. I record LAYER sono puntati per handle da altre
    // parti del file — i layer congelati nei VIEWPORT (gruppo 331), i filtri layer in OBJECTS,
    // il LAYER_INDEX — e cancellarne uno lascia riferimenti pendenti, cioè un file che AutoCAD
    // apre lamentandosi. E comunque N layer d'origine che confluiscono su uno solo renderebbero
    // la cancellazione inevitabile.
    //
    // Quindi: le ENTITÀ si spostano (gruppo 8), il layer d'origine resta ma **si spegne**.
    // Restano dei layer vuoti e spenti: è un prezzo minimo, reversibile con un click, contro un
    // rischio di corruzione vero.
    const nome = this.trova(2)
    if (!nome) return true
    const origine = nome.valore
    this.layerEmessi.add(origine)
    if (layerZero(origine)) {
      // Gancio a `forzaByLayer`, non un `if` a sé: qui non si tocca nulla a piano vuoto (il
      // cardine del modulo, «piano vuoto ⇒ output identico», resta vero), ma su un'importazione
      // vera — dove `forzaByLayer` è true di default — il layer 0 esce sempre grigio (ACI 8).
      if (this.piano.forzaByLayer) {
        const col = this.trova(62)
        if (col) this.sostituisci(col, String(ACI_LAYER_ZERO))
      }
      return true
    }
    if (intoccabile(origine)) return true

    const svuotato = this.destinazione(origine) !== origine
    const spento = svuotato || this.spenti.has(origine)
    const std = this.tabella.get(origine) // il file aveva già un layer di studio: si allinea

    // La regola è ASIMMETRICA, di proposito. Sui layer del nostro standard comanda la nostra
    // tabella, colore compreso: è il senso del tool. Su tutti gli altri si può solo SPEGNERE,
    // mai riaccendere — se il collaboratore aveva già spento qualcosa avrà avuto le sue ragioni,
    // e riaccenderlo gli riempirebbe la tavola di roba che aveva deciso di non mostrare.
    const col = this.trova(62)
    if (col) {
      const attuale = parseInt(col.valore, 10)
      const giaSpento = Number.isFinite(attuale) && attuale < 0
      if (std) {
        const aci = Math.abs(std.aci)
        this.sostituisci(col, String(spento || std.spento ? -aci : aci))
      } else if (spento && !giaSpento) {
        this.sostituisci(col, String(-Math.abs(Number.isFinite(attuale) ? attuale : 7) || -7))
      }
    }
    if (std && std.linetype) {
      const lt = this.trova(6)
      if (lt) this.sostituisci(lt, std.linetype)
    }
    if (std && std.lineweight !== undefined) {
      const lw = this.trova(370)
      if (lw) this.sostituisci(lw, String(std.lineweight))
    }
    return true
  }

  /** Aggiunge in coda alla tabella i layer di studio che il file non aveva. */
  private creaLayerMancanti(): void {
    const nuovi: string[] = []
    for (const std of this.tabella.values()) {
      if (this.layerEmessi.has(std.nome)) continue
      this.layerEmessi.add(std.nome)
      nuovi.push(this.recordLayer(std))
      this.esito.layerCreati.push(std.nome)
    }
    if (nuovi.length) this.righe.unshift(nuovi.join(''))
  }

  private recordLayer(std: LayerStudio): string {
    const t = this.terminatore
    const spento = this.spenti.has(std.nome) || !!std.spento
    const aci = Math.abs(std.aci)
    const h = HEX(this.prossimoHandle++)
    let s = ''
    const g = (c: number | string, v: string | number) => { s += `${c}${t}${v}${t}` }
    g(0, 'LAYER')
    g(5, h)
    g(330, this.ownerTabellaLayer || '2')
    g(100, 'AcDbSymbolTableRecord')
    g(100, 'AcDbLayerTableRecord')
    g(2, std.nome)
    g(70, 0)
    g(62, spento ? -aci : aci)
    g(6, std.linetype || 'Continuous')
    g(370, std.lineweight ?? -3)
    g(390, 0)
    return s
  }

  private decidiEntita(tipo: string): boolean {
    // BLOCK/ENDBLK hanno anch'essi un gruppo 8: è il layer del blocco, si rinomina come gli altri.
    // `trova` prende il PRIMO gruppo 8 del record: è il layer dell'entità, che nel DXF viene
    // sempre prima di XDATA (1001…) e degli oggetti incorporati (101). Un gruppo 8 più avanti
    // appartiene a dati applicativi di terzi e non va toccato.
    const lay = this.trova(8)
    if (!lay) return true
    const origine = lay.valore
    this.esito.layerVisti.add(origine)

    // Il layer `0` non è un layer, è una convenzione: le entità che ci stanno sopra DENTRO UNA
    // DEFINIZIONE DI BLOCCO ereditano il layer dell'INSERT che le richiama (ByBlock), e i
    // riferimenti a blocchi ci vivono sopra a migliaia — rinominarle romperebbe quell'eredità per
    // ogni blocco della libreria, anche quelli il cui INSERT sta correttamente su un layer
    // impiantistico che spegniamo: l'eredità è ciò che li spegne con lui. Qui, dentro BLOCKS, il
    // layer si protegge (nome intoccabile); il colore no — si riporta a ByLayer così eredita il
    // grigio ACI 8 appena assegnato al layer 0, invece del colore esplicito del collaboratore.
    //
    // Fuori da un blocco (sezione ENTITIES) `0` non è più una convenzione: è geometria (o un
    // INSERT) lasciata lì per disattenzione, senza l'eredità di nessuno a proteggere. Quella
    // può — anzi deve — passare per il flusso normale, come qualunque altro layer d'origine.
    if (this.sezione === 'BLOCKS' && layerZero(origine)) {
      if (this.piano.forzaByLayer) {
        for (const c of this.coppie) if (GRUPPI_ASPETTO.has(c.codice)) this.elimina(c)
      }
      return true
    }
    // `DEFPOINTS` resta intoccabile ovunque. Il layer 0 arrivato fin qui è per forza fuori da un
    // blocco (altrimenti si sarebbe già fermato sopra): niente eredità da proteggere, quindi non
    // rientra più nella guardia — prosegue nel flusso normale, come ogni altro layer d'origine.
    if (intoccabile(origine) && !layerZero(origine)) return true

    const testo = TIPI_TESTO.has(tipo)
    if (testo && this.scartaTesti.has(origine)) { this.esito.entitaScartate++; return false }

    let dest = this.destinazione(origine)
    // I testi si preservano: vanno sul layer dei testi anche quando il loro layer d'origine
    // finisce spento, altrimenti l'annotazione del collaboratore sparirebbe con la geometria.
    if (testo && this.piano.testiSu) dest = this.piano.testiSu

    if (dest !== origine) {
      this.sostituisci(lay, dest)
      this.esito.entitaRiscritte++
      if (this.piano.forzaByLayer) {
        for (const c of this.coppie) if (GRUPPI_ASPETTO.has(c.codice)) this.elimina(c)
      }
    }
    return true
  }

  /**
   * Moltiplica per il fattore di scala le lunghezze del record corrente.
   *
   * Due esclusioni che non sono dettagli:
   * - lo **spazio carta** (gruppo 67 = 1) non si tocca. Il foglio è un A1 e resta un A1: scalarlo
   *   insieme al modello sposterebbe il cartiglio a chilometri di distanza. Il 67 può comparire
   *   dopo le coordinate, ma qui non è un problema — si lavora sul record intero, già raccolto.
   * - le entità di cui **non conosciamo le misure** (OLE, tabelle, solidi) si lasciano stare e si
   *   segnalano. Portano geometria in cache che non si può riscalare in sicurezza.
   */
  private scalaEntita(tipo: string): void {
    const s = this.piano.scala
    if (!s || !s.fattore || s.fattore === 1) return
    if (NON_SCALABILI.has(tipo)) {
      this.avvisaUnaVolta(`«${tipo}» non è stato riscalato: contiene geometria in cache che non si può moltiplicare in sicurezza. Controlla quell'elemento a mano.`)
      return
    }
    const carta = this.coppie.find(c => c.codice === SPAZIO_CARTA)
    if (carta && carta.valore === '1') return
    if (!tipoNoto(tipo)) {
      this.avvisaUnaVolta(`«${tipo}» non è fra le entità note: ne sono state riscalate solo le coordinate. Verifica che sia venuto giusto.`)
    }
    for (const c of this.coppie) {
      if (!daScalare(tipo, c.codice)) continue
      const v = parseFloat(c.valore)
      if (!Number.isFinite(v)) continue
      this.sostituisci(c, formattaNumero(v * s.fattore))
      this.esito.numeriScalati++
    }
  }

  /** Un avviso per tipo, non uno per entità: su una tavola grande sarebbero centomila righe uguali. */
  private avvisaUnaVolta(testo: string): void {
    if (!this.esito.avvisi.includes(testo)) this.esito.avvisi.push(testo)
  }

  /**
   * Dove finisce un layer d'origine. Il pipe dei riferimenti esterni si appiattisce:
   * `TAV-B-XREF|muri` è, per noi, `muri` — il file che consegniamo è l'xref nuovo, non ne
   * annida un altro.
   */
  private destinazione(origine: string): string {
    // I layer intoccabili non si spostano da nessuna via, nemmeno da $CLAYER. Il layer 0 fa
    // eccezione fuori da un blocco: lì non c'è eredità ByBlock da proteggere (la protegge già
    // `decidiEntita` dentro BLOCKS), quindi può seguire la rinomina come chiunque altro.
    if (intoccabile(origine) && !(layerZero(origine) && this.sezione !== 'BLOCKS')) return origine
    const diretto = this.rinomina.get(origine)
    if (diretto) return nomeValido(diretto) ? diretto : origine
    const pipe = origine.lastIndexOf('|')
    if (pipe >= 0) {
      const coda = origine.slice(pipe + 1)
      const perCoda = this.rinomina.get(coda)
      if (perCoda && nomeValido(perCoda)) return perCoda
    }
    return origine
  }
}

/** Comodità per i test e per i file piccoli: riscrive un DXF già in memoria. */
export function riscriviDxf(testo: string, piano: PianoRiscrittura): { dxf: string; esito: EsitoRiscrittura } {
  let fuori = ''
  const r = new RiscrittoreDxf(piano, (c) => { fuori += c })
  const PEZZO = 4 << 20
  for (let i = 0; i < testo.length; i += PEZZO) r.push(testo.slice(i, i + PEZZO))
  const esito = r.chiudi()
  return { dxf: fuori, esito }
}
