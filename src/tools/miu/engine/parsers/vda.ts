/**
 * Parser per il **Prezzario Valle d'Aosta** (pubblico, XLSX — 3 capitoli:
 * Impianti Elettrici / Impianti Meccanici / Opere Edili Elementari Compiute).
 *
 * Colonne: codice · descrizione · um · prezzo · %MdO. La voce ha SEMPRE
 * descrizione+codice su una riga e um+prezzo sulla riga seguente (a volte
 * sulla stessa riga) — la profondità dei codici puntati (P60.A01.001,
 * M00.A00.001, N42.R60.000.032…) NON è fissa tra i 3 capitoli, quindi la
 * gerarchia si ricostruisce con uno stack per numero di punti nel codice
 * (livello 0 = capitolo, via via più profondo) invece di contare i punti
 * a priori come DEI/Basilicata.
 */
import { composeDesc } from '../descriptions'
import type { ParseResult, PriceRow } from '../types'

const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

/** "1.234,56" / "1234.56" → numero (formato IT o punto decimale). */
function parsePrezzo(s: unknown): number {
  let t = clean(s).replace(/€/g, '').replace(/\s/g, '')
  if (!t) return 0
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.')
  else if (t.includes(',')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return isFinite(n) ? n : 0
}
const parsePct = (s: unknown): number => {
  const n = parseFloat(clean(s).replace('%', '').replace(',', '.'))
  return isFinite(n) ? n : 0
}

const numDots = (codice: string): number => (codice.match(/\./g) ?? []).length

/** Vero se `codice` ha la forma di un vero codice di voce/capitolo VdA (lettere, cifre,
 *  punti — es. "S01", "M00.A00.001", "P60.A01.001"). Alcune righe-nota portano
 *  pseudo-codici come "NOTE:" nella colonna codice: non sono codici reali e, se trattati
 *  come tali, sovrascriverebbero il capitolo vero a profondità 0 (bug osservato). */
const isRealCode = (codice: string): boolean => /^[A-Za-z0-9.]+$/.test(codice)

/** Vero se `s` è scritta perlopiù in MAIUSCOLO — stile dei titoli di capitolo/sezione
 *  reali nel grezzo VdA (es. "ACQUEDOTTI E FOGNATURE", "OPERE IN PIETRA"), a differenza
 *  delle note/premesse metodologiche e delle "descrizioni madre" di un gruppo di
 *  varianti, sempre in prosa a case mista (es. "Le eventuali Variazioni dei Prezzi…",
 *  "Fornitura e posa in opera di…"). */
function isAllCapsHeading(s: string): boolean {
  const lettere = s.replace(/[^a-zà-ùA-ZÀ-Ù]/g, '')
  if (lettere.length < 3) return false
  const maiuscole = lettere.replace(/[^A-ZÀ-Ù]/g, '')
  return maiuscole.length / lettere.length > 0.8
}

/**
 * @param grid righe del foglio dati, colonne [0]codice [1]descrizione [2]um [3]prezzo [4]%MdO
 * @param fallback regione/anno di default (il file non li porta nel grezzo)
 */
export function parseVda(grid: unknown[][], fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const regione = fallback.regione ?? "Valle d'Aosta"
  const anno = fallback.anno ?? null
  const rows: PriceRow[] = []
  // stack titoli per profondità (indice = n. di punti nel codice del titolo)
  const titoli: string[] = []
  // profondità dell'ultimo titolo con codice REALE (capitolo/sezione numerati).
  let lastCodedDepth = -1

  let i = 0
  while (i < grid.length) {
    const row = grid[i]
    const codice = clean(row[0])
    const desc = clean(row[1])
    if (!codice && !desc) { i++; continue }
    // riga di intestazione colonne (a volte con l'header prezzo "2026" che
    // parserebbe come numero valido): mai un codice reale, sempre "codice".
    if (/^cod(ice)?\.?$/i.test(codice)) { i++; continue }

    const umHere = clean(row[2])
    const prezzoHere = parsePrezzo(row[3])
    if (umHere || prezzoHere > 0) {
      emit(codice, desc, umHere, prezzoHere, parsePct(row[4]))
      i++
      continue
    }

    const next = grid[i + 1]
    const nextCodice = next ? clean(next[0]) : ''
    const nextDesc = next ? clean(next[1]) : ''
    if (next && !nextCodice && !nextDesc) {
      const nextUm = clean(next[2])
      const nextPrezzo = parsePrezzo(next[3])
      if (nextUm || nextPrezzo > 0) {
        emit(codice, desc, nextUm, nextPrezzo, parsePct(next[4]))
        i += 2
        continue
      }
    }

    // riga-titolo (capitolo/sezione/sotto-sezione), o riga senza codice: solo se è
    // scritta in MAIUSCOLO (vero stile dei titoli reali) e non troppo lunga entra
    // nello stack, e MAI a profondità 0 — altrimenti sovrascriverebbe il capitolo vero
    // per tutte le righe successive (bug: la vista Capitoli mostrava note/premesse
    // metodologiche e "descrizioni madre" di varianti come falsi capitoli, invece delle
    // 3-4 sezioni reali). Prosa a case mista (note, premesse, descrizioni madre — anche
    // se >200 char composeDesc le scarterebbe comunque come contesto, vedi isNoisyParent
    // in descriptions.ts) viene ignorata senza toccare lo stack.
    if (codice && isRealCode(codice)) {
      const depth = numDots(codice)
      titoli[depth] = desc
      titoli.length = depth + 1
      lastCodedDepth = depth
    } else if (desc && desc.length <= 200 && isAllCapsHeading(desc)) {
      const depth = lastCodedDepth + 1
      titoli[depth] = desc
      titoli.length = depth + 1
    }
    i++
  }

  function emit(codice: string, desc: string, um: string, prezzo: number, mdo: number): void {
    if (!codice || prezzo <= 0) return
    const ctx = titoli.filter(Boolean)
    const sintetica = composeDesc(ctx, desc) || desc || codice
    rows.push({
      codice,
      declaratoria: sintetica,
      desc_short: desc || codice,
      um,
      prezzo,
      importo_netto: 0,
      ru: mdo,
      liv1: ctx[0] ?? '', liv2: ctx[1] ?? '', liv3: ctx[2] ?? '', liv4: ctx[3] ?? '',
      materia: '', disciplina: ctx[0] ?? '', sistema: ctx[1] ?? '', attivita: '', settore: ctx[2] ?? '',
      keywords: '', tipologia: '',
      regione, anno: anno ?? '',
    })
  }

  return { rows, regione, anno }
}
