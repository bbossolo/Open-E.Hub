/**
 * Export EXCEL del COMPUTO METRICO di μ Prezzi — foglio unico con le voci del
 * carrello (codice, descrizione, categoria, U.M., quantità, prezzo unitario,
 * importo) + il totale. Formato generico (SheetJS), nessun template esterno
 * da rispettare: parte pura (matrice AOA, testabile); la UI assembla il
 * foglio vero con `XLSX.utils.aoa_to_sheet` + `XLSX.writeFile`, stesso
 * pattern di `analisi-prezzi-excel.ts`.
 */
import type { AoaRow } from './analisi-prezzi-excel'

export interface ComputoExcelRiga {
  codice: string
  descrizione: string
  categoria?: string
  um: string
  quantita: number
  prezzoUnitario: number
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const INTESTAZIONE_COLONNE: AoaRow = ['Codice', 'Descrizione', 'Categoria', 'U.M.', 'Quantità', 'Prezzo unitario', 'Importo']

/** Matrice AOA del computo: intestazione, una riga per voce, totale finale. */
export function computoMetricoAOA(righe: ComputoExcelRiga[]): AoaRow[] {
  const rows: AoaRow[] = [
    ['COMPUTO METRICO'],
    ['Voci', righe.length],
    [],
    INTESTAZIONE_COLONNE,
  ]
  let totale = 0
  for (const r of righe) {
    const importo = round2((r.quantita || 0) * (r.prezzoUnitario || 0))
    totale += importo
    rows.push([r.codice, r.descrizione, r.categoria || '', r.um, r.quantita || 0, round2(r.prezzoUnitario || 0), importo])
  }
  rows.push([])
  rows.push(['', '', '', '', '', 'Totale computo', round2(totale)])
  return rows
}

/** Nome file suggerito per l'export, con data ISO per non sovrascrivere export precedenti. */
export function computoMetricoFileName(date: Date = new Date()): string {
  return `computo-metrico-${date.toISOString().slice(0, 10)}.xlsx`
}
