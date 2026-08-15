/* Layer condiviso di micro-interazioni Open E.Hub — ogni azione utente ha una
   risposta visiva chiara. Usa le classi .ehb-flash /
   .ehb-view-enter di components.css; rispetta il toggle Animazioni (attributo
   data-motion sul <html>) e prefers-reduced-motion di sistema: quando disattivo,
   le funzioni sono no-op (le classi CSS sono comunque già neutralizzate dalla
   regola ombrello in tokens.css, questo evita anche di far ripartire animazioni
   già azzerate). Nessuna dipendenza da toast.ts: re-esportato qui per avere
   un solo import "feedback" nei tool: `showToast` resta comunque disponibile
   dal barrel components/index.ts (già esportato da toast.ts). */

/** True se le micro-animazioni sono attive (setting utente + sistema). */
export function motionEnabled(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduced') return false
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

/**
 * Evidenzia `el` con un flash di conferma (es. "voce aggiunta"). Riavviabile:
 * se già in corso, lo interrompe e lo fa ripartire da capo.
 */
export function flashElement(el: HTMLElement | null): void {
  if (!el || !motionEnabled()) return
  el.classList.remove('ehb-flash')
  // Forza il reflow per poter riavviare la stessa animazione a ripetizione.
  void el.offsetWidth
  el.classList.add('ehb-flash')
  const onEnd = (ev: AnimationEvent): void => {
    if (ev.animationName !== 'ehb-flash') return
    el.classList.remove('ehb-flash')
    el.removeEventListener('animationend', onEnd)
  }
  el.addEventListener('animationend', onEnd)
}

/**
 * Ri-triggera la transizione di ingresso su un contenitore appena mostrato
 * (cambio vista/step). No-op se le animazioni sono disattivate.
 */
export function viewEnter(el: HTMLElement | null): void {
  if (!el || !motionEnabled()) return
  el.classList.remove('ehb-view-enter')
  void el.offsetWidth
  el.classList.add('ehb-view-enter')
}

/**
 * Fa volare un'etichetta da un elemento a un altro, lungo un arco, lasciando una scia.
 *
 * Risponde all'unica domanda che l'utente si fa dopo un'azione istantanea: **è successo
 * qualcosa, e dove è finito?** Un elenco che si riordina in un fotogramma è corretto e
 * incomprensibile; lo stesso riordino mostrato mentre accade si capisce senza leggere niente.
 *
 * L'arco non è vezzo: una retta si legge come un glitch, una curva come una traiettoria.
 *
 * No-op quando le animazioni sono disattivate — e la promessa si risolve subito, così chi
 * l'attende non resta appeso.
 */
export function volaVerso(da: HTMLElement | null, a: HTMLElement | null, etichetta: string, durata = 420): Promise<void> {
  if (!da || !a || !motionEnabled() || typeof document === 'undefined') return Promise.resolve()
  const r0 = da.getBoundingClientRect()
  const r1 = a.getBoundingClientRect()
  if (!r0.width || !r1.width) return Promise.resolve()
  const x0 = r0.left + 12, y0 = r0.top + r0.height / 2
  const x1 = r1.left + 16, y1 = r1.top + r1.height / 2

  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'ehb-scia')
  const path = document.createElementNS(NS, 'path')
  const cx = (x0 + x1) / 2
  const cy = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.18 - 24
  path.setAttribute('d', `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`)
  svg.appendChild(path)
  document.body.appendChild(svg)

  // Se l'ambiente non sa misurare un tracciato SVG si vola in linea retta: un'animazione è un
  // di più, e un di più che lancia eccezioni è un difetto.
  const misurabile = typeof path.getTotalLength === 'function'
  const len = misurabile ? path.getTotalLength() : Math.hypot(x1 - x0, y1 - y0)
  const punto = (t: number): { x: number; y: number } => (misurabile
    ? path.getPointAtLength(len * t)
    : { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
  path.style.strokeDasharray = String(len)
  path.style.strokeDashoffset = String(len)

  const bolla = document.createElement('div')
  bolla.className = 'ehb-volo'
  bolla.textContent = etichetta
  bolla.style.left = `${x0}px`
  bolla.style.top = `${y0 - 11}px`
  document.body.appendChild(bolla)

  const t0 = performance.now()
  return new Promise<void>((res) => {
    const passo = (t: number): void => {
      const k = Math.min(1, (t - t0) / durata)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      const p = punto(e)
      bolla.style.transform = `translate(${p.x - x0}px, ${p.y - y0}px) scale(${1 - 0.25 * e})`
      bolla.style.opacity = String(k < 0.8 ? 1 : (1 - k) / 0.2)
      path.style.strokeDashoffset = String(len * (1 - e))
      path.style.opacity = String(0.55 * (1 - e * e))
      if (k < 1) requestAnimationFrame(passo)
      else { svg.remove(); bolla.remove(); res() }
    }
    requestAnimationFrame(passo)
  })
}

export interface UndoToastOptions {
  /** Millisecondi prima che l'azione diventi definitiva (default 5000). */
  duration?: number
}

/**
 * Toast con azione «Annulla» — sostituisce il confirm() bloccante per le
 * cancellazioni recuperabili: la UI applica subito la rimozione (ottimistica),
 * l'utente ha una finestra per tornare indietro senza dialog invasivi.
 * `onUndo` è chiamato SOLO se l'utente clicca «Annulla» entro `duration`.
 */
export function undoToast(message: string, onUndo: () => void, opts: UndoToastOptions = {}): void {
  const { duration = 5000 } = opts
  const t = document.createElement('div')
  t.className = 'ehb-toast ehb-toast--undo' + (motionEnabled() ? ' ehb-pop-in' : '')
  const msg = document.createElement('span')
  msg.textContent = message
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'ehb-toast__undo'
  btn.textContent = 'Annulla'
  t.append(msg, btn)
  document.body.appendChild(t)
  let done = false
  const close = (): void => { if (done) return; done = true; t.remove() }
  const timer = setTimeout(close, duration)
  btn.addEventListener('click', () => {
    clearTimeout(timer)
    close()
    onUndo()
  })
}
