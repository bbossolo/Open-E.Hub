/**
 * β Contabilità — REGISTRO DI CONTABILITÀ (art. 14, All. II.14). Riassume e accentra la
 * contabilizzazione: trascrive le partite dai libretti in ordine cronologico,
 * determina il credito progressivo, ospita le riserve dell'esecutore (iscritte
 * alla firma di ogni SAL) e le motivate deduzioni del DL.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal, Riserva, ListaEconomia } from './types'
import { calcolaSals, eseguitoPartita, voceVisibileInSal, voceSoppressaInSal } from './contabilita'
import { economiaATuttoSal } from './economia'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML } from './doc-common'

function partiteHTML(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const salN = ultimo?.numero ?? 1
  const economia = economiaATuttoSal(liste, salN)
  const rigaById = new Map((ultimo ? sals.find((s) => s.numero === ultimo.numero)?.righe : [])?.map((r) => [r.partitaId, r]) || [])
  const rows = partite.filter((p) => voceVisibileInSal(p, salN)).map((p) => {
    const r = rigaById.get(p.id)
    const soppressa = voceSoppressaInSal(p, salN)
    const eseg = eseguitoPartita(p, r, salN)
    const qtaCol = soppressa ? '<i>stornata</i>' : (p.modalita === 'corpo' ? (r?.quotaPct == null ? '—' : pct(r.quotaPct, 1)) : (r?.quantitaProgressiva ?? '—'))
    return `<tr class="${soppressa ? 'nv' : ''}">
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}<span class="sub">${p.modalita === 'corpo' ? 'a corpo' : 'a misura · ' + (p.um || '')}${soppressa ? ` · soppressa al SAL ${p.soppressaSal} (storno)` : ''}</span></td>
      <td class="num">${p.modalita === 'corpo' ? '—' : (p.prezzoUnitario == null ? '—' : eur(p.prezzoUnitario))}</td>
      <td class="num">${qtaCol}</td>
      <td class="num">${eur(eseg)}</td>
    </tr>`
  }).join('')
  const economiaRow = economia > 0
    ? `<tr><td class="code">—</td><td>Lavori in economia (liste settimanali)<span class="sub">art. 181 D.Lgs. 36/2023</span></td><td class="num">—</td><td class="num">a economia</td><td class="num">${eur(economia)}</td></tr>`
    : ''
  const totale = ultimo ? ultimo.lavoriEseguiti : 0
  return `<table class="dtable">
    <thead><tr><th>Rif. libretto</th><th>Designazione</th><th class="num">Prezzo</th><th class="num">% / Qtà</th><th class="num">Importo</th></tr></thead>
    <tbody>${rows}${economiaRow}<tr class="tot"><td colspan="4">Credito progressivo dei lavori (a tutto l'ultimo SAL)</td><td class="num">${eur(totale)}</td></tr></tbody>
  </table>`
}

function riserveHTML(riserve?: Riserva[]): string {
  if (!riserve || !riserve.length) {
    return `<h2 class="sec-h">Riserve</h2>
      <p class="note">Il registro è sottoposto all'esecutore per la sottoscrizione in occasione di ogni stato di avanzamento: è il momento per l'iscrizione delle riserve, <b>a pena di decadenza</b> (art. 115 c.2 D.Lgs. 36/2023 + art. 7 All. II.14). Alla data del presente registro <b>non risultano riserve iscritte</b>.</p>`
  }
  const rows = riserve.map((r) => `<tr>
      <td class="num">${escHtml(String(r.numero))}</td>
      <td>${escHtml(r.oggetto)}${r.controdeduzioni ? `<span class="sub">Deduzioni DL: ${escHtml(r.controdeduzioni)}</span>` : ''}</td>
      <td class="num">${r.salNumero == null ? '—' : escHtml(String(r.salNumero))}</td>
      <td class="num">${r.importo == null ? '—' : eur(r.importo)}</td>
    </tr>`).join('')
  return `<h2 class="sec-h">Riserve</h2>
    <table class="dtable"><thead><tr><th class="num">N.</th><th>Oggetto / deduzioni del DL</th><th class="num">SAL</th><th class="num">Importo</th></tr></thead>
    <tbody>${rows}</tbody></table>`
}

export function registroHTML(appalto: Appalto, partite: Partita[], sals: Sal[], riserve?: Riserva[], liste?: ListaEconomia[]): string {
  const body = `
    <p class="note">Registro di contabilità — trascrive le partite dei libretti delle misure in ordine cronologico e individua il credito progressivo dell'impresa. Fogli da numerare e bollare (art. 2215 c.c.).</p>
    <h2 class="sec-h">Partite contabilizzate</h2>
    ${partiteHTML(appalto, partite, sals, liste)}
    ${riserveHTML(riserve)}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: "L'esecutore (per accettazione / con riserva)" }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Registro'),
    title: 'Registro di Contabilità',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 14 Allegato II.14 D.Lgs. 36/2023. La firma del registro è il momento dell\'iscrizione delle riserve, a pena di decadenza.', page: 'Registro' },
    docTitle: `Registro di Contabilità — ${appalto.oggetto || 'Lavori'}`,
  })
}
