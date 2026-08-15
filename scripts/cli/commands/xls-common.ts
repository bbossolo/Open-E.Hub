/**
 * Lettura .xls/.xlsx/.csv condivisa dei comandi CLI: file → griglia `unknown[][]`
 * (header:1), stesso criterio di `readAmpereMatrix` (scripts/ampere-dxf.ts) —
 * buffer via node:fs + `XLSX.read` (la build ESM di `xlsx` non registra `fs`).
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { CliError } from '../types'

/** Legge un workbook e ritorna la griglia del foglio scelto (default: primo). */
export function leggiGriglia(path: string, foglio?: string): unknown[][] {
  const wb = leggiWorkbook(path)
  const nome = foglio ?? wb.SheetNames[0]
  const ws = nome ? wb.Sheets[nome] : undefined
  if (!ws) throw new CliError(`Foglio "${foglio}" non trovato in ${path}. Fogli disponibili: ${wb.SheetNames.join(', ')}`)
  return grigliaDiFoglio(ws)
}

export function leggiWorkbook(path: string): XLSX.WorkBook {
  return XLSX.read(readFileSync(path), { type: 'buffer' })
}

export function grigliaDiFoglio(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]
}
