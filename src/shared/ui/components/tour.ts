/* Tour guidato condiviso Open E.Hub — spotlight step-by-step su elementi esistenti.
   Riusa lo stile di `.ehb-modal`/`components.css` (vedi `.ehb-tour-*`). */
import { readAuth } from '../../session-profile'

export interface TourStep {
  /** Selettore CSS dell'elemento da evidenziare. Se non trovato o non visibile (0×0,
      es. dietro un `display:none` finché non c'è un dato), lo step viene saltato. */
  selector: string
  title: string
  text: string
}

/** Elemento presente E visibile (dimensioni reali) — un match dietro `display:none` non conta. */
function visibleTarget(selector: string): HTMLElement | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export interface Tour {
  id: string
  steps: TourStep[]
}

const SEEN_KEY = 'hub:tour-seen'

/** Chiave del profilo corrente (letta da `hub:auth`, stessa origin condivisa fra hub
    e tool in iframe): ogni profilo/utente ha la sua progressione del tour, così più
    utenti sulla stessa macchina (o l'admin che testa più profili) non si nascondono
    a vicenda il tour. Nessun profilo loggato → progressione condivisa su 'anon'. */
export function currentTourUserKey(): string {
  try {
    const auth = readAuth()
    if (auth?.utente) return `${auth.companyId || 'admin'}::${auth.utente}`
  } catch { /* nessun profilo valido */ }
  return 'anon'
}

function readAllSeen(): Record<string, Record<string, true>> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { return {} }
}

function writeAllSeen(all: Record<string, Record<string, true>>): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(all)) } catch { /* storage non disponibile */ }
}

export function hasSeenTour(tourId: string, userKey: string = currentTourUserKey()): boolean {
  return !!readAllSeen()[userKey]?.[tourId]
}

export function markTourSeen(tourId: string, userKey: string = currentTourUserKey()): void {
  const all = readAllSeen()
  all[userKey] = { ...all[userKey], [tourId]: true }
  writeAllSeen(all)
}

/** Azzera la progressione tour di UN profilo (tutti i tour), per poterlo ritestare
    dal primo accesso — richiamato dal pannello Admin (bottone «↺ Tour» per utente). */
export function resetToursForUser(userKey: string): void {
  const all = readAllSeen()
  delete all[userKey]
  writeAllSeen(all)
}

export function startTour(tour: Tour, opts: { onDone?: (skipped: boolean) => void } = {}): void {
  const steps = tour.steps
  let i = 0

  const dim = document.createElement('div')
  dim.className = 'ehb-tour-dim'
  const highlight = document.createElement('div')
  highlight.className = 'ehb-tour-highlight'
  const card = document.createElement('div')
  card.className = 'ehb-tour-card'
  document.body.append(dim, highlight, card)

  let finished = false
  const finish = (skipped: boolean) => {
    if (finished) return
    finished = true
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', reposition)
    window.removeEventListener('scroll', reposition, true)
    dim.remove()
    highlight.remove()
    card.remove()
    opts.onDone?.(skipped)
  }

  const nextValidIndex = (from: number, dir: 1 | -1): number => {
    let idx = from
    while (idx >= 0 && idx < steps.length) {
      if (visibleTarget(steps[idx].selector)) return idx
      idx += dir
    }
    return dir > 0 ? steps.length : -1
  }

  const render = () => {
    const step = steps[i]
    const target = visibleTarget(step.selector)
    if (!target) { finish(false); return }
    const r = target.getBoundingClientRect()
    const pad = 6
    highlight.style.top = `${r.top - pad}px`
    highlight.style.left = `${r.left - pad}px`
    highlight.style.width = `${r.width + pad * 2}px`
    highlight.style.height = `${r.height + pad * 2}px`
    // ponytail: dim a tutto schermo (niente "buco" ritagliato), l'highlight sopra il target basta a farlo leggere
    dim.style.top = '0'; dim.style.left = '0'; dim.style.right = '0'; dim.style.bottom = '0'

    card.innerHTML = ''
    const h = document.createElement('h3')
    h.className = 'ehb-tour-card__title'
    h.textContent = step.title
    const p = document.createElement('p')
    p.className = 'ehb-tour-card__text'
    p.textContent = step.text
    const foot = document.createElement('div')
    foot.className = 'ehb-tour-card__foot'
    // Numerazione sui soli step ATTUALMENTE visibili (non sull'indice grezzo): se
    // uno step è nascosto (es. richiede un computo non ancora caricato) sparisce
    // anche dal conteggio, invece di far apparire un salto tipo "2/5 → 5/5".
    const visibleIdxs = steps.map((_, idx) => idx).filter(idx => visibleTarget(steps[idx].selector))
    const stepLabel = document.createElement('span')
    stepLabel.className = 'ehb-tour-card__step'
    stepLabel.textContent = `${visibleIdxs.indexOf(i) + 1} / ${visibleIdxs.length}`
    const actions = document.createElement('div')
    actions.className = 'ehb-tour-card__actions'

    const skipBtn = document.createElement('button')
    skipBtn.className = 'ehb-btn ehb-btn--ghost'
    skipBtn.textContent = 'Salta'
    skipBtn.onclick = () => finish(true)
    actions.appendChild(skipBtn)

    // "Indietro" solo se esiste DAVVERO uno step precedente visibile — altrimenti
    // nextValidIndex torna -1 e il click chiuderebbe il tour di colpo (percepito
    // come un loop/blocco invece che un ritorno al passo 1).
    const prevIdx = nextValidIndex(i - 1, -1)
    if (prevIdx !== -1) {
      const backBtn = document.createElement('button')
      backBtn.className = 'ehb-btn ehb-btn--ghost'
      backBtn.textContent = 'Indietro'
      backBtn.onclick = () => goTo(prevIdx)
      actions.appendChild(backBtn)
    }
    const nextBtn = document.createElement('button')
    nextBtn.className = 'ehb-btn ehb-btn--accent'
    nextBtn.textContent = i === steps.length - 1 ? 'Fine' : 'Avanti'
    nextBtn.onclick = () => goTo(nextValidIndex(i + 1, 1))
    actions.appendChild(nextBtn)

    foot.append(stepLabel, actions)
    card.append(h, p, foot)

    // Posiziona la card accanto al target, clampata al viewport
    const cardRect = card.getBoundingClientRect()
    let top = r.bottom + 16
    if (top + cardRect.height > window.innerHeight - 12) top = Math.max(12, r.top - cardRect.height - 16)
    let left = r.left
    if (left + cardRect.width > window.innerWidth - 12) left = window.innerWidth - cardRect.width - 12
    left = Math.max(12, left)
    card.style.top = `${top}px`
    card.style.left = `${left}px`
  }

  const goTo = (idx: number) => {
    if (idx >= steps.length || idx < 0) { finish(idx >= steps.length ? false : true); return }
    i = idx
    render()
  }

  const reposition = () => { if (!finished) render() }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish(true)
    else if (e.key === 'Enter' || e.key === 'ArrowRight') goTo(nextValidIndex(i + 1, 1))
    else if (e.key === 'ArrowLeft') { const p = nextValidIndex(i - 1, -1); if (p !== -1) goTo(p) }
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', reposition)
  window.addEventListener('scroll', reposition, true)

  goTo(nextValidIndex(0, 1))
}
