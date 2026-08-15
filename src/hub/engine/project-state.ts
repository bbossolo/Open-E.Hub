/**
 * PROGETTO E.HUB A ISTANZA UNICA. PURO, NESSUN DOM.
 *
 * L'hub possiede UN solo «progetto corrente»: identità (`id`/`name`) + lo stato di progetto
 * DERIVATO/condiviso di ogni tool, come MAPPA GENERICA per `appId` (niente più campi hard-coded
 * `phiProject`/`pricelistComputo`/`tauComputo`; inclusi `pi`/`lambda` e qualsiasi tool del
 * registry). Questo modulo è il reducer puro di quello stato: l'hub (`main.js`) lo usa come unica
 * fonte di verità, così lo stato non si frammenta in più istanze incoerenti.
 *
 * Il `source` semantico del relay `hub:project-state` (per cui i tool consumatori filtrano)
 * è derivato dall'appId via una MAPPA DI CONFIGURAZIONE, non da rami di controllo per-tool:
 * aggiungere un tool non richiede nuovi `if`.
 */

import type { SharedPlan, SharedGeom } from '../../shared/bus'

/** Stato del progetto Open E.Hub corrente: identità + stato per-appId (generico). */
export interface HubProjectState {
  /** identità stabile del progetto corrente (null finché non aperto/salvato). */
  id: string | null
  /** nome del progetto (es. dal file .ehub); null se senza nome. */
  name: string | null
  /** stato di progetto condiviso per appId (payload relayati cross-tool). */
  tools: Record<string, unknown>
  /** planimetria UNICA di Progetto (DXF grezzo condiviso) + cavidotti/circuiti
   *  cross-tool (unione per origine). Project-global, non per-tool. */
  sharedPlan: SharedPlan
}

/** Planimetria condivisa vuota. */
export function emptySharedPlan(): SharedPlan {
  return { dxf: null, cavidotti: [], circuiti: [], scale: null }
}

/**
 * Etichetta `source` del relay per appId — MAPPA DI CONFIGURAZIONE (non rami di controllo).
 * I tool consumatori storici filtrano per queste etichette; i nuovi tool usano l'appId stesso.
 */
export const SOURCE_BY_APP: Record<string, string> = {
  // Solo i tool il cui `source` storico differisce dall'appId: senza voce qui,
  // sourceForApp() ripiega sull'appId stesso.
  'miu-price-list': 'pricelist',
}

/** `source` del relay per un appId (default: l'appId stesso, nessun hard-code di controllo). */
export function sourceForApp(appId: string): string {
  return SOURCE_BY_APP[appId] || appId
}

/** Stato di progetto vuoto. */
export function emptyHubProjectState(): HubProjectState {
  return { id: null, name: null, tools: {}, sharedPlan: emptySharedPlan() }
}

/**
 * Normalizza il riferimento alla planimetria condivisa. null se non c'è nessuna sorgente.
 *
 * Qui vive solo l'IDENTITÀ del DXF (percorso, nome, data, dimensione): i byte del file non
 * passano né da qui né dal bus. I progetti salvati con la vecchia versione potevano
 * portarsi dietro un campo `text` col DXF grezzo: si scarta senza far storie.
 */
export function normalizeSharedDxf(raw: unknown): SharedPlan['dxf'] {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const hasRef = typeof d.ref === 'string' && d.ref
  const hasName = typeof d.name === 'string' && d.name
  if (!hasRef && !hasName) return null // niente sorgente → nessuno sfondo
  const dxf: NonNullable<SharedPlan['dxf']> = { name: hasName ? d.name as string : '', ts: typeof d.ts === 'number' ? d.ts : 0 }
  if (hasRef) dxf.ref = d.ref as string
  if (typeof d.size === 'number') dxf.size = d.size
  return dxf
}

/** Normalizza una planimetria condivisa (da input eterogeneo/legacy). */
export function normalizeSharedPlan(raw: unknown): SharedPlan {
  const p = emptySharedPlan()
  if (!raw || typeof raw !== 'object') return p
  const o = raw as Record<string, unknown>
  p.dxf = normalizeSharedDxf(o.dxf)
  if (Array.isArray(o.cavidotti)) p.cavidotti = o.cavidotti as SharedGeom[]
  if (Array.isArray(o.circuiti)) p.circuiti = o.circuiti as SharedGeom[]
  if (typeof o.scale === 'number' && o.scale > 0) p.scale = o.scale
  return p
}

/** Il DXF come va su disco: la sua identità (xref), mai i byte. Che è ormai tutto quello
 *  che il modello contiene — resta come punto unico se un domani si aggiungessero campi
 *  volatili da non persistere. */
export function dxfForDisk(dxf: SharedPlan['dxf']): SharedPlan['dxf'] {
  if (!dxf) return null
  const { missing, ...rest } = dxf; void missing // stato di sessione, non si salva
  return rest
}

/**
 * Migra un oggetto salvato (localStorage) al nuovo shape. Riconosce sia il NUOVO shape
 * (`{id,name,tools}`) sia il VECCHIO hard-coded (`{phiProject,pricelistComputo,tauComputo}`),
 * così l'aggiornamento non perde lo stato già persistito. Input non valido → stato vuoto.
 */
export function migrateHubState(saved: unknown): HubProjectState {
  const st = emptyHubProjectState()
  if (!saved || typeof saved !== 'object') return st
  const o = saved as Record<string, unknown>
  if (o.tools && typeof o.tools === 'object') {
    st.tools = { ...(o.tools as Record<string, unknown>) }
    st.id = typeof o.id === 'string' ? o.id : null
    st.name = typeof o.name === 'string' ? o.name : null
    st.sharedPlan = normalizeSharedPlan(o.sharedPlan) // default vuoto se assente (legacy)
    return st
  }
  // legacy: i campi hard-coded delle prime versioni → mappa per appId.
  if (o.pricelistComputo) st.tools['miu-price-list'] = o.pricelistComputo
  if (o.tauComputo) st.tools['tau-documenti'] = o.tauComputo
  return st
}

/**
 * Aggiorna lo stato di progetto di UN appId (generico, nessun ramo per-tool). `project` nullo
 * rimuove la voce. Ritorna un NUOVO stato (immutabile, non muta l'input).
 */
export function setToolProject(st: HubProjectState, appId: string, project: unknown): HubProjectState {
  const id = (appId || '').trim()
  if (!id) return st
  const tools = { ...st.tools }
  if (project == null) delete tools[id]
  else tools[id] = project
  return { ...st, tools }
}

/** Messaggio di relay `hub:project-state` per un appId (source derivato dalla mappa). */
export interface ProjectStateMessage {
  type: 'hub:project-state'
  source: string
  project: unknown
  appId: string
  /**
   * REPLAY = ri-trasmissione dello stato già noto (caricamento tool / `app:request-state`),
   * NON una nuova azione dell'utente. I tool consumatori usano questo flag per NON applicare in
   * automatico (clobber) ciò che è solo un replay: ingeriscono on-demand. Un push FRESCO (relay di
   * un `app:project-update`) non porta questo flag.
   */
  replay: true
}

/**
 * Messaggi `hub:project-state` per REPLICARE lo stato corrente a un frame (uno per ogni tool con
 * stato presente). Usato al caricamento di un tool e in risposta a `app:request-state`: sono tutti
 * REPLAY (`replay:true`), così i consumatori non li scambiano per nuove azioni utente.
 */
export function projectStateMessages(st: HubProjectState): ProjectStateMessage[] {
  return Object.keys(st.tools).map(appId => ({
    type: 'hub:project-state',
    source: sourceForApp(appId),
    project: st.tools[appId],
    appId,
    replay: true,
  }))
}

/** Imposta lo SFONDO DXF grezzo condiviso (project-global). Immutabile. */
export function setSharedDxf(st: HubProjectState, dxf: SharedPlan['dxf']): HubProjectState {
  return { ...st, sharedPlan: { ...st.sharedPlan, dxf: dxf || null } }
}

/** UPSERT per id + rimozione degli id in `deleted`. Mantiene l'ordine (gli id
 *  esistenti restano al loro posto, i nuovi in coda). MAI cancella su omissione. */
function upsertList(list: SharedGeom[], upserts?: SharedGeom[], deleted?: string[]): SharedGeom[] {
  const byId = new Map<string, SharedGeom>((list || []).map(g => [g.id, g]))
  for (const g of upserts || []) if (g && g.id) byId.set(g.id, g)
  for (const id of deleted || []) byId.delete(id)
  return [...byId.values()]
}

/**
 * POOL UNICO: applica UPSERT (per id) e DELETE al pool condiviso di cavidotti/
 * circuiti. Un update parziale NON azzera il resto (niente clobber). Immutabile.
 */
export function upsertShared(
  st: HubProjectState,
  data: { cavidotti?: SharedGeom[]; circuiti?: SharedGeom[]; scale?: number | null; deleted?: { cavidotti?: string[]; circuiti?: string[] } },
): HubProjectState {
  const sp = st.sharedPlan
  const delC = data.deleted && data.deleted.cavidotti
  const delK = data.deleted && data.deleted.circuiti
  // scala CALIBRATA, UNICA per l'intera planimetria condivisa (i tool di disegno
  // condividono lo spazio DXF): chi calibra per ultimo la pubblica, vale per tutti. Un valore
  // assente/non valido non tocca quella già nota (niente clobber, come il DXF).
  const scale = (typeof data.scale === 'number' && data.scale > 0) ? data.scale : sp.scale
  return {
    ...st,
    sharedPlan: {
      ...sp,
      cavidotti: (data.cavidotti || delC) ? upsertList(sp.cavidotti, data.cavidotti, delC) : sp.cavidotti,
      circuiti: (data.circuiti || delK) ? upsertList(sp.circuiti, data.circuiti, delK) : sp.circuiti,
      scale,
    },
  }
}

/** Messaggio di replay della planimetria condivisa (uno solo, project-global). */
export interface SharedPlanMessage {
  type: 'hub:shared-plan'
  plan: SharedPlan
  replay: true
}

/** Messaggio `hub:shared-plan` per replicare la planimetria condivisa a un frame. */
export function sharedPlanMessage(st: HubProjectState): SharedPlanMessage {
  return { type: 'hub:shared-plan', plan: st.sharedPlan, replay: true }
}

/** Garantisce un id stabile al progetto (lo genera con `gen` se mancante). Immutabile. */
export function ensureProjectId(st: HubProjectState, gen: () => string): HubProjectState {
  return st.id ? st : { ...st, id: gen() }
}

/** Identità del progetto corrente (id+name), senza toccare i tool. Immutabile. */
export function setProjectIdentity(st: HubProjectState, id: string | null, name: string | null): HubProjectState {
  return { ...st, id, name }
}
