/**
 * "Progetto Open E.Hub" — bundle dello stato dell'intero programma in un unico file
 * (.ehub, JSON). Raccoglie lo stato pieno di ciascun tool (es. il computo di μ)
 * raggiunto via il protocollo bus collect/restore.
 *
 * Parte pura/testabile: qui solo costruzione/validazione del contenitore; chi
 * raccoglie/applica gli stati è l'hub (vedi hub/main.js) e i singoli tool.
 */

import type { SharedPlan } from './bus'

export const EHUB_PROJECT_KIND = 'ehub-project'
export const EHUB_PROJECT_VERSION = 1

/** appId del registry → stato pieno serializzabile del tool. */
export type EhubToolStates = Record<string, unknown>

export interface EhubProject {
  kind: typeof EHUB_PROJECT_KIND
  v: number
  ts: number
  /** Etichetta opzionale mostrata all'utente. */
  name?: string
  tools: EhubToolStates
  /** Planimetria UNICA di Progetto (DXF condiviso) + cavidotti/circuiti cross-tool.
   *  Project-global, salvata una sola volta (non sotto `tools`). Additiva: i file
   *  legacy senza questo campo restano validi. */
  sharedPlan?: SharedPlan
}

/** Costruisce il contenitore del progetto Open E.Hub dagli stati raccolti dai tool. */
export function bundleEhubProject(tools: EhubToolStates, opts: { now?: number; name?: string; sharedPlan?: SharedPlan | null } = {}): EhubProject {
  const cleaned: EhubToolStates = {}
  for (const [appId, state] of Object.entries(tools || {})) {
    if (state != null) cleaned[appId] = state
  }
  const bundle: EhubProject = {
    kind: EHUB_PROJECT_KIND,
    v: EHUB_PROJECT_VERSION,
    ts: opts.now ?? Date.now(),
    tools: cleaned,
  }
  if (opts.name) bundle.name = opts.name
  // Solo se c'è qualcosa da salvare (sfondo o geometrie): niente campo vuoto sui
  // progetti senza planimetria condivisa. XREF: se il DXF ha un `ref` (percorso),
  // NON si incorporano i byte nel file (può pesare 50+ MB) — si salva il solo
  // riferimento e lo si ricarica dal disco all'apertura.
  const sp = opts.sharedPlan
  if (sp && (sp.dxf || (sp.cavidotti || []).length || (sp.circuiti || []).length)) {
    bundle.sharedPlan = { ...sp, dxf: dxfForDiskEhub(sp.dxf) }
  }
  return bundle
}

/** Nel .ehub va l'IDENTITÀ della planimetria (xref), mai i byte del DXF. */
function dxfForDiskEhub(dxf: SharedPlan['dxf']): SharedPlan['dxf'] {
  if (!dxf) return dxf ?? null
  const { missing, ...rest } = dxf; void missing // stato di sessione, non si salva
  return rest
}

/** Numero di tool con stato nel progetto. */
export function ehubProjectToolCount(p: EhubProject): number {
  return Object.keys(p.tools || {}).length
}

/**
 * Valida e normalizza un progetto Open E.Hub (oggetto già parsato o stringa JSON).
 * Lancia su contenuto non valido. Accetta `kind` mancante per tolleranza verso
 * file scritti a mano, purché contengano `tools`.
 */
export function parseEhubProject(input: string | unknown): EhubProject {
  let obj: unknown
  if (typeof input === 'string') {
    try { obj = JSON.parse(input) } catch { throw new Error('File progetto non valido (JSON malformato)') }
  } else {
    obj = input
  }
  if (!obj || typeof obj !== 'object') throw new Error('File progetto non valido')
  const o = obj as Record<string, unknown>
  if (o.kind != null && o.kind !== EHUB_PROJECT_KIND) throw new Error('Non è un progetto Open E.Hub')
  if (!o.tools || typeof o.tools !== 'object') throw new Error('Progetto Open E.Hub privo di stati dei tool')
  const tools: EhubToolStates = {}
  for (const [appId, state] of Object.entries(o.tools as Record<string, unknown>)) {
    if (state != null) tools[appId] = state
  }
  return {
    kind: EHUB_PROJECT_KIND,
    v: typeof o.v === 'number' ? o.v : EHUB_PROJECT_VERSION,
    ts: typeof o.ts === 'number' ? o.ts : Date.now(),
    ...(typeof o.name === 'string' ? { name: o.name } : {}),
    tools,
    ...(o.sharedPlan && typeof o.sharedPlan === 'object' ? { sharedPlan: normalizeEhubSharedPlan(o.sharedPlan) } : {}),
  }
}

/** Normalizza la planimetria condivisa dentro un .ehub (difensivo, tollerante).
 *  Accetta sia l'XREF (`ref`, senza byte) sia l'embed web (`text`). */
function normalizeEhubSharedPlan(raw: unknown): SharedPlan {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  let dxf: SharedPlan['dxf'] = null
  if (o.dxf && typeof o.dxf === 'object') {
    const d = o.dxf as Record<string, unknown>
    // I .ehub salvati con le versioni vecchie potevano portarsi dentro il DXF grezzo
    // (campo `text`): si scarta. Della planimetria resta l'identità.
    const hasRef = typeof d.ref === 'string' && d.ref
    const hasName = typeof d.name === 'string' && d.name
    if (hasRef || hasName) {
      dxf = { name: hasName ? d.name as string : '', ts: typeof d.ts === 'number' ? d.ts : 0 }
      if (hasRef) dxf.ref = d.ref as string
      if (typeof d.size === 'number') dxf.size = d.size
    }
  }
  return {
    dxf,
    cavidotti: Array.isArray(o.cavidotti) ? o.cavidotti as SharedPlan['cavidotti'] : [],
    circuiti: Array.isArray(o.circuiti) ? o.circuiti as SharedPlan['circuiti'] : [],
  }
}
