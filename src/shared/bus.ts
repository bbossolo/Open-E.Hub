/**
 * Bus di messaggi hub↔tool (postMessage) — contratto tipizzato.
 * Estratto fedelmente dal comportamento dei monoliti (vedi Docs/01 §7): i tipi
 * e la semantica NON cambiano, così l'hub continua a parlare con i tool invariato.
 *
 * La validazione dei messaggi in ingresso (`parseHubMessage`) è pura e testabile
 * senza DOM; `sendToHub`/`onHubMessage` sono glue sottile su window.
 */
export type Theme = 'light' | 'dark'

/**
 * Palette nominate note. Dimensione ORTOGONALE a `Theme` (light/dark):
 * `theme` resta il "modo", `palette` è la famiglia di colori. Single source of
 * truth condivisa da hub, token CSS e validazione bus.
 */
export const PALETTES = ['ardesia', 'carbonio', 'pergamena', 'notturno', 'inchiostro'] as const
export type Palette = (typeof PALETTES)[number]
export const DEFAULT_PALETTE: Palette = 'inchiostro'

/** True se `p` è una palette nota (type guard). */
export function isPalette(p: unknown): p is Palette {
  return typeof p === 'string' && (PALETTES as readonly string[]).includes(p)
}

/**
 * Font di sistema. Dimensione ORTOGONALE a tema/palette:
 * JetBrains Mono resta il default (copre anche il greco per i vecchi fallback
 * testuali), le altre 5 sono alternative "mood" open source, solo latino — i
 * nomi dei tool sono comunque glifi vettoriali SVG (vedi shared/ui/glyphs.ts),
 * quindi il cambio font non li tocca.
 */
export const FONTS = ['jetbrains-mono', 'cormorant', 'sistema', 'pixelify', 'fredoka'] as const
export type FontChoice = (typeof FONTS)[number]
export const DEFAULT_FONT: FontChoice = 'jetbrains-mono'

/** True se `f` è un font noto (type guard). */
export function isFont(f: unknown): f is FontChoice {
  return typeof f === 'string' && (FONTS as readonly string[]).includes(f)
}

/**
 * Dimensione testo. Dimensione ORTOGONALE a tema/palette/font:
 * moltiplica --ui-scale in tokens.css, da cui derivano tutti i --fs-* — "md" (100%)
 * è il default invariato.
 */
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export const DEFAULT_TEXT_SIZE: TextSize = 'md'

/** True se `s` è una dimensione testo nota (type guard). */
export function isTextSize(s: unknown): s is TextSize {
  return typeof s === 'string' && (TEXT_SIZES as readonly string[]).includes(s)
}

/**
 * Riduci animazioni. Dimensione ORTOGONALE alle altre: azzera
 * --tr/--tr-slow (usati da una parte reale delle transizioni della suite, non
 * tutte — vedi tokens.css) + una regola ombrello su animation/transition-duration.
 */
export const MOTION_MODES = ['normal', 'reduced'] as const
export type MotionMode = (typeof MOTION_MODES)[number]
export const DEFAULT_MOTION: MotionMode = 'normal'

/** True se `m` è un modo movimento noto (type guard). */
export function isMotionMode(m: unknown): m is MotionMode {
  return typeof m === 'string' && (MOTION_MODES as readonly string[]).includes(m)
}

/**
 * Intensità ombre. Dimensione ORTOGONALE alle altre:
 * moltiplica l'alpha di --shadow-1/2/3 via color-mix — copertura reale parziale
 * (circa metà dei box-shadow della suite usa i token, il resto è rgba() letterale).
 */
export const SHADOW_INTENSITIES = ['flat', 'soft', 'normal', 'deep'] as const
export type ShadowIntensity = (typeof SHADOW_INTENSITIES)[number]
export const DEFAULT_SHADOW: ShadowIntensity = 'normal'

/** True se `s` è un'intensità ombre nota (type guard). */
export function isShadowIntensity(s: unknown): s is ShadowIntensity {
  return typeof s === 'string' && (SHADOW_INTENSITIES as readonly string[]).includes(s)
}

/**
 * Intestazione dello STUDIO (azienda cliente di Open E.Hub) propagata ai tool
 * per le stampe: ragione sociale + indirizzo + HTML del logo (immagine o template).
 * Shape piatta, coincide con `DocCompany` di shared/doc (i documenti la accettano
 * così com'è). `null` = nessuna azienda (profilo admin → comportamento normale).
 */
export interface CompanyBrand {
  name: string
  address?: string
  logoHtml?: string
}

/**
 * Planimetria UNICA di Progetto (project-global, gestita dall'hub) + geometrie
 * condivise cross-tool. Lo SFONDO è il DXF GREZZO (ogni tool lo ri-parsa col
 * proprio filtro via `dxfToVectorBg`); cavidotti e circuiti sono l'UNIONE per
 * ORIGINE (ogni tool possiede e pubblica solo i propri; gli altri li vede come
 * «riferimento»). Additivo: i `.ehub` legacy senza questo campo restano validi.
 */
export interface SharedGeom {
  /** id univoco, prefissato per origine (es. 'gamma:CC01'). */
  id: string
  /** appId del tool che possiede la geometria. */
  origin: string
  /** polilinea in coordinate DXF (stesso spazio di `dxfToVectorBg`). */
  pts: { x: number; y: number }[]
  label?: string
  kind?: string
  /** dato tool-specifico opaco (per una futura ri-adozione ricca). */
  payload?: unknown
}

/**
 * Identità di POOL di un oggetto locale (cavidotto/circuito) che possiede o adotta
 * una geometria condivisa: se porta un `sharedId` esplicito (adottato da un altro
 * tool) lo usa, altrimenti lo calcola dal proprio id LOCALE prefissato con l'origine
 * (nativo — mai ancora scambiato). Va usata SIA per pubblicare (mai un id locale
 * nudo) SIA per fare il match in arrivo (mai un confronto sul campo grezzo, quasi
 * sempre assente sugli oggetti nativi): un disallineamento tra le due rompe
 * silenziosamente l'associazione cross-tool (successo con due tool che
 * condividono un cavidotto: chi lo disegna non ne portava il `sharedId`).
 */
export function sharedIdOf(obj: { id: string; sharedId?: string }, origin: string): string {
  return obj.sharedId || `${origin}:${obj.id}`
}
/**
 * Sfondo DXF condiviso. Modello XREF: qui viaggia SOLO L'IDENTITÀ della planimetria
 * (`ref` = percorso assoluto, come un xref CAD, più nome/data/dimensione), MAI i byte.
 *
 * Prima c'era anche un campo `text` col DXF grezzo: l'hub lo teneva in cache e lo
 * rimandava a ogni tool, che se lo riparsava. Sulle tavole vere dello studio (240 MB)
 * significa una copia da 240 MB per tool attraverso `postMessage`. Non era lento: era
 * impossibile. Ora chi importa un file lo legge da sé, in locale, e sul canale annuncia
 * soltanto QUALE planimetria è attiva — gli altri tool sanno di quale progetto si parla
 * e possono, se vogliono, aprirla dal `ref`.
 */
export interface SharedDxf {
  /** percorso assoluto del file DXF (xref); assente nel fallback web (nessun percorso). */
  ref?: string
  name: string
  ts: number
  /** dimensione in byte (info/identità). */
  size?: number
  /** true = il `ref` non è più al suo posto (file spostato/cancellato) → banner «Reimporta». */
  missing?: boolean
}
export interface SharedPlan {
  /** SORGENTE DXF condivisa (xref o embed), o null se nessuna. */
  dxf?: SharedDxf | null
  /** condotti/cavidotti, unione cross-tool per origine. */
  cavidotti: SharedGeom[]
  /** loop/circuiti routati, unione cross-tool per origine. */
  circuiti: SharedGeom[]
  /** Scala calibrata (unità DXF condivise per metro), UNICA per l'intera planimetria:
   *  i tool di disegno condividono lo spazio coordinate DXF, quindi la calibrazione fatta
   *  in un tool (2 punti + distanza reale) deve valere anche nell'altro — chi calibra
   *  per ultimo pubblica, gli altri adottano. null = non ancora calibrata. */
  scale?: number | null
}

/** Messaggi dall'hub verso il tool. */
export type HubToTool =
  /** Push esplicito del tema dal picker dell'hub (il tema resta per-tool, con override locale). */
  | { type: 'hub:set-theme'; theme: Theme; palette?: Palette }
  /** Palette di suite (ORTOGONALE al tema): propagata sempre a tutti i tool. Il
   *  tema (light/dark) resta invece per-tool con override locale; `hub:set-theme`
   *  è solo il push esplicito del picker dell'hub. */
  | { type: 'hub:set-palette'; palette: Palette }
  /** Font di suite (ORTOGONALE a tema/palette): propagato sempre a tutti i tool. */
  | { type: 'hub:set-font'; font: FontChoice }
  /** Dimensione testo di suite (ORTOGONALE alle altre): propagata sempre a tutti i tool.
   *  `size` = preset più vicino (back-compat / anti-flash); `scale` = valore CONTINUO
   *  del moltiplicatore --ui-scale, pilotato dallo slider. */
  | { type: 'hub:set-text-size'; size: TextSize; scale?: number }
  /** Riduci animazioni (ORTOGONALE alle altre): propagato sempre a tutti i tool. */
  | { type: 'hub:set-motion'; motion: MotionMode }
  /** Intensità ombre (ORTOGONALE alle altre): propagata sempre a tutti i tool. */
  | { type: 'hub:set-shadow'; shadow: ShadowIntensity }
  /** Risposta a `app:request-state`: lo stato pubblicato da un altro tool (es. il computo di μ letto da β). */
  | { type: 'hub:project-state'; source: string; project: unknown }
  /** "Progetto Open E.Hub": l'hub chiede al tool il suo stato pieno serializzabile. */
  | { type: 'hub:collect-state' }
  /** "Progetto Open E.Hub": l'hub chiede al tool di ripristinare uno stato salvato. */
  | { type: 'hub:restore-state'; appId?: string; state: unknown }
  /** Intestazione azienda per le stampe (null = nessuna, es. admin). */
  | { type: 'hub:set-company'; company: CompanyBrand | null }
  /** Planimetria unica di Progetto + geometrie condivise, relayata a tutti i tool.
   *  `deleted` (quando presente) sono gli id appena rimossi dal pool: i tool li
   *  tolgono anche se nativi (delete cross-tool). */
  | { type: 'hub:shared-plan'; plan: SharedPlan; replay?: boolean; deleted?: { cavidotti?: string[]; circuiti?: string[] } }

/** Messaggi dal tool verso l'hub. */
export type ToolToHub =
  /** Il tool ha finito di caricare: l'hub può togliere l'overlay di caricamento. */
  | { type: 'app:ready' }
  /** Il tool ha cambiato tema da sé: l'hub allinea l'interfaccia intorno all'iframe. */
  | { type: 'app:theme'; theme: Theme; palette?: Palette }
  /** Il tool chiede lo stato condiviso di un altro tool (`want` = quale). */
  | { type: 'app:request-state'; want?: string }
  /** Il tool pubblica il proprio stato corrente, così gli altri possono consumarlo. */
  | { type: 'app:project-update'; appId: string; project: unknown }
  /** Risposta a `hub:collect-state`: stato pieno del tool per il progetto Open E.Hub. */
  | { type: 'app:full-state'; appId: string; state: unknown }
  /** Aggiornamento della planimetria di Progetto: `dxf` (se presente) diventa lo
   *  sfondo condiviso; `cavidotti`/`circuiti` sostituiscono il sottoinsieme di
   *  `origin` nell'unione. */
  /** Pool UNICO: `cavidotti`/`circuiti` sono UPSERT (per id) nel pool condiviso;
   *  `deleted` rimuove per id. Un update parziale NON azzera il resto del pool. */
  | { type: 'app:shared-plan-update'; origin: string; dxf?: SharedDxf | null; cavidotti?: SharedGeom[]; circuiti?: SharedGeom[]; scale?: number | null; deleted?: { cavidotti?: string[]; circuiti?: string[] } }
  /** Il tool chiede all'hub di aprire un altro tool (i "ponti" fra strumenti). */
  | { type: 'hub:navigate'; appId: string }
  /** Il tool chiede all'hub di tornare alla schermata iniziale. */
  | { type: 'hub:go-home' }

const HUB_TYPES = new Set<HubToTool['type']>([
  'hub:set-theme', 'hub:set-palette', 'hub:set-font', 'hub:set-text-size', 'hub:set-motion', 'hub:set-shadow',
  'hub:project-state', 'hub:collect-state', 'hub:restore-state', 'hub:set-company', 'hub:shared-plan',
])

/** Valida e tipizza un messaggio in arrivo dall'hub; null se non riconosciuto. */
export function parseHubMessage(data: unknown): HubToTool | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (typeof m.type !== 'string' || !HUB_TYPES.has(m.type as HubToTool['type'])) return null
  if (m.type === 'hub:set-theme') {
    if (m.theme !== 'light' && m.theme !== 'dark') return null
    // `palette` è opzionale (retro-compat coi messaggi legacy col solo `theme`):
    // se presente DEVE essere una palette nota, altrimenti il messaggio è invalido.
    if ('palette' in m && m.palette !== undefined && !isPalette(m.palette)) return null
  }
  if (m.type === 'hub:set-palette' && !isPalette(m.palette)) return null
  if (m.type === 'hub:set-font' && !isFont(m.font)) return null
  if (m.type === 'hub:set-text-size' && !isTextSize(m.size)) return null
  // `scale` opzionale: se presente dev'essere un numero finito in un intervallo sano.
  if (m.type === 'hub:set-text-size' && m.scale !== undefined &&
      (typeof m.scale !== 'number' || !Number.isFinite(m.scale) || m.scale < 0.5 || m.scale > 2)) return null
  if (m.type === 'hub:set-motion' && !isMotionMode(m.motion)) return null
  if (m.type === 'hub:set-shadow' && !isShadowIntensity(m.shadow)) return null
  if (m.type === 'hub:project-state' && typeof m.source !== 'string') return null
  if (m.type === 'hub:restore-state' && !('state' in m)) return null
  if (m.type === 'hub:shared-plan') {
    const p = m.plan
    if (!p || typeof p !== 'object') return null
    const pp = p as Record<string, unknown>
    if (!Array.isArray(pp.cavidotti) || !Array.isArray(pp.circuiti)) return null
  }
  if (m.type === 'hub:set-company') {
    const c = m.company
    if (c !== null && (typeof c !== 'object' || typeof (c as Record<string, unknown>).name !== 'string')) return null
  }
  return m as HubToTool
}

/** Invia un messaggio all'hub (no-op fuori da un iframe). */
export function sendToHub(m: ToolToHub): void {
  try { window.parent.postMessage(m, '*') } catch { /* fuori da iframe */ }
}

/** True se l'origin del messaggio è accettabile: same-origin (edizione cloud)
 *  oppure offline (Electron/file:// → origin '' o 'null'). Blocca solo i
 *  messaggi cross-origin, che nel contesto web non devono essere ascoltati. */
function isTrustedOrigin(origin: string): boolean {
  if (!origin || origin === 'null') return true
  try { return origin === location.origin } catch { return true }
}

/** Sottoscrive i messaggi dell'hub; ritorna la funzione di unsubscribe.
 *
 *  Fiducia: oltre al check di origin, è SEMPRE accettato un messaggio che
 *  arriva dal PROPRIO parent (`ev.source === window.parent`). I tool girano
 *  in iframe `srcdoc`, e per un documento srcdoc `location.origin` è la
 *  stringa 'null' (origin opaco) anche quando eredita l'origine del parent:
 *  il confronto `ev.origin === location.origin` falliva SEMPRE nel contesto
 *  http, e il tool ignorava OGNI messaggio dell'hub — collect/restore-state
 *  compresi, quindi il progetto non si salvava. Fidarsi del parent
 *  non allarga la superficie: chi può incorporarti in un iframe controlla
 *  già l'intero documento. */
export function onHubMessage(fn: (m: HubToTool) => void): () => void {
  const handler = (ev: MessageEvent): void => {
    if (ev.source !== window.parent && !isTrustedOrigin(ev.origin)) return
    const m = parseHubMessage(ev.data)
    if (m) fn(m)
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
