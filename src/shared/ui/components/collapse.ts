/* Collassa/espandi un pannello laterale Open E.Hub. Aggiunge/toglie una classe
   (default 'collapsed') sul pannello e persiste lo stato. Lo strip/affordance
   di espansione è gestito dal CSS del tool. Condiviso dai tool con sidebar. */

export interface CollapseOptions {
  /** Classe applicata quando collassato (default 'collapsed'). */
  collapsedClass?: string
  /** Chiave localStorage per persistere lo stato (opzionale). */
  storageKey?: string
  /** Callback a ogni cambio (es. per ridisegnare canvas). */
  onChange?: (collapsed: boolean) => void
}

export interface CollapseHandle {
  toggle: () => void
  set: (collapsed: boolean) => void
  isCollapsed: () => boolean
}

/**
 * Collega il collasso di `panel`. `toggleEl` (se passato) fa da pulsante.
 * Ritorna un handle con toggle/set/isCollapsed (utile per scorciatoie tastiera).
 */
export function makeCollapse(
  panel: HTMLElement | null,
  toggleEl: HTMLElement | null,
  opts: CollapseOptions = {},
): CollapseHandle {
  const cls = opts.collapsedClass ?? 'collapsed'
  const noop: CollapseHandle = { toggle: () => {}, set: () => {}, isCollapsed: () => false }
  if (!panel) return noop

  const isCollapsed = (): boolean => panel.classList.contains(cls)
  const set = (collapsed: boolean): void => {
    panel.classList.toggle(cls, collapsed)
    if (opts.storageKey) localStorage.setItem(opts.storageKey, collapsed ? '1' : '0')
    opts.onChange?.(collapsed)
  }
  const toggle = (): void => set(!isCollapsed())

  if (opts.storageKey && localStorage.getItem(opts.storageKey) === '1') set(true)
  if (toggleEl) toggleEl.addEventListener('click', toggle)

  return { toggle, set, isCollapsed }
}

/**
 * Sezione a fisarmonica: cliccando `header` si comprime/espande `body`.
 * Applica `acc-collapsed` su `header` (per il chevron via CSS) e persiste.
 */
export function makeAccordion(
  header: HTMLElement | null,
  body: HTMLElement | null,
  opts: { storageKey?: string; collapsedClass?: string; onChange?: (collapsed: boolean) => void } = {},
): void {
  if (!header || !body) return
  const cls = opts.collapsedClass ?? 'acc-collapsed'
  const set = (c: boolean): void => {
    header.classList.toggle(cls, c)
    body.style.display = c ? 'none' : ''
    if (opts.storageKey) localStorage.setItem(opts.storageKey, c ? '1' : '0')
    opts.onChange?.(c)
  }
  if (opts.storageKey && localStorage.getItem(opts.storageKey) === '1') set(true)
  header.style.cursor = 'pointer'
  header.addEventListener('click', () => set(!header.classList.contains(cls)))
}
