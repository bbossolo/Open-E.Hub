/* Visore della guida unica condivisa Open E.Hub — overlay F1 a due colonne
   (indice capitoli + contenuto). Legge il registro condiviso (ui/guide) così
   la guida è un solo manuale organizzato per sezioni, non frammentato per tool.
   Riusa `.ehb-modal-backdrop`; il pannello è `.ehb-guide*` (components.css). */
import { getGuide, isGuideEmpty } from '../guide'
import { toolGlyphSvgById } from '../glyphs'

/** Strip HTML tags for text-search matching against bodyHtml. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
}

/** Formatta una data ISO `AAAA-MM-GG` in `gg/mm/aaaa`; stringa vuota se assente/invalida. */
function fmtDate(iso: string | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

let openEl: HTMLElement | null = null
let onKeyGlobal: ((e: KeyboardEvent) => void) | null = null

const uid = (s: string): string => s.replace(/[^\w-]+/g, '-')

/** scrollIntoView sicuro: no-op dove non implementato (es. jsdom nei test). */
function scrollTo(el: Element | null | undefined, opts: ScrollIntoViewOptions): void {
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView(opts)
}

/** Chiude il visore se aperto. */
export function closeGuide(): void {
  if (!openEl) return
  openEl.remove()
  openEl = null
}

/** true se il visore è aperto. */
export function isGuideOpen(): boolean {
  return !!openEl
}

/**
 * Apre il visore sull'intero registro. Se `focusSection` è passata, scorre a
 * quella sezione. Se il registro è vuoto non fa nulla.
 */
export function openGuide(opts: { focusSection?: string } = {}): void {
  if (openEl) closeGuide()
  const allSections = getGuide()
  if (!allSections.length) return

  // Da dentro un tool si vede SOLO la propria sezione (non l'intero
  // registro con gli altri tool sullo sfondo): il manuale completo resta
  // un'azione esplicita (link «Vedi il manuale completo»), disponibile
  // sempre dall'hub (focusSection 'hub' o assente → registro intero).
  const scopedId = opts.focusSection && opts.focusSection !== 'hub' ? opts.focusSection : null
  const scopedSections = scopedId ? allSections.filter((s) => s.id === scopedId) : []
  const sections = scopedSections.length ? scopedSections : allSections

  const backdrop = document.createElement('div')
  backdrop.className = 'ehb-modal-backdrop'

  const panel = document.createElement('div')
  panel.className = 'ehb-guide'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', 'Guida Open E.Hub')

  // Indice (aside)
  const toc = document.createElement('aside')
  toc.className = 'ehb-guide__toc'
  const nav = document.createElement('nav')
  nav.className = 'ehb-guide__nav'

  // Contenuto
  const content = document.createElement('div')
  content.className = 'ehb-guide__content'

  const navItems: HTMLButtonElement[] = []
  /** wrapper `.ehb-guide__section-items` di ciascuna sezione, indicizzato per section-id. */
  const sectionGroups: Record<string, HTMLElement> = {}
  /** testo grezzo (titolo capitolo + corpo) per la ricerca, indicizzato per nav-item. */
  const searchText = new WeakMap<HTMLButtonElement, string>()
  /** Un capitolo pesa (immagini, HTML) — si costruisce il DOM di una sezione
      solo quando viene aperta, e si smonta quando si richiude: mai più di
      poche sezioni "accese" in memoria contemporaneamente. */
  const renderSection: Record<string, () => void> = {}
  const unrenderSection: Record<string, () => void> = {}
  const renderedIds = new Set<string>()

  const expandGroup = (id: string): void => {
    const group = sectionGroups[id]
    if (!group) return
    if (group.classList.contains('is-collapsed')) {
      group.classList.remove('is-collapsed')
      group.querySelector('.ehb-guide__section-toggle')?.setAttribute('aria-expanded', 'true')
    }
    renderSection[id]?.()
  }

  for (const s of sections) {
    const group = document.createElement('div')
    group.className = 'ehb-guide__section-group is-collapsed'
    group.dataset.sectionId = s.id
    if (s.tool) group.dataset.tool = s.tool

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'ehb-guide__section-toggle'
    toggle.setAttribute('aria-expanded', 'false')
    if (s.tool) toggle.dataset.tool = s.tool
    const glyph = toolGlyphSvgById(s.tool || s.id, 'ehb-guide__section-glyph')
    const count = s.chapters.length
    toggle.innerHTML = `${glyph}<span class="ehb-guide__section-title">${s.title}</span>` +
      `<span class="ehb-guide__section-count">${count}</span><span class="ehb-guide__section-caret" aria-hidden="true">▾</span>`
    toggle.addEventListener('click', () => {
      const collapsed = group.classList.toggle('is-collapsed')
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      if (collapsed) unrenderSection[s.id]?.()
      else renderSection[s.id]?.()
    })

    const items = document.createElement('div')
    items.className = 'ehb-guide__section-items'
    sectionGroups[s.id] = group

    group.append(toggle, items)
    nav.appendChild(group)

    const secEl = document.createElement('section')
    secEl.className = 'ehb-guide__section'
    secEl.id = `guide-sec-${uid(s.id)}`
    if (s.tool) secEl.dataset.tool = s.tool
    const secH = document.createElement('h2')
    secH.textContent = s.title
    const secDate = fmtDate(s.updatedAt)
    if (secDate) {
      const dateEl = document.createElement('span')
      dateEl.className = 'ehb-guide__section-date'
      dateEl.textContent = `agg. ${secDate}`
      secH.appendChild(dateEl)
    }
    secEl.appendChild(secH)
    content.appendChild(secEl)

    // Voci di indice: leggere (solo etichette), sempre presenti. Il capitolo
    // vero e proprio (bodyHtml) si materializza solo quando la sezione si apre.
    for (const c of s.chapters) {
      const chapId = `guide-ch-${uid(s.id)}--${uid(c.id)}`
      const item = document.createElement('button')
      item.className = 'ehb-guide__nav-item'
      item.type = 'button'
      item.textContent = c.title
      item.dataset.target = chapId
      item.dataset.sectionId = s.id
      item.addEventListener('click', () => {
        expandGroup(s.id)
        scrollTo(document.getElementById(chapId), { behavior: 'smooth', block: 'start' })
      })
      items.appendChild(item)
      navItems.push(item)
      searchText.set(item, `${s.title} ${c.title} ${stripHtml(c.bodyHtml)}`.toLowerCase())
    }

    renderSection[s.id] = () => {
      if (renderedIds.has(s.id)) return
      renderedIds.add(s.id)
      for (const c of s.chapters) {
        const chapId = `guide-ch-${uid(s.id)}--${uid(c.id)}`
        const art = document.createElement('article')
        art.className = 'ehb-guide__chapter'
        art.id = chapId
        const h = document.createElement('h3')
        h.textContent = c.title
        art.appendChild(h)
        const bodyWrap = document.createElement('div')
        bodyWrap.innerHTML = c.bodyHtml
        art.appendChild(bodyWrap)
        secEl.appendChild(art)
      }
      if (s.footNote) {
        const foot = document.createElement('p')
        foot.className = 'ehb-guide__foot'
        foot.innerHTML = s.footNote
        secEl.appendChild(foot)
      }
      if (s.onTour) {
        const tourBtn = document.createElement('button')
        tourBtn.className = 'ehb-btn ehb-btn--sm'
        tourBtn.type = 'button'
        tourBtn.textContent = 'Rivedi il tour'
        const fn = s.onTour
        tourBtn.addEventListener('click', () => { closeGuide(); fn() })
        secEl.appendChild(tourBtn)
      }
    }
    unrenderSection[s.id] = () => {
      if (!renderedIds.has(s.id)) return
      renderedIds.delete(s.id)
      while (secEl.childNodes.length > 1) secEl.removeChild(secEl.lastChild as ChildNode)
    }
  }

  // Testata dell'indice: titolo + chiusura, poi la ricerca.
  const tocHead = document.createElement('div')
  tocHead.className = 'ehb-guide__toc-head'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'ehb-guide__title-wrap'
  const title = document.createElement('span')
  title.className = 'ehb-guide__title'
  title.textContent = 'Guida Open E.Hub'
  titleWrap.appendChild(title)
  // «Data della guida»: la revisione più recente tra le sezioni mostrate — onesta
  // perché derivata dal max, non da un valore da aggiornare a mano.
  const lastIso = sections.map((s) => s.updatedAt || '').filter(Boolean).sort().pop()
  const lastDate = fmtDate(lastIso)
  if (lastDate) {
    const sub = document.createElement('span')
    sub.className = 'ehb-guide__updated'
    sub.textContent = `Aggiornata al ${lastDate}`
    titleWrap.appendChild(sub)
  }
  const closeBtn = document.createElement('button')
  closeBtn.className = 'ehb-btn ehb-btn--ghost ehb-btn--icon'
  closeBtn.type = 'button'
  closeBtn.title = 'Chiudi la guida (Esc)'
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', closeGuide)
  tocHead.append(titleWrap, closeBtn)

  const search = document.createElement('input')
  search.type = 'text'
  search.className = 'ehb-guide__search'
  search.placeholder = 'Cerca nella guida…'
  search.setAttribute('aria-label', 'Cerca nella guida')
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    for (const s of sections) {
      const group = sectionGroups[s.id]
      const groupItems = navItems.filter((it) => it.dataset.sectionId === s.id)
      let anyMatch = !q
      for (const it of groupItems) {
        const match = !q || (searchText.get(it) || '').includes(q)
        it.classList.toggle('is-hidden', !match)
        if (match) anyMatch = true
      }
      group.classList.toggle('is-hidden', !anyMatch)
      if (q && anyMatch) expandGroup(s.id)
    }
  })
  toc.append(tocHead, search, nav)

  if (scopedSections.length) {
    const fullLink = document.createElement('button')
    fullLink.type = 'button'
    fullLink.className = 'ehb-guide__full-link'
    fullLink.textContent = 'Vedi il manuale completo →'
    fullLink.addEventListener('click', () => { closeGuide(); openGuide({}) })
    toc.appendChild(fullLink)
  }

  panel.append(toc, content)
  backdrop.appendChild(panel)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeGuide() })

  onKeyGlobal = (e: KeyboardEvent) => { if (e.key === 'Escape') closeGuide() }
  document.addEventListener('keydown', onKeyGlobal)

  // Scroll-spy: evidenzia nell'indice il capitolo attualmente in testa, e
  // se questo appartiene a una sezione collassata la riespande da sola.
  const spy = (): void => {
    const top = content.getBoundingClientRect().top + 80
    let active = navItems[0]
    for (const it of navItems) {
      const el = document.getElementById(it.dataset.target || '')
      if (el && el.getBoundingClientRect().top <= top) active = it
    }
    for (const it of navItems) it.classList.toggle('is-active', it === active)
    if (active) expandGroup(active.dataset.sectionId || '')
    scrollTo(active, { block: 'nearest' })
  }
  content.addEventListener('scroll', spy)

  document.body.appendChild(backdrop)
  openEl = backdrop

  // Stato iniziale: tutte le sezioni partono collassate E smontate (nessun
  // bodyHtml in memoria) — se ne carica una sola, quella richiesta o la
  // prima del registro. Le altre si caricano da sole solo quando servono
  // (click su un capitolo, scroll-spy, o un match di ricerca).
  const initialId = opts.focusSection || sections[0]?.id
  if (initialId) {
    expandGroup(initialId)
    scrollTo(document.getElementById(`guide-sec-${uid(initialId)}`), { block: 'start' })
  }
  spy()
}

/** Apre/chiude il visore (bottone «Guida»). */
export function toggleGuide(focusSection?: string): void {
  if (openEl) closeGuide()
  else openGuide({ focusSection })
}

/**
 * Lega il tasto F1 all'apertura della guida (con focus sulla sezione indicata).
 * Idempotente: registrarlo più volte non duplica il listener globale.
 */
let shortcutBound = false
export function bindGuideShortcut(focusSection?: string): void {
  if (shortcutBound) return
  shortcutBound = true
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'F1') return
    e.preventDefault()
    if (isGuideEmpty()) return
    toggleGuide(focusSection)
  })
}
