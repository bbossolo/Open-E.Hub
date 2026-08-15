/**
 * FONDAMENTA DXF CONDIVISE della suite Open E.Hub.
 *
 * Fonte UNICA del know-how DXF della suite — header AutoCAD R2000 (AC1015, necessario
 * per i lineweight), tabelle LTYPE/LAYER con colore·linetype·spessore, primitive
 * (LINE, LWPOLYLINE, TEXT), quota lineare semplice e testo ASCII-safe. Ogni tool che
 * esporta DXF passa di qui: un solo posto dove vive la qualità del disegno.
 *
 * Coordinate: il `DxfBuilder` opzionalmente fa il FLIP Y (Y verso l'alto nel DXF) data
 * l'altezza del foglio, così chi disegna può ragionare con Y verso il basso (DOM-like).
 */

/** Testo ASCII puro per il DXF (accenti → lettere base, simboli tecnici → equivalenti; il resto → '?'). */
export function asciiSafe(s: unknown): string {
  return String(s ?? '')
    .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[ÀÁÂÃÄ]/g, 'A').replace(/[ÈÉÊË]/g, 'E').replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O').replace(/[ÙÚÛÜ]/g, 'U').replace(/[Ç]/g, 'C')
    .replace(/[·•]/g, '-').replace(/[×]/g, 'x').replace(/[°]/g, ' deg')
    .replace(/[Øø⌀]/g, 'D').replace(/[Ω]/g, 'ohm').replace(/[²]/g, '2').replace(/[³]/g, '3')
    .replace(/[π]/g, 'pi').replace(/[φϕ]/g, 'phi').replace(/[ω]/g, 'omega').replace(/[ε]/g, 'e')
    .replace(/[λ]/g, 'lambda').replace(/[τ]/g, 'tau').replace(/[μ]/g, 'u')
    .replace(/[–—]/g, '-').replace(/[“”„]/g, '"').replace(/['’‘]/g, "'")
    .replace(/[^ -~]/g, '?')
}

/** Definizione di un layer DXF: nome · colore AutoCAD · linetype · lineweight (1/100 mm, -3 = default). */
export interface DxfLayer { name: string; color: number; linetype?: 'CONTINUOUS' | 'DASHED'; lineweight?: number }

/** Emettitore di coppie codice/valore DXF (group codes), con flip Y opzionale. */
export class DxfBuilder {
  private out: string[] = []
  private h: number
  /** @param sheetHeight altezza foglio per il flip Y; 0/assente = nessun flip. */
  constructor(sheetHeight = 0) { this.h = sheetHeight }
  /** true se il builder specchia la Y (coordinate layout DOM-like, Y verso il basso). */
  get flipY(): boolean { return this.h !== 0 }
  // Un valore numerico DXF non deve MAI essere NaN/Infinity: il token «NaN» rende il file
  // illeggibile ai lettori severi (AutoCAD su Windows → «corrotto»). I non-finiti → 0.
  g(code: number, value: number | string): this {
    if (typeof value === 'number' && !Number.isFinite(value)) value = 0
    this.out.push(String(code)); this.out.push(String(value)); return this
  }
  fx(x: number): number { return +x.toFixed(3) }
  fy(y: number): number { return +(this.h ? this.h - y : y).toFixed(3) }

  // ── Handle R2004 ──────────────────────────────────────────────────────────
  // In AutoCAD R2004 (AC1018) OGNI oggetto «owned» (entità, voce di tabella, blocco,
  // dictionary) deve avere un handle esadecimale UNIVOCO (gruppo 5, o 105 per DIMSTYLE) e
  // l'header deve dichiarare $HANDSEED = primo handle libero. Senza, i lettori rigidi
  // (AutoCAD/GstarCAD/Eplus su Windows) rifiutano il file come corrotto. Un solo contatore
  // monotòno per tutto il documento → nessuna collisione possibile.
  private seed = 0x100
  private handseedIdx = -1
  /** Handle del BLOCK_RECORD *Model_Space: owner (gruppo 330) di ogni entità. */
  msHandle = '0'
  /** Handle del BLOCK_RECORD *Paper_Space. */
  psHandle = '0'
  /** Handle BLOCK_RECORD per ogni blocco NOMINATO dichiarato in `dxfBegin({ blocks })`. */
  blockHandles = new Map<string, string>()
  /** Restituisce un handle esadecimale univoco crescente e avanza il seme. */
  handle(): string { return (this.seed++).toString(16).toUpperCase() }
  /** Emette `$HANDSEED` con uno slot placeholder, patchato da `finalizeHandseed()`. */
  markHandseed(): void { this.g(9, '$HANDSEED'); this.out.push('5'); this.handseedIdx = this.out.length; this.out.push('0') }
  /** Scrive nel placeholder `$HANDSEED` il valore ESATTO (primo handle libero). */
  finalizeHandseed(): void { if (this.handseedIdx >= 0) this.out[this.handseedIdx] = this.seed.toString(16).toUpperCase() }

  // DXF standard = fine-riga CRLF: i lettori Windows (AutoCAD e importer CAD) su file
  // LF-only possono corrompere il disegno. CRLF è accettato ovunque (Mac/Win/Linux).
  toString(): string { return this.out.join('\r\n') + '\r\n' }
}

/** Marker di sottoclasse (gruppo 100) richiesto da R2004 per ciascun tipo di entità. */
const ENTITY_SUBCLASS: Record<string, string> = {
  LINE: 'AcDbLine', CIRCLE: 'AcDbCircle', LWPOLYLINE: 'AcDbPolyline', TEXT: 'AcDbText',
}

/** Opzioni comuni delle primitive: lineweight (1/100 mm) + colore ACI (62) e/o true color (420). */
export interface EntityOpts { lineweight?: number; aci?: number; rgb?: [number, number, number] }

/**
 * PREAMBOLO di un'entità R2004: tipo, handle univoco (5), owner *Model_Space (330),
 * sottoclasse `AcDbEntity`, layer (8), colore/lineweight opzionali, sottoclasse specifica.
 * Concentra qui handle+owner+subclass così le primitive non li ripetono: è ciò che rende il
 * file accettabile ai CAD rigidi (AutoCAD/GstarCAD/Eplus) senza perdere fedeltà (la geometria
 * a valle resta identica). Il chiamante emette a seguire solo i group-code geometrici.
 */
export function entity(b: DxfBuilder, type: string, layer: string, opts: EntityOpts = {}): void {
  b.g(0, type); b.g(5, b.handle()); b.g(330, b.msHandle)
  b.g(100, 'AcDbEntity'); b.g(8, layer)
  if (opts.aci != null) b.g(62, opts.aci)
  if (opts.rgb) b.g(420, (opts.rgb[0] << 16) | (opts.rgb[1] << 8) | opts.rgb[2])
  if (opts.lineweight != null) b.g(370, opts.lineweight)
  const sub = ENTITY_SUBCLASS[type]; if (sub) b.g(100, sub)
}

/** Emette HEADER (AC1015 + unità mm + estensione) e TABLES (LTYPE + LAYER) sul builder.
 *  `blocks` (opzionale) registra e scrive definizioni BLOCK nominate (libreria blocchi
 *  studio): ogni blocco ottiene un vero BLOCK_RECORD, piazzabile a valle con `insertBlock`. */
export function dxfBegin(b: DxfBuilder, opts: { extMax: [number, number]; layers: DxfLayer[]; extMin?: [number, number]; blocks?: DxfBlockToWrite[] }): void {
  const [exX, exY] = opts.extMax
  const [miX, miY] = opts.extMin || [0, 0]
  const cx = +(((miX + exX) / 2)).toFixed(3), cy = +(((miY + exY) / 2)).toFixed(3)
  const vh = Math.max(1, exY - miY), aspect = +(Math.max(1, exX - miX) / vh).toFixed(4)
  // ── HEADER ──────────────────────────────────────────────────────────────
  b.g(0, 'SECTION'); b.g(2, 'HEADER')
  b.g(9, '$ACADVER'); b.g(1, 'AC1018') // R2004 — lineweight (gruppo 370) + true color (gruppo 420)
  b.markHandseed() // $HANDSEED (patchato a fine documento col primo handle libero)
  b.g(9, '$DWGCODEPAGE'); b.g(3, 'ANSI_1252')
  b.g(9, '$INSBASE'); b.g(10, 0); b.g(20, 0); b.g(30, 0)
  b.g(9, '$EXTMIN'); b.g(10, +miX.toFixed(3)); b.g(20, +miY.toFixed(3)); b.g(30, 0)
  b.g(9, '$EXTMAX'); b.g(10, +exX.toFixed(3)); b.g(20, +exY.toFixed(3)); b.g(30, 0)
  b.g(9, '$LUNITS'); b.g(70, 4); b.g(9, '$LUPREC'); b.g(70, 3)
  b.g(9, '$INSUNITS'); b.g(70, 4) // 4 = mm
  b.g(9, '$MEASUREMENT'); b.g(70, 1) // 1 = metrico
  b.g(9, '$CLAYER'); b.g(8, '0')
  b.g(9, '$TEXTSTYLE'); b.g(7, 'STANDARD')
  b.g(9, '$DIMSTYLE'); b.g(2, 'STANDARD')
  b.g(9, '$CELTYPE'); b.g(6, 'ByLayer'); b.g(9, '$CECOLOR'); b.g(62, 256)
  b.g(9, '$LWDISPLAY'); b.g(290, 1); b.g(9, '$CELWEIGHT'); b.g(370, -1)
  b.g(0, 'ENDSEC')
  // ── TABLES (R2004: VPORT, LTYPE, LAYER, STYLE, VIEW, UCS, APPID, DIMSTYLE, BLOCK_RECORD) ──
  b.g(0, 'SECTION'); b.g(2, 'TABLES')
  const tableHead = (name: string, count: number): string => {
    const h = b.handle()
    b.g(0, 'TABLE'); b.g(2, name); b.g(5, h); b.g(330, 0); b.g(100, 'AcDbSymbolTable'); b.g(70, count)
    return h
  }
  const record = (type: string, tableH: string, recSubclass: string): void => {
    b.g(0, type); b.g(5, b.handle()); b.g(330, tableH); b.g(100, 'AcDbSymbolTableRecord'); b.g(100, recSubclass)
  }
  // VPORT
  {
    const th = tableHead('VPORT', 1)
    record('VPORT', th, 'AcDbViewportTableRecord'); b.g(2, '*Active'); b.g(70, 0)
    b.g(10, 0); b.g(20, 0); b.g(11, 1); b.g(21, 1); b.g(12, cx); b.g(22, cy)
    b.g(13, 0); b.g(23, 0); b.g(14, 10); b.g(24, 10); b.g(15, 10); b.g(25, 10)
    b.g(16, 0); b.g(26, 0); b.g(36, 1); b.g(17, 0); b.g(27, 0); b.g(37, 0)
    b.g(40, +vh.toFixed(3)); b.g(41, aspect); b.g(42, 50); b.g(43, 0); b.g(44, 0)
    b.g(50, 0); b.g(51, 0); b.g(71, 0); b.g(72, 100); b.g(73, 1); b.g(74, 3); b.g(75, 0); b.g(76, 0); b.g(77, 0); b.g(78, 0)
    b.g(0, 'ENDTAB')
  }
  // LTYPE (ByBlock/ByLayer obbligatorie in R2004 + CONTINUOUS/DASHED)
  {
    const th = tableHead('LTYPE', 4)
    record('LTYPE', th, 'AcDbLinetypeTableRecord'); b.g(2, 'ByBlock'); b.g(70, 0); b.g(3, ''); b.g(72, 65); b.g(73, 0); b.g(40, 0)
    record('LTYPE', th, 'AcDbLinetypeTableRecord'); b.g(2, 'ByLayer'); b.g(70, 0); b.g(3, ''); b.g(72, 65); b.g(73, 0); b.g(40, 0)
    record('LTYPE', th, 'AcDbLinetypeTableRecord'); b.g(2, 'CONTINUOUS'); b.g(70, 0); b.g(3, 'Solid line'); b.g(72, 65); b.g(73, 0); b.g(40, 0)
    record('LTYPE', th, 'AcDbLinetypeTableRecord'); b.g(2, 'DASHED'); b.g(70, 0); b.g(3, 'Dashed'); b.g(72, 65); b.g(73, 2); b.g(40, 6.0); b.g(49, 5.0); b.g(74, 0); b.g(49, -1.0); b.g(74, 0)
    b.g(0, 'ENDTAB')
  }
  // LAYER (voce 0 SEMPRE + i layer del chiamante; 62 negativo = layer OFF, convenzione TESTO_RICERCA)
  {
    const th = tableHead('LAYER', opts.layers.length + 1)
    record('LAYER', th, 'AcDbLayerTableRecord'); b.g(2, '0'); b.g(70, 0); b.g(62, 7); b.g(6, 'CONTINUOUS'); b.g(370, -3); b.g(390, 0)
    for (const l of opts.layers) {
      record('LAYER', th, 'AcDbLayerTableRecord'); b.g(2, l.name); b.g(70, 0); b.g(62, l.color); b.g(6, l.linetype || 'CONTINUOUS'); b.g(370, l.lineweight ?? -3); b.g(390, 0)
    }
    b.g(0, 'ENDTAB')
  }
  // STYLE (STANDARD → rende validi i TEXT)
  {
    const th = tableHead('STYLE', 1)
    record('STYLE', th, 'AcDbTextStyleTableRecord'); b.g(2, 'STANDARD'); b.g(70, 0); b.g(40, 0); b.g(41, 1); b.g(50, 0); b.g(71, 0); b.g(42, 2.5); b.g(3, 'txt'); b.g(4, '')
    b.g(0, 'ENDTAB')
  }
  // VIEW / UCS (vuote)
  { const th = tableHead('VIEW', 0); void th; b.g(0, 'ENDTAB') }
  { const th = tableHead('UCS', 0); void th; b.g(0, 'ENDTAB') }
  // APPID (ACAD)
  {
    const th = tableHead('APPID', 1)
    record('APPID', th, 'AcDbRegAppTableRecord'); b.g(2, 'ACAD'); b.g(70, 0)
    b.g(0, 'ENDTAB')
  }
  // DIMSTYLE (⚠️ la voce usa il gruppo 105 per l'handle, non il 5)
  {
    const h = b.handle()
    b.g(0, 'TABLE'); b.g(2, 'DIMSTYLE'); b.g(5, h); b.g(330, 0); b.g(100, 'AcDbSymbolTable'); b.g(70, 1); b.g(100, 'AcDbDimStyleTable'); b.g(71, 0)
    b.g(0, 'DIMSTYLE'); b.g(105, b.handle()); b.g(330, h); b.g(100, 'AcDbSymbolTableRecord'); b.g(100, 'AcDbDimStyleTableRecord'); b.g(2, 'STANDARD'); b.g(70, 0)
    b.g(0, 'ENDTAB')
  }
  // BLOCK_RECORD (*Model_Space, *Paper_Space + un record per ogni blocco NOMINATO del
  // chiamante → salva gli handle come owner delle entità/definizioni)
  const namedBlocks = opts.blocks || []
  {
    const th = tableHead('BLOCK_RECORD', 2 + namedBlocks.length)
    b.msHandle = b.handle()
    b.g(0, 'BLOCK_RECORD'); b.g(5, b.msHandle); b.g(330, th); b.g(100, 'AcDbSymbolTableRecord'); b.g(100, 'AcDbBlockTableRecord'); b.g(2, '*Model_Space'); b.g(70, 0); b.g(340, 0)
    b.psHandle = b.handle()
    b.g(0, 'BLOCK_RECORD'); b.g(5, b.psHandle); b.g(330, th); b.g(100, 'AcDbSymbolTableRecord'); b.g(100, 'AcDbBlockTableRecord'); b.g(2, '*Paper_Space'); b.g(70, 0); b.g(340, 0)
    for (const bl of namedBlocks) {
      const h = b.handle()
      b.blockHandles.set(bl.name, h)
      b.g(0, 'BLOCK_RECORD'); b.g(5, h); b.g(330, th); b.g(100, 'AcDbSymbolTableRecord'); b.g(100, 'AcDbBlockTableRecord'); b.g(2, bl.name); b.g(70, 0); b.g(340, 0)
    }
    b.g(0, 'ENDTAB')
  }
  b.g(0, 'ENDSEC')
  // ── BLOCKS (definizioni vuote di *Model_Space e *Paper_Space, coerenti coi BLOCK_RECORD;
  // più le definizioni NOMINATE del chiamante, via `defineBlock`) ──
  b.g(0, 'SECTION'); b.g(2, 'BLOCKS')
  const emptyBlock = (name: string, owner: string): void => {
    b.g(0, 'BLOCK'); b.g(5, b.handle()); b.g(330, owner); b.g(100, 'AcDbEntity'); b.g(8, '0'); b.g(100, 'AcDbBlockBegin')
    b.g(2, name); b.g(70, 0); b.g(10, 0); b.g(20, 0); b.g(30, 0); b.g(3, name); b.g(1, '')
    b.g(0, 'ENDBLK'); b.g(5, b.handle()); b.g(330, owner); b.g(100, 'AcDbEntity'); b.g(8, '0'); b.g(100, 'AcDbBlockEnd')
  }
  emptyBlock('*Model_Space', b.msHandle)
  emptyBlock('*Paper_Space', b.psHandle)
  for (const bl of namedBlocks) defineBlock(b, bl.name, bl.prims, bl.attdefs)
  b.g(0, 'ENDSEC')
  b.g(0, 'SECTION'); b.g(2, 'ENTITIES')
}

/** Una primitiva geometrica di un blocco (coordinate LOCALI al blocco, nessun flip Y). */
export type DxfBlockPrim =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'polyline'; pts: Array<[number, number]>; closed?: boolean }

/** Un ATTDEF (attributo compilabile al piazzamento) dentro un blocco, coordinate locali. */
export interface DxfBlockAttdef { tag: string; x: number; y: number; height?: number; default?: string; prompt?: string }

/** Definizione di un blocco da scrivere con `dxfBegin({ blocks: [...] })`. */
export interface DxfBlockToWrite { name: string; prims: DxfBlockPrim[]; attdefs?: DxfBlockAttdef[] }

/**
 * Scrive la definizione BLOCK/ENDBLK di un blocco NOMINATO (geometria + ATTDEF), owner =
 * l'handle BLOCK_RECORD registrato per `name` in `dxfBegin({ blocks })`. Va chiamata SOLO
 * da `dxfBegin` (dentro la sezione BLOCKS, prima che si apra ENTITIES) — `defineBlock` non è
 * pensata per l'uso diretto del chiamante, che invece dichiara i blocchi in `opts.blocks`.
 */
function defineBlock(b: DxfBuilder, name: string, prims: DxfBlockPrim[], attdefs: DxfBlockAttdef[] = []): void {
  const owner = b.blockHandles.get(name)
  if (!owner) return // blocco non registrato in BLOCK_RECORD: non scrivibile (contratto interno)
  b.g(0, 'BLOCK'); b.g(5, b.handle()); b.g(330, owner); b.g(100, 'AcDbEntity'); b.g(8, '0'); b.g(100, 'AcDbBlockBegin')
  b.g(2, name); b.g(70, 0); b.g(10, 0); b.g(20, 0); b.g(30, 0); b.g(3, name); b.g(1, '')
  const blockEntity = (type: string): void => {
    b.g(0, type); b.g(5, b.handle()); b.g(330, owner); b.g(100, 'AcDbEntity'); b.g(8, '0')
    const sub = ENTITY_SUBCLASS[type]; if (sub) b.g(100, sub)
  }
  for (const p of prims) {
    if (p.kind === 'line') {
      blockEntity('LINE')
      b.g(10, +p.x1.toFixed(3)); b.g(20, +p.y1.toFixed(3)); b.g(30, 0)
      b.g(11, +p.x2.toFixed(3)); b.g(21, +p.y2.toFixed(3)); b.g(31, 0)
    } else if (p.kind === 'circle') {
      if (!Number.isFinite(p.r) || p.r <= 0) continue
      blockEntity('CIRCLE')
      b.g(10, +p.cx.toFixed(3)); b.g(20, +p.cy.toFixed(3)); b.g(30, 0); b.g(40, +p.r.toFixed(3))
    } else if (p.kind === 'polyline') {
      if (p.pts.length < 2) continue
      blockEntity('LWPOLYLINE')
      b.g(90, p.pts.length); b.g(70, p.closed ? 1 : 0)
      for (const [px, py] of p.pts) { b.g(10, +px.toFixed(3)); b.g(20, +py.toFixed(3)) }
    }
  }
  for (const a of attdefs) {
    blockEntity('ATTDEF')
    b.g(100, 'AcDbAttributeDefinition')
    b.g(1, asciiSafe(a.default ?? '')); b.g(2, asciiSafe(a.tag)); b.g(3, asciiSafe(a.prompt ?? a.tag))
    b.g(10, +a.x.toFixed(3)); b.g(20, +a.y.toFixed(3)); b.g(30, 0)
    b.g(40, +(a.height ?? 2.5).toFixed(3)); b.g(72, 0); b.g(74, 0)
  }
  b.g(0, 'ENDBLK'); b.g(5, b.handle()); b.g(330, owner); b.g(100, 'AcDbEntity'); b.g(8, '0'); b.g(100, 'AcDbBlockEnd')
}

/** Opzioni di piazzamento di un INSERT (scala/rotazione/attributi/layer). */
export interface InsertOpts { scale?: number; rot?: number; attrs?: Record<string, string>; layer?: string }

/**
 * Piazza un'ISTANZA (INSERT) di un blocco definito con `dxfBegin({ blocks })`, con gli
 * ATTRIB compilati (uno per ATTDEF passato — il chiamante decide i valori). Va chiamata
 * in ENTITIES (dopo `dxfBegin`, prima di `dxfEnd`). Coordinate FLIP-Y come le altre primitive.
 */
export function insertBlock(b: DxfBuilder, name: string, x: number, y: number, opts: InsertOpts = {}): void {
  const layer = opts.layer || '0'
  const attrs = opts.attrs || {}
  const tags = Object.keys(attrs)
  entity(b, 'INSERT', layer, {})
  b.g(100, 'AcDbBlockReference')
  if (tags.length) b.g(66, 1)
  b.g(2, name)
  b.g(10, b.fx(x)); b.g(20, b.fy(y)); b.g(30, 0)
  if (opts.scale != null && opts.scale !== 1) { b.g(41, opts.scale); b.g(42, opts.scale); b.g(43, opts.scale) }
  if (opts.rot) b.g(50, opts.rot)
  for (const tag of tags) {
    b.g(0, 'ATTRIB'); b.g(5, b.handle()); b.g(330, b.msHandle); b.g(100, 'AcDbEntity'); b.g(8, layer); b.g(100, 'AcDbText')
    b.g(10, b.fx(x)); b.g(20, b.fy(y)); b.g(30, 0); b.g(40, 2.5)
    b.g(1, asciiSafe(attrs[tag])); b.g(100, 'AcDbAttribute'); b.g(2, asciiSafe(tag)); b.g(70, 0)
  }
  if (tags.length) { b.g(0, 'SEQEND'); b.g(5, b.handle()); b.g(330, b.msHandle); b.g(100, 'AcDbEntity'); b.g(8, layer) }
}

/** Chiude ENTITIES, emette la sezione OBJECTS (root dictionary) e finalizza `$HANDSEED`. */
export function dxfEnd(b: DxfBuilder): string {
  b.g(0, 'ENDSEC') // fine ENTITIES
  // OBJECTS: named-object dictionary radice (owner 0) + ACAD_GROUP (richiesti da R2004)
  b.g(0, 'SECTION'); b.g(2, 'OBJECTS')
  const hRoot = b.handle(), hGroup = b.handle()
  b.g(0, 'DICTIONARY'); b.g(5, hRoot); b.g(330, 0); b.g(100, 'AcDbDictionary'); b.g(281, 1); b.g(3, 'ACAD_GROUP'); b.g(350, hGroup)
  b.g(0, 'DICTIONARY'); b.g(5, hGroup); b.g(330, hRoot); b.g(100, 'AcDbDictionary'); b.g(281, 1)
  b.g(0, 'ENDSEC')
  b.finalizeHandseed()
  b.g(0, 'EOF')
  return b.toString()
}

/** Segmento LINE su un layer (lineweight opzionale, sovrascrive il layer). */
export function line(b: DxfBuilder, layer: string, x1: number, y1: number, x2: number, y2: number, opts: EntityOpts = {}): void {
  entity(b, 'LINE', layer, opts)
  b.g(10, b.fx(x1)); b.g(20, b.fy(y1)); b.g(30, 0)
  b.g(11, b.fx(x2)); b.g(21, b.fy(y2)); b.g(31, 0)
}

/** Cerchio (centro + raggio) su un layer (lineweight opzionale). Raggio non finito/≤0 → non emesso
 *  (AutoCAD su Windows considera un file con entità degeneri come corrotto). */
export function circle(b: DxfBuilder, layer: string, cx: number, cy: number, r: number, opts: EntityOpts = {}): void {
  if (!Number.isFinite(r) || r <= 0) return
  entity(b, 'CIRCLE', layer, opts)
  b.g(10, b.fx(cx)); b.g(20, b.fy(cy)); b.g(30, 0); b.g(40, +r.toFixed(3))
}

/** Rettangolo (x,y = angolo, w,h) come LWPOLYLINE chiusa (lineweight opzionale). */
export function rect(b: DxfBuilder, layer: string, x: number, y: number, w: number, h: number, opts: EntityOpts = {}): void {
  entity(b, 'LWPOLYLINE', layer, opts)
  b.g(90, 4); b.g(70, 1)
  for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as Array<[number, number]>) { b.g(10, b.fx(px)); b.g(20, b.fy(py)) }
}

/** Polilinea aperta (o chiusa) da una lista di punti (lineweight opzionale). */
export function polyline(b: DxfBuilder, layer: string, pts: Array<[number, number]>, closed = false, opts: EntityOpts = {}): void {
  if (pts.length < 2) return
  entity(b, 'LWPOLYLINE', layer, opts)
  b.g(90, pts.length); b.g(70, closed ? 1 : 0)
  for (const [px, py] of pts) { b.g(10, b.fx(px)); b.g(20, b.fy(py)) }
}

/** TEXT ASCII-safe su un layer (allineato a sinistra), stile STANDARD. */
export function dtext(b: DxfBuilder, layer: string, x: number, y: number, hgt: number, s: string): void {
  const safe = asciiSafe(s)
  if (!safe) return
  entity(b, 'TEXT', layer, {})
  b.g(10, b.fx(x)); b.g(20, b.fy(y)); b.g(30, 0)
  b.g(40, +hgt.toFixed(3)); b.g(1, safe); b.g(7, 'STANDARD'); b.g(50, 0)
}

/**
 * Cartiglio (riquadro + righe «Etichetta: valore») in basso a destra, su un layer dedicato.
 * Condiviso: lo usano sia il fronte auto (`fronteToDxf`) sia la composizione (`composizioneToDxf`)
 * — così il DXF porta SEMPRE il cartiglio, coerente con l'anteprima a schermo.
 */
export function dxfCartiglio(b: DxfBuilder, x: number, y: number, w: number, h: number, rows: Array<[string, string]>, opts: { layer?: string; textH?: number } = {}): void {
  const layer = opts.layer || 'CARTIGLIO', th = opts.textH || 6
  rect(b, layer, x, y, w, h)
  const n = Math.max(1, rows.length), rh = h / n
  rows.forEach((r, i) => {
    const ry = y + i * rh
    if (i) line(b, layer, x, ry, x + w, ry) // separatore riga
    dtext(b, layer, x + 6, ry + rh / 2 - th / 2, th, `${r[0]}: ${r[1]}`)
  })
}

/**
 * Quota lineare semplice (linea di quota + estensioni + testo) sul layer `QUOTE`.
 * `horizontal` = larghezza (linea sotto, estensioni in giù); altrimenti altezza (a sinistra).
 */
export function dimension(b: DxfBuilder, x1: number, y1: number, x2: number, y2: number, horizontal: boolean, value: number, opts: { layer?: string; offset?: number; textH?: number } = {}): void {
  const layer = opts.layer || 'QUOTE', off = opts.offset ?? 30, th = opts.textH ?? 8
  if (horizontal) {
    const dy = y1 - off
    line(b, layer, x1, y1, x1, dy); line(b, layer, x2, y2, x2, dy); line(b, layer, x1, dy, x2, dy)
    dtext(b, layer, (x1 + x2) / 2 - th, dy - th - 2, th, `${Math.round(value)}`)
  } else {
    const dx = x1 - off
    line(b, layer, x1, y1, dx, y1); line(b, layer, x2, y2, dx, y2); line(b, layer, dx, y1, dx, y2)
    dtext(b, layer, dx - th * 3, (y1 + y2) / 2, th, `${Math.round(value)}`)
  }
}
