/**
 * Convertitore GENERICO «pagina HTML di `renderDocPage` → SimpleDoc».
 * β Contabilità ha 9 tipi di atto (verbali, certificato, SAL, libretto, registro,
 * sommario, conto finale, giornale, frontespizio): tutti producono HTML
 * stampabile con lo stesso builder condiviso, non un DocModel strutturato.
 * Invece di adattare ciascun generatore, si cammina il DOM del corpo
 * (`.docbody`) UNA SOLA VOLTA e se ne ricava il modello flat — riusabile per
 * qualunque tool basato su `renderDocPage`, non solo β.
 */
import type { SimpleDoc, SimpleDocSection } from './simple-doc'

const norm = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim()

function tableToBlock(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const hasHead = !!table.querySelector('thead')
  const lines = rows.map(r => '|' + Array.from(r.querySelectorAll('th,td')).map(c => norm(c.textContent).replace(/\|/g, '/')).join('|') + '|')
  if (hasHead && lines.length) {
    const cols = rows[0].querySelectorAll('th,td').length
    lines.splice(1, 0, '|' + Array.from({ length: cols }, () => '---').join('|') + '|')
  }
  return lines.join('\n')
}

function listToBlock(list: Element): string {
  return Array.from(list.children).filter(li => li.tagName === 'LI')
    .map(li => '- ' + norm(li.textContent)).join('\n')
}

function firmeBlocks(container: Element): string[] {
  return Array.from(container.querySelectorAll('.bt-firma')).map(f => {
    const ruolo = norm(f.querySelector('.bt-firma__ruolo')?.textContent)
    const nome = norm(f.querySelector('.bt-firma__nome')?.textContent)
    return `${ruolo}${nome ? ' — ' + nome : ''} _______________________________`
  })
}

interface WalkState { sezioni: SimpleDocSection[]; titolo?: string; blocks: string[] }

function flush(st: WalkState): void {
  if (st.blocks.length) st.sezioni.push({ titolo: st.titolo, testo: st.blocks.join('\n\n') })
  st.blocks = []
  st.titolo = undefined
}

function walk(node: Element, st: WalkState): void {
  for (const el of Array.from(node.children)) {
    const tag = el.tagName
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      flush(st)
      st.titolo = norm(el.textContent)
    } else if (tag === 'TABLE') {
      const block = tableToBlock(el)
      if (block) st.blocks.push(block)
    } else if (tag === 'UL' || tag === 'OL') {
      const block = listToBlock(el)
      if (block) st.blocks.push(block)
    } else if (el.classList.contains('bt-firme')) {
      st.blocks.push(...firmeBlocks(el))
    } else if (tag === 'P') {
      const t = norm(el.textContent)
      if (t) st.blocks.push(t)
    } else if (tag === 'DIV' || tag === 'SECTION') {
      walk(el, st)
    }
    // altri tag (span, br, button…) fuori da .docbody non sono attesi qui: ignorati.
  }
}

/** Estrae un `SimpleDoc` dalla pagina HTML completa prodotta da `renderDocPage`. */
export function htmlDocToSimpleDoc(html: string): SimpleDoc {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const titolo = norm(parsed.querySelector('.dochead__title')?.textContent) || norm(parsed.querySelector('title')?.textContent) || 'Documento'
  const sottotitolo = norm(parsed.querySelector('.dochead__kicker')?.textContent) || undefined
  const metaDivs = Array.from(parsed.querySelectorAll('.dochead__meta > div'))
  const meta: Array<[string, string]> = []
  for (let i = 0; i < metaDivs.length; i += 2) {
    const k = norm(metaDivs[i]?.querySelector('.k')?.textContent)
    const v = norm(metaDivs[i + 1]?.querySelector('.v')?.textContent)
    if (k) meta.push([k, v])
  }
  const body = parsed.querySelector('.docbody')
  const st: WalkState = { sezioni: [], blocks: [] }
  if (body) walk(body, st)
  flush(st)
  return { titolo, sottotitolo, meta: meta.length ? meta : undefined, sezioni: st.sezioni.length ? st.sezioni : [{ testo: '' }] }
}
