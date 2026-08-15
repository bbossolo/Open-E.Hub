/**
 * Impacchettamento del prezzario normalizzato per disco/runtime.
 *
 * Strategia (vedi STEP 4c del roadmap):
 *  - i campi categoriali a bassa cardinalità (livelli, disciplina, settore, um,
 *    tipologia…) si ripetono identici su migliaia di righe → vengono deduplicati
 *    in una tabella `dict` e referenziati per indice;
 *  - le righe diventano TUPLE posizionali (niente chiavi JSON ripetute 40k volte);
 *  - `regione`/`anno` sono costanti per file → vivono in `meta`, non per riga.
 * Il payload è auto-descrittivo (`inlineCols`/`dictCols`), così `unpack` non
 * dipende dall'ordine hard-coded e il formato può evolvere senza rompere i dati.
 * A valle, il build comprime in gzip; il roundtrip pack→unpack è coperto da test.
 */
import type { PackedComponenti, PackedPrezzario, PriceRow, PrezzarioMeta, RisorsaComponente } from './types'
import type { AnalisiRigaTipo } from '../../../shared/compositore/analisi-prezzi'

/** Colonne con valore (quasi) unico per riga: memorizzate inline nella tupla. */
const INLINE_COLS = ['codice', 'desc_short', 'declaratoria', 'prezzo', 'importo_netto', 'ru'] as const
/** Colonne categoriali a bassa cardinalità: memorizzate come indice in `dict`. */
const DICT_COLS = ['um', 'liv1', 'liv2', 'liv3', 'liv4', 'materia', 'disciplina', 'sistema', 'attivita', 'settore', 'tipologia', 'keywords'] as const

type InlineCol = typeof INLINE_COLS[number]
type DictCol = typeof DICT_COLS[number]

// Scomposizioni: tupla numerica per componente, tipo come enum stabile.
const COMPONENTI_COLS = ['cod', 'tipo', 'qta', 'prezzo', 'um', 'desc'] as const
const TIPO_ENUM: AnalisiRigaTipo[] = ['manodopera', 'materiale', 'nolo', 'varie']

/** Impacchetta righe normalizzate in formato compatto e deduplicato. */
export function packPrezzario(meta: PrezzarioMeta, rows: PriceRow[]): PackedPrezzario {
  const dict: string[] = []
  const dictIndex = new Map<string, number>()
  const intern = (s: string): number => {
    let i = dictIndex.get(s)
    if (i === undefined) { i = dict.length; dict.push(s); dictIndex.set(s, i) }
    return i
  }

  const packed: (string | number)[][] = rows.map(r => {
    const tuple: (string | number)[] = []
    for (const c of INLINE_COLS) tuple.push(r[c as InlineCol])
    for (const c of DICT_COLS) tuple.push(intern(r[c as DictCol]))
    return tuple
  })

  // Scomposizioni per componenti: tuple minime. um/descrizione entrano
  // nella dict SOLO per i codici che non risolvono a una riga di questo stesso
  // catalogo (orfani): per gli altri i testi si ricavano a runtime dal join per
  // codice, senza duplicare 150k+ descrizioni nel pack.
  const codici = new Set(rows.map(r => r.codice))
  const byRow: Record<number, number[][]> = {}
  rows.forEach((r, i) => {
    if (!r.risorse?.length) return
    byRow[i] = r.risorse.map(c => {
      const orfano = !codici.has(c.codice)
      const tipo = TIPO_ENUM.indexOf(c.tipo)
      return [
        intern(c.codice),
        tipo >= 0 ? tipo : TIPO_ENUM.indexOf('varie'),
        c.quantita,
        c.prezzo,
        orfano && c.um ? intern(c.um) : -1,
        orfano && c.descrizione ? intern(c.descrizione) : -1,
      ]
    })
  })

  const out: PackedPrezzario = {
    schema: 1,
    meta: { ...meta, count: rows.length },
    inlineCols: [...INLINE_COLS],
    dictCols: [...DICT_COLS],
    dict,
    rows: packed,
  }
  if (Object.keys(byRow).length) out.componenti = { cols: [...COMPONENTI_COLS], byRow }
  return out
}

/** Ricostruisce le righe `PriceRow` da un prezzario impacchettato. */
export function unpackPrezzario(p: PackedPrezzario): { meta: PrezzarioMeta; rows: PriceRow[] } {
  const { inlineCols, dictCols, dict } = p
  const regione = p.meta.regione ?? ''
  const anno = p.meta.anno ?? ''
  const rows = p.rows.map(tuple => {
    const row = { regione, anno } as Record<string, unknown>
    let k = 0
    for (const c of inlineCols) row[c] = tuple[k++]
    for (const c of dictCols) row[c] = dict[tuple[k++] as number]
    return row as unknown as PriceRow
  })
  // Scomposizioni: riattacca `risorse` solo alle righe che le portano.
  if (p.componenti) unpackComponenti(p.componenti, dict, rows)
  return { meta: p.meta, rows }
}

/** Materializza le tuple `componenti` in `PriceRow.risorse` (solo righe presenti). */
function unpackComponenti(comp: PackedComponenti, dict: string[], rows: PriceRow[]): void {
  for (const key of Object.keys(comp.byRow)) {
    const r = rows[+key]
    if (!r) continue
    r.risorse = comp.byRow[+key]!.map(t => {
      const [cod, tipo, qta, prezzo, um, desc] = t as [number, number, number, number, number, number]
      const c: RisorsaComponente = {
        codice: dict[cod] ?? '',
        tipo: TIPO_ENUM[tipo] ?? 'varie',
        quantita: qta,
        prezzo,
      }
      if (um >= 0) c.um = dict[um]
      if (desc >= 0) c.descrizione = dict[desc]
      return c
    })
  }
}
