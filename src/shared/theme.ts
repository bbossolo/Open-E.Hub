/**
 * Gestione tema condivisa. Default per-tool: ogni tool sceglie il proprio tema
 * iniziale (es. Price parte in 'light' perché più leggibile), mentre l'hub
 * può comunque sovrascriverlo a runtime via 'hub:set-theme'.
 */
import { DEFAULT_PALETTE, isPalette, onHubMessage, sendToHub, type HubToTool, type Palette, type Theme } from './bus'

/** Risolve il tema iniziale: un data-theme già valido vince sul default del tool. */
export function resolveInitialTheme(current: string | null | undefined, fallback: Theme): Theme {
  return current === 'light' || current === 'dark' ? current : fallback
}

/**
 * Risolve la palette: una palette nota già impostata vince sul fallback;
 * valori sconosciuti/null/'' ricadono sul default `ardesia`. Ortogonale al modo
 * (light/dark): la palette è risolta in modo indipendente dal tema.
 */
export function resolvePalette(current: unknown, fallback: Palette = DEFAULT_PALETTE): Palette {
  if (isPalette(current)) return current
  return isPalette(fallback) ? fallback : DEFAULT_PALETTE
}

/** Stato tema di suite persistito: modo (light/dark) × palette nominata. */
export interface SuiteTheme {
  palette: Palette
  mode: Theme
}

/**
 * Migra lo stato persistito `hub:theme`, retro-compatibile:
 * - stringa legacy 'light'|'dark'  → `{ palette:'ardesia', mode:<stringa> }`
 * - oggetto valido `{palette,mode}` → passa invariato (default sui campi mancanti)
 * - JSON corrotto / valori ignoti   → default `{ palette:'ardesia', mode:'dark' }`
 * Funzione PURA: nessun accesso a localStorage/DOM, così è testabile a parte.
 * Accetta sia la stringa grezza letta da localStorage sia un valore già parsato.
 */
export function migrateSuiteTheme(raw: unknown): SuiteTheme {
  const def: SuiteTheme = { palette: DEFAULT_PALETTE, mode: 'dark' }
  if (raw == null) return def
  if (typeof raw === 'string') {
    if (raw === 'light' || raw === 'dark') return { palette: DEFAULT_PALETTE, mode: raw }
    try { return migrateSuiteTheme(JSON.parse(raw)) } catch { return def }
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const mode: Theme = o.mode === 'light' || o.mode === 'dark' ? o.mode : def.mode
    const palette = resolvePalette(o.palette)
    return { palette, mode }
  }
  return def
}

/**
 * Modo di avvio della suite: il tema è UNICO per tutta la suite.
 * - se l'utente ha già scelto esplicitamente un modo (`pinned`), vince la sua scelta;
 * - altrimenti la suite SEGUE IL SISTEMA operativo (prefers-color-scheme).
 * Funzione PURA: la lettura di `prefers-color-scheme` resta glue nell'hub.
 */
export function resolveStartupMode(storedMode: Theme, pinned: boolean, systemMode: Theme): Theme {
  return pinned ? storedMode : systemMode
}

/** Applica il tema (modo) all'elemento radice (no-op senza DOM). */
export function applyTheme(t: Theme): void {
  try { document.documentElement.dataset.theme = t } catch { /* no DOM */ }
}

/** Applica la palette all'elemento radice scrivendo data-palette (no-op senza DOM). */
export function applyPalette(p: Palette): void {
  try { document.documentElement.dataset.palette = p } catch { /* no DOM */ }
}

export interface InitThemeOptions {
  /** Tema di default del tool quando non è già imposto un data-theme valido. */
  defaultTheme?: Theme
  /** Palette di default quando non è già impostata una data-palette nota. */
  defaultPalette?: Palette
}

/**
 * Imposta tema (modo) e palette iniziali, poi reagisce a 'hub:set-theme'
 * applicando entrambe le dimensioni e ribattendo 'app:theme' (con palette quando
 * fornita). I messaggi legacy col solo `theme` lasciano la palette invariata.
 * Ritorna l'unsubscribe.
 */
export function initTheme(opts: InitThemeOptions = {}): () => void {
  const fallback = opts.defaultTheme ?? 'dark'
  const fallbackPalette = opts.defaultPalette ?? DEFAULT_PALETTE
  let current: string | undefined
  let currentPalette: string | undefined
  try { current = document.documentElement.dataset.theme } catch { current = undefined }
  try { currentPalette = document.documentElement.dataset.palette } catch { currentPalette = undefined }
  applyTheme(resolveInitialTheme(current, fallback))
  applyPalette(resolvePalette(currentPalette, fallbackPalette))

  return onHubMessage(m => {
    if (m.type === 'hub:set-theme') {
      applyTheme(m.theme)
      if (m.palette !== undefined) applyPalette(m.palette)
      const echo: { type: 'app:theme'; theme: Theme; palette?: Palette } = { type: 'app:theme', theme: m.theme }
      if (m.palette !== undefined) echo.palette = m.palette
      sendToHub(echo)
    }
  })
}

/**
 * Applica in UN SOLO punto le 5 proprietà estetiche di suite
 * ORTOGONALI al tema (palette, font, dimensione testo, animazioni, ombre):
 * ognuna arriva già validata dal bus (`isValidHubToTool`), qui solo si
 * scrive l'attributo `data-*`/custom property corrispondente. No-op se `m`
 * non è uno dei tipi gestiti (`hub:set-theme` resta a parte: quello
 * accoppia tema+palette e ribatte `app:theme`, vedi `initTheme`).
 * Prima di questa funzione ogni tool riscriveva le stesse righe a mano
 * (rischio di divergenza silenziosa, come già successo con `asciiSafe`).
 */
export function applySuiteAesthetics(m: HubToTool): void {
  try {
    if (m.type === 'hub:set-palette') applyPalette(m.palette)
    else if (m.type === 'hub:set-font') document.documentElement.dataset.font = m.font
    else if (m.type === 'hub:set-text-size') {
      document.documentElement.dataset.textScale = m.size
      if (typeof m.scale === 'number') document.documentElement.style.setProperty('--ui-scale', String(m.scale))
    } else if (m.type === 'hub:set-motion') document.documentElement.dataset.motion = m.motion
    else if (m.type === 'hub:set-shadow') document.documentElement.dataset.shadow = m.shadow
  } catch { /* no DOM */ }
}

/**
 * Scorciatoia `T` per il tema: l'hub la gestisce solo per la propria chrome
 * (sidebar/home) — dentro un tool, che vive nel proprio iframe, il keydown
 * NON risale al padre, quindi ogni tool deve legarla da sé. Ignora l'input
 * mentre si scrive in un campo (stesso guard usato dalle altre scorciatoie
 * della suite, es. 'B' per la sidebar dell'hub). Ritorna l'unsubscribe.
 */
export function bindThemeShortcut(toggle: () => void): () => void {
  const handler = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() !== 't') return
    const el = e.target as HTMLElement | null
    if (el && (/input|select|textarea/i.test(el.tagName) || el.isContentEditable)) return
    toggle()
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}
