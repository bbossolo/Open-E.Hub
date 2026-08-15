/**
 * δ Pages — stato di progetto: costruzione vuota + deserializzazione robusta.
 * Puro (nessun DOM). I mutatori interattivi (aggiungi/sposta campo…) vivono in
 * main.js sull'oggetto stato di sessione; qui c'è solo ciò che va testato e
 * ciò che ripristina uno stato salvato nel Progetto .ehub in modo difensivo.
 */
import type { DeltaState, CoverField, Template, Elenco, Anchor, Align, FieldKind } from './types'

export function emptyState(): DeltaState {
  return { v: 1, template: null, fields: [], elenco: null }
}

function normFilenameColumn(raw: unknown, elenco: Elenco | null): string | undefined {
  const s = typeof raw === 'string' ? raw : ''
  if (!s || !elenco) return undefined
  return elenco.headers.includes(s) ? s : undefined
}

const ANCHORS: Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']
const ALIGNS: Align[] = ['left', 'center', 'right']

function clamp01(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0
}

export function normField(raw: unknown): CoverField | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kind: FieldKind = r.kind === 'variable' ? 'variable' : 'fixed'
  const anchor: Anchor = ANCHORS.includes(r.anchor as Anchor) ? (r.anchor as Anchor) : 'mc'
  const align: Align = ALIGNS.includes(r.align as Align) ? (r.align as Align) : 'center'
  const fontFrac = Number(r.fontFrac)
  const maxWidthFrac = Number(r.maxWidthFrac)
  const maxHeightFrac = Number(r.maxHeightFrac)
  return {
    id: String(r.id || `f${Math.random().toString(36).slice(2, 9)}`),
    kind,
    label: String(r.label || 'Campo'),
    x: clamp01(r.x),
    y: clamp01(r.y),
    anchor,
    align,
    fontFrac: Number.isFinite(fontFrac) && fontFrac > 0 ? Math.min(0.5, fontFrac) : 0.03,
    bold: !!r.bold,
    value: kind === 'fixed' ? String(r.value ?? '') : undefined,
    column: kind === 'variable' ? (r.column != null ? String(r.column) : undefined) : undefined,
    ...(kind === 'variable' && typeof r.expr === 'string' && r.expr ? { expr: r.expr } : {}),
    ...(Number.isFinite(maxWidthFrac) && maxWidthFrac > 0 ? { maxWidthFrac: Math.min(1, maxWidthFrac) } : {}),
    ...(Number.isFinite(maxHeightFrac) && maxHeightFrac > 0 ? { maxHeightFrac: Math.min(1, maxHeightFrac) } : {}),
  }
}

function normTemplate(raw: unknown): Template | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.dataUrl !== 'string' || !r.dataUrl) return null
  const w = Number(r.w), h = Number(r.h)
  if (!(w > 0) || !(h > 0)) return null
  const ptW = Number(r.ptW), ptH = Number(r.ptH)
  const out: Template = { dataUrl: r.dataUrl, w, h, kind: r.kind === 'pdf' ? 'pdf' : 'image', name: String(r.name || 'template') }
  if (ptW > 0 && ptH > 0) { out.ptW = ptW; out.ptH = ptH }
  if (typeof r.fontName === 'string' && r.fontName) out.fontName = r.fontName
  if (typeof r.fontRegularB64 === 'string' && r.fontRegularB64) out.fontRegularB64 = r.fontRegularB64
  if (typeof r.fontBoldB64 === 'string' && r.fontBoldB64) out.fontBoldB64 = r.fontBoldB64
  return out
}

function normElenco(raw: unknown): Elenco | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const headers = Array.isArray(r.headers) ? r.headers.map(String) : []
  const rows = Array.isArray(r.rows)
    ? r.rows.map((row) => {
        const o: Record<string, string> = {}
        if (row && typeof row === 'object') for (const [k, v] of Object.entries(row as object)) o[k] = String(v ?? '')
        return o
      })
    : []
  if (!headers.length) return null
  const sheetName = typeof r.sheetName === 'string' && r.sheetName ? r.sheetName : undefined
  let meta: Record<string, string> | undefined
  if (r.meta && typeof r.meta === 'object') {
    meta = {}
    for (const [k, v] of Object.entries(r.meta as object)) meta[k] = String(v ?? '')
  }
  return { headers, rows, fileName: String(r.fileName || 'elenco'), ...(sheetName ? { sheetName } : {}), ...(meta ? { meta } : {}) }
}

/** Deserializza uno stato salvato (JSON dal .ehub) in un DeltaState valido. */
export function parseState(json: string | object): DeltaState {
  let obj: unknown
  try { obj = typeof json === 'string' ? JSON.parse(json) : json } catch { return emptyState() }
  if (!obj || typeof obj !== 'object') return emptyState()
  const r = obj as Record<string, unknown>
  const elenco = normElenco(r.elenco)
  const filenameColumn = normFilenameColumn(r.filenameColumn, elenco)
  return {
    v: 1,
    template: normTemplate(r.template),
    fields: Array.isArray(r.fields) ? r.fields.map(normField).filter((f): f is CoverField => !!f) : [],
    elenco,
    ...(filenameColumn ? { filenameColumn } : {}),
  }
}
