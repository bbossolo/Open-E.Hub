/**
 * β Contabilità — LAVORI IN ECONOMIA (art. 181 D.Lgs. 36/2023 / All. II.14; D.M. 49/2018
 * art. 14). Le lavorazioni disposte dal DL e non contabilizzabili a misura/corpo
 * si computano per risorse impiegate tramite le LISTE SETTIMANALI: operai
 * (ore × tariffa), mezzi/noli (ore × tariffa), provviste (quantità × prezzo).
 * La lista è un atto pubblico, in duplice copia (una in bollo), firmato in
 * contraddittorio; il suo importo confluisce nel libretto/registro del SAL.
 *
 * Motore PURO (nessun DOM). Regola di fedeltà del dato: i campi mancanti restano
 * tali (null), il motore non stima ore/tariffe/quantità.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num } from '../../../shared/format'
import type { Appalto, ListaEconomia, RigaOperaio, RigaMezzo, RigaProvvista } from './types'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo } from './doc-common'

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const importoOperaio = (r: RigaOperaio): number => round2((r.ore || 0) * (r.tariffaOraria || 0))
const importoMezzo = (r: RigaMezzo): number => round2((r.ore || 0) * (r.tariffaOraria || 0))
const importoProvvista = (r: RigaProvvista): number => round2((r.quantita || 0) * (r.prezzoUnitario || 0))

export interface ValorizzazioneLista { manodopera: number; noli: number; provviste: number; totale: number }

/** Valorizza una lista: manodopera + noli + provviste. */
export function valorizzaLista(l: ListaEconomia): ValorizzazioneLista {
  const manodopera = round2((l.operai || []).reduce((s, r) => s + importoOperaio(r), 0))
  const noli = round2((l.mezzi || []).reduce((s, r) => s + importoMezzo(r), 0))
  const provviste = round2((l.provviste || []).reduce((s, r) => s + importoProvvista(r), 0))
  return { manodopera, noli, provviste, totale: round2(manodopera + noli + provviste) }
}

/** true se la lista risulta soppressa (stornata) a tutto il SAL n. */
export function listaSoppressaInSal(l: ListaEconomia, salNumero: number): boolean {
  return l.soppressaSal != null && salNumero >= l.soppressaSal
}

/** Le liste che competono al SAL n (competenza `salNumero <= n`, non soppresse a n). */
export function listeATuttoSal(liste: ListaEconomia[] | undefined, salNumero: number): ListaEconomia[] {
  return (liste || []).filter((l) => (l.salNumero ?? 1) <= salNumero && !listaSoppressaInSal(l, salNumero))
}

/** Importo progressivo dei lavori in economia a tutto il SAL n. */
export function economiaATuttoSal(liste: ListaEconomia[] | undefined, salNumero: number): number {
  return round2(listeATuttoSal(liste, salNumero).reduce((s, l) => s + valorizzaLista(l).totale, 0))
}

/** Factory: nuova lista in economia con id e numero progressivo. */
export function nuovaLista(salNumero: number | undefined, data: string, esistenti: ListaEconomia[], id: string): ListaEconomia {
  const numero = (esistenti || []).length + 1
  return { id, numero, data, salNumero, operai: [], mezzi: [], provviste: [] }
}

/* ── Documento stampabile: la lista settimanale in economia ──────────────── */
function operaiHTML(righe: RigaOperaio[]): string {
  if (!righe.length) return ''
  const rows = righe.map((r) => `<tr>
      <td>${orTodo(r.qualifica)}${r.nominativo ? `<span class="sub">${escHtml(r.nominativo)}</span>` : ''}</td>
      <td>${escHtml(r.lavorazione || '')}</td>
      <td class="num">${r.ore == null ? '—' : num(r.ore)}</td>
      <td class="num">${r.tariffaOraria == null ? '—' : eur(r.tariffaOraria)}</td>
      <td class="num">${eur(importoOperaio(r))}</td>
    </tr>`).join('')
  const tot = righe.reduce((s, r) => s + importoOperaio(r), 0)
  return `<h2 class="sec-h">Mano d'opera</h2>
    <table class="dtable"><thead><tr><th>Qualifica</th><th>Lavorazione</th><th class="num">Ore</th><th class="num">Tariffa oraria</th><th class="num">Importo</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td colspan="4">Totale mano d'opera</td><td class="num">${eur(tot)}</td></tr></tbody></table>`
}
function mezziHTML(righe: RigaMezzo[]): string {
  if (!righe.length) return ''
  const rows = righe.map((r) => `<tr>
      <td>${escHtml(r.descrizione)}</td>
      <td class="num">${r.ore == null ? '—' : num(r.ore)}</td>
      <td class="num">${r.tariffaOraria == null ? '—' : eur(r.tariffaOraria)}</td>
      <td class="num">${eur(importoMezzo(r))}</td>
    </tr>`).join('')
  const tot = righe.reduce((s, r) => s + importoMezzo(r), 0)
  return `<h2 class="sec-h">Mezzi d'opera e noli</h2>
    <table class="dtable"><thead><tr><th>Mezzo / nolo</th><th class="num">Ore</th><th class="num">Tariffa oraria</th><th class="num">Importo</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td colspan="3">Totale mezzi e noli</td><td class="num">${eur(tot)}</td></tr></tbody></table>`
}
function provvisteHTML(righe: RigaProvvista[]): string {
  if (!righe.length) return ''
  const rows = righe.map((r) => `<tr>
      <td>${escHtml(r.descrizione)}</td>
      <td class="num">${r.quantita == null ? '—' : num(r.quantita)}${r.um ? ' ' + escHtml(r.um) : ''}</td>
      <td class="num">${r.prezzoUnitario == null ? '—' : eur(r.prezzoUnitario)}</td>
      <td class="num">${eur(importoProvvista(r))}</td>
    </tr>`).join('')
  const tot = righe.reduce((s, r) => s + importoProvvista(r), 0)
  return `<h2 class="sec-h">Provviste</h2>
    <table class="dtable"><thead><tr><th>Provvista / materiale</th><th class="num">Quantità</th><th class="num">Prezzo unit.</th><th class="num">Importo</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td colspan="3">Totale provviste</td><td class="num">${eur(tot)}</td></tr></tbody></table>`
}

/** Rende una lista settimanale in economia come atto istituzionale stampabile. */
export function listaEconomiaHTML(appalto: Appalto, lista: ListaEconomia): string {
  const v = valorizzaLista(lista)
  const titolo = lista.numero != null ? `Lista settimanale in economia n. ${lista.numero}` : 'Lista settimanale in economia'
  const sezioni = [operaiHTML(lista.operai || []), mezziHTML(lista.mezzi || []), provvisteHTML(lista.provviste || [])].filter(Boolean).join('')
  const body = `
    <p class="note">Lista settimanale dei lavori in economia — annota gli operai, i mezzi/noli e le provviste forniti dall'esecutore su ordine del Direttore dei Lavori, valorizzati per la contabilizzazione in economia.</p>
    <table class="dtable"><tbody>
      <tr><td>Settimana di riferimento</td><td>${orTodo(lista.data)}</td></tr>
      ${lista.salNumero != null ? `<tr><td>SAL di competenza</td><td>n. ${escHtml(String(lista.salNumero))}</td></tr>` : ''}
      ${lista.ordineRef ? `<tr><td>Ordine di servizio</td><td>${escHtml(lista.ordineRef)}</td></tr>` : ''}
    </tbody></table>
    ${sezioni || '<p class="note"><i>Nessuna risorsa registrata.</i></p>'}
    <h2 class="sec-h">Riepilogo</h2>
    <table class="dtable"><tbody>
      <tr><td>Mano d'opera</td><td class="num">${eur(v.manodopera)}</td></tr>
      <tr><td>Mezzi e noli</td><td class="num">${eur(v.noli)}</td></tr>
      <tr><td>Provviste</td><td class="num">${eur(v.provviste)}</td></tr>
      <tr class="tot"><td>TOTALE in economia (netto IVA)</td><td class="num">${eur(v.totale)}</td></tr>
    </tbody></table>
    ${lista.note ? `<p class="prose">${escHtml(lista.note)}</p>` : ''}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: "L'esecutore" }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Lavori in economia'),
    title: titolo,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 181 D.Lgs. 36/2023 / All. II.14; D.M. 49/2018 art. 14. Da redigere in duplice copia (una in bollo) e firmare in contraddittorio con l\'esecutore.', page: titolo },
    docTitle: `${titolo} — ${appalto.oggetto || 'Lavori'}`,
  })
}
