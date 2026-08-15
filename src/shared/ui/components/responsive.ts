/* Osserva l'attraversamento del breakpoint --bp-sm (768px, vedi
   src/shared/ui/tokens.css) e chiama i callback all'ENTRATA/USCITA dalla modalità
   stretta. Usato dai tool con canvas CAD per collassare i pannelli laterali in
   drawer quando la finestra/iframe è stretta, senza persistere lo stato (così la
   preferenza desktop dell'utente resta intatta).

   NB: la larghezza rilevante è quella del DOCUMENTO del tool — che nell'hub è la
   larghezza dell'IFRAME, non della finestra. matchMedia valuta il viewport del
   documento in cui gira, quindi funziona sia standalone sia dentro l'hub. */

export interface NarrowWatcher {
  /** true se attualmente sotto la soglia. */
  isNarrow: () => boolean
  /** Scollega il listener. */
  stop: () => void
}

/**
 * Collega `onEnter`/`onLeave` all'attraversamento di `query` (default --bp-sm).
 * `onEnter` viene chiamato subito se si parte già sotto la soglia.
 */
export function watchNarrow(
  onEnter?: () => void,
  onLeave?: () => void,
  query = '(max-width: 768px)',
): NarrowWatcher {
  // Ambienti senza matchMedia (jsdom nei test, SSR): no-op sicuro.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { isNarrow: () => false, stop: () => {} }
  }
  const mq = window.matchMedia(query)
  const handle = (e: MediaQueryListEvent | MediaQueryList): void => {
    if (e.matches) onEnter?.()
    else onLeave?.()
  }
  mq.addEventListener('change', handle)
  if (mq.matches) onEnter?.()
  return {
    isNarrow: () => mq.matches,
    stop: () => mq.removeEventListener('change', handle),
  }
}
