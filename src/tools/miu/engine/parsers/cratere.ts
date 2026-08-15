/**
 * Parser per il **Prezzario Unico Cratere Centro Italia 2026** (PUC) — un unico
 * prezzario pubblico per Abruzzo, Lazio, Marche e Umbria, esportato in CSV (";").
 *
 * Colonne (per nome, robusto all'ordine/BOM):
 *   Codice · Parte · Capitolo · Sezione · Descrizione completa · Descrizione base ·
 *   Descrizione variante · UM · Prezzo · Prezzo numerico · %AT · %PR · %RU · …
 *
 * La "Descrizione completa" è già self-contained; in fallback si compone dalla
 * gerarchia Parte/Capitolo/Sezione. Opera su un array 2D (il read del CSV è nel build).
 */
import { composeDesc, isSelfContained } from '../descriptions'
import type { ParseResult, PriceRow } from '../types'

const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

/** "6,25" / "1.234,56" → numero. */
function parseNum(s: unknown): number {
  let t = clean(s).replace(/€/g, '').replace(/\s/g, '')
  if (!t) return 0
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(',', '.')
  const n = parseFloat(t)
  return isFinite(n) ? n : 0
}
const normH = (s: unknown): string => clean(s).toLowerCase().replace(/^﻿/, '').replace(/%/g, '%')

export function parseCratere(grid: unknown[][], fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const regione = fallback.regione ?? 'Cratere Centro Italia'
  const anno = fallback.anno ?? '2026'
  if (!grid.length) return { rows: [], regione, anno }

  const head = grid[0].map(normH)
  const col = (name: string) => head.indexOf(name)
  const ci = {
    cod: col('codice'), parte: col('parte'), cap: col('capitolo'), sez: col('sezione'),
    desc: col('descrizione completa'), base: col('descrizione base'), variante: col('descrizione variante'),
    um: col('um'), prezzo: col('prezzo numerico'), ru: col('%ru'),
  }
  const at = (r: unknown[], i: number) => (i >= 0 ? clean(r[i]) : '')

  const rows: PriceRow[] = []
  for (let k = 1; k < grid.length; k++) {
    const r = grid[k]
    const codice = at(r, ci.cod)
    if (!codice) continue
    const prezzo = parseNum(r[ci.prezzo])
    if (!(prezzo > 0)) continue

    const parte = at(r, ci.parte), cap = at(r, ci.cap), sez = at(r, ci.sez)
    const completa = at(r, ci.desc)
    const leaf = completa || [at(r, ci.base), at(r, ci.variante)].filter(Boolean).join(' — ')
    const desc_short = isSelfContained(leaf) ? leaf : (composeDesc([parte, cap, sez], leaf) || leaf || codice)

    rows.push({
      codice,
      declaratoria: completa || desc_short,
      desc_short,
      um: at(r, ci.um),
      prezzo,
      importo_netto: 0,
      ru: parseNum(r[ci.ru]),
      liv1: parte, liv2: cap, liv3: sez, liv4: '',
      materia: '', disciplina: parte, sistema: cap, attivita: '', settore: sez,
      keywords: '', tipologia: '',
      regione, anno,
    })
  }
  return { rows, regione, anno }
}
