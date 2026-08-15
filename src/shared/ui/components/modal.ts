/* Modal condiviso Open E.Hub — dialog su backdrop. Usa `.ehb-modal-backdrop` /
   `.ehb-modal` di components.css. Nessuna dipendenza. */

export interface ModalAction {
  label: string
  variant?: 'accent' | 'ghost' | ''
  /** Valore risolto dalla promise quando si clicca questa azione. */
  value?: unknown
}

export interface ModalOptions {
  title?: string
  /** Testo semplice del corpo (alternativo a `body`). */
  message?: string
  /** Nodo DOM custom da inserire nel corpo (ha precedenza su `message`). */
  body?: Node
  actions?: ModalAction[]
  /** Chiudibile con click sul backdrop / Esc (default true). */
  dismissible?: boolean
}

/** Apre un modal. Risolve col `value` dell'azione cliccata (o undefined se chiuso). */
export function openModal(opts: ModalOptions = {}): Promise<unknown> {
  const { title, message, body, actions = [], dismissible = true } = opts
  return new Promise((resolve) => {
    const backdrop = document.createElement('div')
    backdrop.className = 'ehb-modal-backdrop'

    const modal = document.createElement('div')
    modal.className = 'ehb-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')

    if (title) {
      const h = document.createElement('h2')
      h.className = 'ehb-h2'
      h.textContent = title
      modal.appendChild(h)
    }
    if (body) {
      const wrap = document.createElement('div')
      wrap.style.margin = 'var(--sp-3) 0 var(--sp-5)'
      wrap.appendChild(body)
      modal.appendChild(wrap)
    } else if (message) {
      const p = document.createElement('p')
      p.className = 'ehb-muted'
      p.style.margin = 'var(--sp-3) 0 var(--sp-5)'
      p.textContent = message
      modal.appendChild(p)
    }

    let settled = false
    const close = (value: unknown) => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKey)
      backdrop.remove()
      resolve(value)
    }
    const onKey = (e: KeyboardEvent) => {
      if (dismissible && e.key === 'Escape') close(undefined)
    }

    if (actions.length) {
      const bar = document.createElement('div')
      bar.style.cssText = 'display:flex;gap:var(--sp-3);justify-content:flex-end'
      for (const a of actions) {
        const btn = document.createElement('button')
        btn.className = 'ehb-btn' + (a.variant ? ' ehb-btn--' + a.variant : '')
        btn.textContent = a.label
        btn.onclick = () => close(a.value)
        bar.appendChild(btn)
      }
      modal.appendChild(bar)
    }

    backdrop.appendChild(modal)
    if (dismissible) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(undefined)
      })
    }
    document.addEventListener('keydown', onKey)
    document.body.appendChild(backdrop)
  })
}

/** Conferma sì/no. Risolve true se confermato, false altrimenti. */
export interface CampoModal {
  /** Chiave con cui il valore torna indietro. */
  nome: string
  etichetta: string
  valore?: string
  segnaposto?: string
  /** `text` (default) o `number`. */
  tipo?: 'text' | 'number'
  /** Nota sotto al campo. */
  nota?: string
}

/**
 * Chiede uno o più valori all'utente. **Sostituisce `window.prompt()`**, che nell'app desktop
 * non esiste.
 *
 * Non è una preferenza di stile: Electron non implementa `prompt()`, lo ignora e restituisce
 * `undefined` senza dire niente. Il risultato è un pulsante che sembra rotto — cliccato, non
 * succede nulla — e nessun errore da nessuna parte a spiegare perché. È già costato un giro di
 * segnalazioni su χ; chi scrive un `prompt()` nuovo lo scoprirà allo stesso modo.
 *
 * Risolve con i valori inseriti, o `null` se si annulla.
 */
export function formModal(opts: {
  title?: string
  message?: string
  campi: CampoModal[]
  conferma?: string
}): Promise<Record<string, string> | null> {
  const body = document.createElement('div')
  body.className = 'ehb-form'
  const inputs: HTMLInputElement[] = []
  for (const c of opts.campi) {
    const wrap = document.createElement('label')
    wrap.className = 'ehb-field'
    const et = document.createElement('span')
    et.className = 'ehb-label'
    et.textContent = c.etichetta
    const inp = document.createElement('input')
    inp.className = 'ehb-input'
    inp.type = c.tipo || 'text'
    inp.value = c.valore || ''
    if (c.segnaposto) inp.placeholder = c.segnaposto
    inp.dataset.nome = c.nome
    wrap.append(et, inp)
    if (c.nota) {
      const n = document.createElement('small')
      n.className = 'ehb-muted'
      n.textContent = c.nota
      wrap.appendChild(n)
    }
    body.appendChild(wrap)
    inputs.push(inp)
  }

  const p = openModal({
    title: opts.title,
    message: opts.message,
    body,
    actions: [
      { label: 'Annulla', variant: 'ghost', value: null },
      { label: opts.conferma || 'Conferma', variant: 'accent', value: true },
    ],
  })

  // Il fuoco sul primo campo, e Invio conferma: un modale che costringe a prendere
  // il mouse per scrivere una parola è più lento del prompt che sostituisce.
  setTimeout(() => { inputs[0]?.focus(); inputs[0]?.select() }, 0)
  for (const inp of inputs) {
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const ok = document.querySelector<HTMLButtonElement>('.ehb-modal .ehb-btn--accent')
      ok?.click()
    })
  }

  return p.then((esito) => {
    if (!esito) return null
    const out: Record<string, string> = {}
    for (const inp of inputs) out[inp.dataset.nome || ''] = inp.value.trim()
    return out
  })
}

/** Un solo valore: il caso comune. Risolve con la stringa, o `null` se si annulla. */
export function promptModal(opts: {
  title?: string
  message?: string
  etichetta?: string
  valore?: string
  segnaposto?: string
  conferma?: string
}): Promise<string | null> {
  return formModal({
    title: opts.title,
    message: opts.message,
    conferma: opts.conferma,
    campi: [{ nome: 'v', etichetta: opts.etichetta || '', valore: opts.valore, segnaposto: opts.segnaposto }],
  }).then(r => (r && r.v ? r.v : null))
}

export function confirmModal(
  title: string,
  message: string,
  labels: { confirm?: string; cancel?: string } = {},
): Promise<boolean> {
  return openModal({
    title,
    message,
    actions: [
      { label: labels.cancel ?? 'Annulla', variant: 'ghost', value: false },
      { label: labels.confirm ?? 'Conferma', variant: 'accent', value: true },
    ],
  }).then((v) => v === true)
}
