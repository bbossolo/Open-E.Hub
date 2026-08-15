/**
 * δ Pages — espressioni con token per i campi derivati (puro, no DOM).
 *
 * Un campo VARIABILE può valere non solo una colonna intera, ma una sua PARTE
 * o una COMPOSIZIONE di più colonne + testo letterale. Serve perché il cartiglio
 * reale scompone/ricompone il codice in celle distinte:
 *   Protocollo Tavola = {FASE}-{Disciplina}-{TIPO DI ELABORATO}   → "E-EL-QE"
 *   Tavola N°         = {CODICE ELABORATO|tail}                    → "CAB4-EL01a"
 *   Data di Emissione = {DATA|meseanno}                            → "APRILE 2026"
 *   Stato del progetto= {FASE PROGETTO|stato}                      → "ESECUTIVO"
 *   Numero (ISO 19650)= {Progressivo|pad:5}                        → "00001"
 *
 * Grammatica: testo letterale con token `{Nome Colonna|fn:arg}`. `{@Chiave}`
 * legge dai METADATI di progetto (foglio PAGINA INIZIALE) invece che dalla riga.
 * Header/chiave assenti → stringa vuota (il resto del testo letterale resta).
 */

/** Lettera FASE PROGETTO → stato per esteso (mappa estensibile). */
const STATO_MAP: Record<string, string> = {
  B: 'BOZZA',
  A: 'AUTORIZZATIVO',
  F: 'FATTIBILITÀ',
  P: 'PRELIMINARE',
  D: 'DEFINITIVO',
  E: 'ESECUTIVO',
  C: 'CANTIERE',
}

const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE']

/**
 * Data → «MESE ANNO» (es. «APRILE 2026»). Best-effort: gestisce i formati più
 * comuni negli elenchi elaborati — `M/D/YY`/`M/D/YYYY` (US, come "4/17/26"),
 * `D/M/YYYY`, `YYYY-MM-DD` e l'ISO. Se non riconosce nulla ritorna il testo
 * originale (mai un valore inventato).
 */
/**
 * Estrae (giorno, mese, anno) dai formati data comuni negli elenchi elaborati —
 * `YYYY-MM-DD`, `M/D/YY`/`M/D/YYYY` (US, come "4/17/26"), `D/M/YYYY`. Se il primo
 * campo di un formato con separatore è > 12 è per forza il giorno (D/M), altrimenti
 * si assume M/D (formato US osservato). Ritorna null se non riconosce nulla.
 */
function parseData(raw: string): { d: number | null; mo: number; y: number } | null {
  const s = raw.trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] }
  if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/.exec(s))) {
    const a = +m[1], b = +m[2]
    const day = a > 12 ? a : b, mo = a > 12 ? b : a
    let y = +m[3]; if (y < 100) y += 2000
    if (mo < 1 || mo > 12) return null
    return { y, mo, d: day }
  }
  return null
}

/** Data → «MESE ANNO» (es. «APRILE 2026»). Testo originale se non riconosciuta. */
function meseAnno(raw: string): string {
  const p = parseData(raw)
  return p ? `${MESI[p.mo - 1]} ${p.y}` : raw.trim()
}

/** Data → «gg-mm-aaaa» (es. «17-04-2026»), il formato di cartiglio più comune osservato. Testo
 *  originale se non riconosciuta o priva di giorno. */
function dataGiorno(raw: string): string {
  const p = parseData(raw)
  if (!p || p.d == null) return raw.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(p.d)}-${pad(p.mo)}-${p.y}`
}

/** Applica una funzione-token al valore grezzo. Funzione sconosciuta → valore invariato. */
function applyFn(value: string, fn: string, arg: string | undefined): string {
  switch (fn) {
    case 'tail': { const sep = arg || '_'; const i = value.lastIndexOf(sep); return i >= 0 ? value.slice(i + sep.length) : value }
    case 'head': { const sep = arg || '_'; const i = value.indexOf(sep); return i >= 0 ? value.slice(0, i) : value }
    case 'upper': return value.toUpperCase()
    case 'lower': return value.toLowerCase()
    case 'trim': return value.trim()
    case 'meseanno': return meseAnno(value)
    case 'data': return dataGiorno(value)
    case 'stato': { const k = value.trim().toUpperCase(); return STATO_MAP[k] ?? value }
    case 'pad': { const n = parseInt(arg || '4', 10); return value.padStart(Number.isFinite(n) && n > 0 ? n : 4, '0') }
    default: return value
  }
}

/** Chiave normalizzata per un lookup tollerante: minuscole, spazi collassati. Serve
 *  perché gli header reali hanno spaziatura/maiuscole irregolari (es. «TITOLO  CARTIGLIO»
 *  con doppio spazio) mentre il token è scritto pulito. */
const normKey = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Valore in `rec` per `name`: match esatto, poi fallback normalizzato (spazi/maiuscole). */
function lookup(rec: Record<string, string>, name: string): string {
  if (name in rec) return rec[name]
  const nk = normKey(name)
  for (const k of Object.keys(rec)) if (normKey(k) === nk) return rec[k]
  return ''
}

/** Legge il valore di un token `Nome` (colonna della riga) o `@Chiave` (metadato progetto). */
function tokenValue(name: string, row: Record<string, string>, meta: Record<string, string>): string {
  if (name.startsWith('@')) return lookup(meta, name.slice(1))
  return lookup(row, name)
}

/**
 * Risolve un'espressione con token in testo finale. `{Col}` → valore colonna,
 * `{@Meta}` → metadato progetto, `{Col|fn:arg}` → valore trasformato. Il testo
 * fuori dai token è letterale.
 */
export function resolveExpr(expr: string, row: Record<string, string>, meta: Record<string, string> = {}): string {
  if (!expr) return ''
  return expr.replace(/\{([^{}|]+)(?:\|([^{}:]+)(?::([^{}]*))?)?\}/g, (_all, name: string, fn: string | undefined, arg: string | undefined) => {
    const v = tokenValue(name.trim(), row, meta)
    return fn ? applyFn(v, fn.trim(), arg) : v
  })
}

/** I nomi di token referenziati (colonne e `@meta`), per validare/avvisare sugli orfani. */
export function exprTokens(expr: string): string[] {
  const out: string[] = []
  const re = /\{([^{}|]+)(?:\|[^{}]*)?\}/g
  let m
  while ((m = re.exec(expr || ''))) out.push(m[1].trim())
  return out
}

/**
 * Riconosce un'espressione SEMPLICE: `{Colonna}` o `{Colonna|fn}` esatti — tutta
 * l'espressione è un unico token, senza testo letterale intorno, senza altri
 * token, senza argomento custom (`|fn:arg`) e non un metadato (`{@Chiave}`).
 * Estrae `{col, fn}` (fn `undefined` se assente), o `null` se l'espressione è
 * più complessa. Puro (nessun DOM) — usato dall'editor a menu (ui/campi.js)
 * per decidere se mostrare Sorgente+Formato invece del testo dell'espressione.
 */
export function simpleExprParts(expr: string): { col: string; fn: string | undefined } | null {
  const m = /^\{([^{}|]+)(?:\|([^{}:]+))?\}$/.exec((expr ?? '').trim())
  if (!m) return null
  const col = m[1].trim()
  if (!col || col.startsWith('@')) return null
  const fn = m[2] !== undefined ? m[2].trim() : undefined
  if (fn === '') return null
  return { col, fn }
}
