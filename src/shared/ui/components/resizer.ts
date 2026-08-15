/* Ridimensionamento pannelli laterali Open E.Hub — handle trascinabile che imposta
   una CSS var (es. --left-w) sull'elemento radice e la persiste in localStorage.
   Condiviso dai tool con layout a 3 colonne. Nessuna dipendenza. */

export interface ResizerOptions {
  /** CSS var da impostare (es. '--left-w'). */
  cssVar: string
  /**
   * Lato del pannello: 'left' = handle DOPO il pannello (delta→+);
   * 'right' = handle PRIMA del pannello (delta→−).
   * Su asse 'y' vale lo stesso, letto dall'alto: 'left' = handle sotto il
   * pannello, 'right' = handle sopra (trascinare in su lo fa crescere).
   */
  side: 'left' | 'right'
  /** Asse di ridimensionamento: 'x' = larghezza (default), 'y' = altezza. */
  axis?: 'x' | 'y'
  min?: number
  max?: number
  /** Chiave localStorage per persistere la larghezza (opzionale). */
  storageKey?: string
  /** Elemento su cui leggere/scrivere la var (default <html>). */
  root?: HTMLElement
  /** Callback durante il drag (throttled a rAF) — utile per refit di canvas. */
  onResize?: (width: number) => void
}

/**
 * Rende `handle` un cursore di ridimensionamento per un pannello laterale.
 * Ripristina la larghezza salvata all'avvio. Ritorna una funzione di teardown.
 */
export function makeResizer(handle: HTMLElement | null, opts: ResizerOptions): () => void {
  if (!handle) return () => {}
  const { cssVar, side, axis = 'x', min = 180, max = 640, storageKey, root = document.documentElement } = opts
  const vertical = axis === 'y'
  const clamp = (w: number): number => Math.max(min, Math.min(max, w))
  const setW = (w: number): void => root.style.setProperty(cssVar, clamp(w) + 'px')

  // Ripristino larghezza salvata. localStorage può non essere disponibile
  // (embedding particolari, ambienti di test): persistenza opzionale, mai
  // bloccante per l'inizializzazione del resizer.
  if (storageKey) {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(saved) && saved > 0) setW(saved)
    } catch { /* nessuna larghezza salvata da ripristinare */ }
  }

  let startX = 0
  let startW = 0
  let dragging = false

  const curW = (): number => {
    const v = getComputedStyle(root).getPropertyValue(cssVar).trim().replace('px', '')
    return Number(v) || 0
  }
  // Larghezza REALE del pannello adiacente all'handle (fallback quando la var
  // non è ancora impostata inline: il default arriva dal CSS `var(x, NNNpx)`,
  // non da root → curW()=0 → al PRIMO drag il pannello "saltava"). Convenzione:
  // handle 'left' a destra del pannello (prev), 'right' a sinistra (next);
  // se l'handle è DENTRO il pannello (es. .g-side-resize figlio dell'aside,
  // sibling nullo o non-pannello) si misura il genitore — senza, startW=0 e
  // il primo drag scattava al minimo ("si resetta e poi funziona").
  const panelW = (): number => {
    const inside = getComputedStyle(handle).position === 'absolute'
    const el = inside
      ? handle.parentElement
      : (side === 'left' ? handle.previousElementSibling : handle.nextElementSibling) as HTMLElement | null
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.round(vertical ? r.height : r.width)
  }
  let rafPending = false
  const onMove = (e: MouseEvent): void => {
    if (!dragging) return
    const dx = (vertical ? e.clientY : e.clientX) - startX
    setW(startW + (side === 'left' ? dx : -dx))
    if (opts.onResize && !rafPending) {
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        opts.onResize?.(curW())
      })
    }
  }
  const onUp = (): void => {
    if (!dragging) return
    dragging = false
    handle.classList.remove('dragging')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (storageKey) { try { localStorage.setItem(storageKey, String(clamp(curW()))) } catch { /* persistenza opzionale */ } }
  }
  const onDown = (e: MouseEvent): void => {
    e.preventDefault()
    dragging = true
    startX = vertical ? e.clientY : e.clientX
    startW = curW() || panelW()   // se la var non è ancora impostata, parti dalla misura reale
    handle.classList.add('dragging')
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  handle.addEventListener('mousedown', onDown)
  // Doppio click → reset al default (rimuove la var inline; vince il CSS).
  const onDbl = (): void => {
    root.style.removeProperty(cssVar)
    if (storageKey) { try { localStorage.removeItem(storageKey) } catch { /* persistenza opzionale */ } }
  }
  handle.addEventListener('dblclick', onDbl)

  return () => {
    handle.removeEventListener('mousedown', onDown)
    handle.removeEventListener('dblclick', onDbl)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}
