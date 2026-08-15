/**
 * Report PDF di μ Prezzi (P2 — computo / estratto voci).
 * Parte pura/testabile: trasforma le voci del carrello (con quantità) in un
 * modello di computo normalizzato e ne genera l'HTML stampabile (A4, nero su
 * bianco). Il layout sta qui come stringa pura; la UI si limita ad aprirlo e a
 * lanciare la stampa → "Salva come PDF". Niente DOM, così è coperto dai test.
 *
 * Semantica del totale allineata a `cartTotals()` della UI:
 *  - senza prezzo (prezzo ≤ 0)  → esclusa dal totale, segnalata;
 *  - senza misura (qty mancante) → esclusa dal totale, segnalata;
 *  - valorizzata (prezzo>0 e qty>0) → importo = prezzo × qty, nel totale.
 */

import type { CartItem } from '../../../shared/compositore'

/** Voce in ingresso (sottoinsieme di PriceRow + quantità del carrello). */
export interface ComputoItem extends CartItem {}

export interface ComputoMeta {
  /** Versione dell'app/tool, per il piè di pagina. */
  version?: string
  /** Istante di generazione (timestamp ms o Date); default: ora. */
  now?: number | Date
}

export interface ComputoRow {
  n: number
  codice: string
  /** Titolo (descrizione ridotta, o estesa se la ridotta manca). */
  desc: string
  /** Dettaglio (descrizione estesa) quando aggiunge informazione, altrimenti ''. */
  detail: string
  um: string
  prezzo: number
  qty: number | null
  importo: number | null
  valued: boolean
}

export interface ComputoModel {
  title: string
  dateStr: string
  version: string
  /** Elenco "Regione Anno" distinti delle voci (fonti). */
  sources: string[]
  rows: ComputoRow[]
  total: number
  counts: { voci: number; valorizzate: number; senzaMisura: number; senzaPrezzo: number }
}

const round2 = (n: number) => Math.round(n * 100) / 100

const normSp = (t?: string): string => String(t || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Separa titolo (ridotta) e dettaglio (estesa). Se l'estesa coincide con la
 * ridotta o la contiene già (in testa o in coda, stile Basilicata), il dettaglio
 * non si ripete. Se la ridotta manca, l'estesa diventa il titolo.
 */
function splitDesc(short?: string, ext?: string): { desc: string; detail: string } {
  const s = normSp(short), e = normSp(ext)
  if (!s) return { desc: e, detail: '' }
  if (!e || e === s) return { desc: s, detail: '' }
  // estesa già contiene la ridotta (in testa o in coda, stile Basilicata
  // "PADRE — foglia") → usa l'estesa intera come titolo, niente dettaglio orfano
  if (e.startsWith(s) || e.endsWith(s)) return { desc: e, detail: '' }
  // ridotta come titolo, estesa come dettaglio sotto
  return { desc: s, detail: e }
}

/** Costruisce il modello di computo a partire dalle voci del carrello. */
export function buildComputoModel(items: ComputoItem[], meta: ComputoMeta = {}): ComputoModel {
  const list = items || []
  const rows: ComputoRow[] = []
  const srcSet = new Set<string>()
  let total = 0
  let valorizzate = 0, senzaMisura = 0, senzaPrezzo = 0

  list.forEach((it, i) => {
    const prezzo = round2(Number(it.prezzo) || 0)
    const qty = it.qty != null && it.qty > 0 ? round2(it.qty) : null
    let importo: number | null = null
    let valued = false
    if (!(prezzo > 0)) {
      senzaPrezzo++
    } else if (qty == null) {
      senzaMisura++
    } else {
      importo = round2(prezzo * qty)
      total = round2(total + importo)
      valued = true
      valorizzate++
    }
    const { desc, detail } = splitDesc(it.desc_short, it.declaratoria)
    rows.push({
      n: i + 1,
      codice: it.codice || '',
      desc: desc || it.codice || '—',
      detail,
      um: (it.um || '').trim(),
      prezzo,
      qty,
      importo,
      valued,
    })
    const src = [it.regione, it.anno].filter(Boolean).join(' ')
    if (src) srcSet.add(src)
  })

  return {
    title: 'Computo · estratto voci — μ Prezzi',
    dateStr: formatDate(meta.now),
    version: meta.version || '',
    sources: [...srcSet].sort(),
    rows,
    total,
    counts: { voci: rows.length, valorizzate, senzaMisura, senzaPrezzo },
  }
}

import { renderDocPage, escHtml as esc, fmtDateTime as formatDate, type DocCompany } from '../../../shared/doc'

/** Raggruppa le migliaia con il punto (formato it-IT), senza dipendere da Intl/ICU. */
const groupThousands = (intPart: string): string => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Importo/prezzo: sempre 2 decimali, migliaia '.', decimali ','. */
const numIt = (n: number): string => {
  const neg = n < 0
  const [int, dec] = Math.abs(round2(n)).toFixed(2).split('.')
  return (neg ? '-' : '') + groupThousands(int) + ',' + dec
}

/** Quantità: fino a 3 decimali (zeri finali tolti), migliaia '.', decimali ','. */
const qtyIt = (n: number): string => {
  const neg = n < 0
  const s = Math.abs(n).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  const [int, dec] = s.split('.')
  return (neg ? '-' : '') + groupThousands(int) + (dec ? ',' + dec : '')
}

function rowsHTML(rows: ComputoRow[]): string {
  if (!rows.length) return `<tr class="empty"><td colspan="7">Nessuna voce selezionata.</td></tr>`
  return rows
    .map(
      (r) => `<tr${r.valued ? '' : ' class="nv"'}>
      <td class="num">${r.n}</td>
      <td class="code">${esc(r.codice)}</td>
      <td><b>${esc(r.desc)}</b>${r.detail ? `<span class="sub">${esc(r.detail)}</span>` : ''}</td>
      <td class="num">${esc(r.um)}</td>
      <td class="num">${r.prezzo > 0 ? '€ ' + numIt(r.prezzo) : '—'}</td>
      <td class="num">${r.qty != null ? qtyIt(r.qty) : '—'}</td>
      <td class="num">${r.importo != null ? '€ ' + numIt(r.importo) : '—'}</td>
    </tr>`
    )
    .join('')
}

/** HTML stampabile completo (documento autonomo) per il computo. */
export function computoHTML(m: ComputoModel, company?: DocCompany | null): string {
  const c = m.counts
  const warn = [
    c.senzaMisura ? `${c.senzaMisura} senza misura` : '',
    c.senzaPrezzo ? `${c.senzaPrezzo} senza prezzo` : '',
  ].filter(Boolean).join(' · ')

  const body = `
    <div class="chips">
      <div class="chip"><b>${c.voci}</b><span>Voci</span></div>
      <div class="chip"><b>${c.valorizzate}</b><span>Valorizzate</span></div>
      ${warn ? `<div class="chip warn"><b>${c.senzaMisura + c.senzaPrezzo}</b><span>${esc(warn)}</span></div>` : ''}
    </div>
    <table class="dtable">
      <thead><tr>
        <th class="num">#</th><th>Codice</th><th>Descrizione</th>
        <th class="num">UM</th><th class="num">Prezzo</th><th class="num">Q.tà</th><th class="num">Importo</th>
      </tr></thead>
      <tbody>
        ${rowsHTML(m.rows)}
        <tr class="tot"><td></td><td></td><td>Totale computo</td><td></td><td></td><td></td><td class="num">€ ${numIt(m.total)}</td></tr>
      </tbody>
    </table>
    ${m.sources.length ? `<h2 class="sec-h" data-n="·">Fonti prezzario</h2>
    <table class="dtable"><thead><tr><th>Fonte (Regione Anno)</th></tr></thead>
      <tbody>${m.sources.map((s) => `<tr><td>${esc(s)}</td></tr>`).join('')}</tbody></table>` : ''}`

  return renderDocPage({
    tool: 'miu',
    company: company || undefined,
    kicker: 'Prezzi · Estratto',
    title: 'Computo · estratto voci',
    sub: 'Voci di prezzario con quantità misurate',
    docTitle: m.title,
    headMeta: [
      { k: 'Data', v: esc(m.dateStr) },
      { k: 'Voci', v: String(c.voci) },
      ...(m.sources.length ? [{ k: 'Fonti', v: String(m.sources.length) }] : []),
    ],
    bodyHTML: body,
    footer: {
      fields: [
        { k: 'Data', v: esc(m.dateStr) },
        ...(m.sources.length ? [{ k: 'Prezzari', v: esc(m.sources.join(', ')) }] : []),
        { k: 'Versione', v: m.version ? `μ Prezzi ${esc(m.version)}` : 'μ Prezzi' },
      ],
      disc: 'Importo = prezzo × quantità. Voci senza misura o senza prezzo escluse dal totale.',
      page: 'Pag. 1',
    },
  })
}
