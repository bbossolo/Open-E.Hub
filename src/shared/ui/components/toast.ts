/* Toast condiviso Open E.Hub — notifica effimera in basso al centro.
   Usa la classe `.ehb-toast` di components.css. Nessuna dipendenza. */

export type ToastVariant = '' | 'ok' | 'warn' | 'bad'

export interface ToastOptions {
  variant?: ToastVariant
  /** Durata visibile in ms prima della dissolvenza. */
  duration?: number
}

/** Mostra un toast e lo rimuove da solo. Ritorna una funzione per chiuderlo subito. */
export function showToast(message: string, opts: ToastOptions = {}): () => void {
  const { variant = '', duration = 2600 } = opts
  const t = document.createElement('div')
  t.className = 'ehb-toast' + (variant ? ' ehb-toast--' + variant : '')
  t.textContent = message
  t.style.transition = 'opacity .2s ease, transform .2s ease'
  t.style.opacity = '0'
  t.style.transform = 'translateX(-50%) translateY(8px)'
  document.body.appendChild(t)
  requestAnimationFrame(() => {
    t.style.opacity = '1'
    t.style.transform = 'translateX(-50%) translateY(0)'
  })
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    t.style.opacity = '0'
    t.style.transform = 'translateX(-50%) translateY(8px)'
    setTimeout(() => t.remove(), 220)
  }
  const timer = setTimeout(close, duration)
  return () => {
    clearTimeout(timer)
    close()
  }
}
