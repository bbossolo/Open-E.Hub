/**
 * β Contabilità — LIBRETTO DELLE MISURE (Allegato II.14). Accerta le lavorazioni
 * eseguite a un dato SAL:
 *  - a MISURA: N.ordine · Codice · Designazione · Fattori (L×L×H×n) · Prodotti
 *    (quantità) · Prezzo unitario · Importo — dalle righe di misura reali;
 *  - a CORPO: per corpo d'opera, quota % dell'aliquota eseguita → importo maturato.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal, RigaSal } from './types'
import type { ListaEconomia } from './types'
import { eseguitoPartita, importoContrattualePartita, aliquotaCorpoPct, voceVisibileInSal, voceSoppressaInSal } from './contabilita'
import { listeATuttoSal, valorizzaLista } from './economia'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML } from './doc-common'

const fatt = (v: number | null | undefined): string => (v == null ? '' : num(v))

/** Righe di misura (a misura) per una partita a un SAL. */
function righeMisuraHTML(p: Partita, riga: RigaSal | undefined, salNumero: number): string {
  // Voce soppressa: resta a verbale con la detrazione dello storno (traccia).
  if (voceSoppressaInSal(p, salNumero)) {
    return `<tr class="nv">
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}<span class="sub">voce soppressa e portata in detrazione al SAL n. ${escHtml(String(p.soppressaSal))} (storno)</span></td>
      <td class="num" colspan="4"><i>stornata</i></td>
      <td class="num">${p.prezzoUnitario == null ? '—' : eur(p.prezzoUnitario)}</td>
      <td class="num">${eur(0)}</td>
    </tr>`
  }
  const righe = riga?.misurazioni && riga.misurazioni.length ? riga.misurazioni : null
  if (!righe) {
    const qty = riga?.quantitaProgressiva ?? null
    return `<tr>
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}</td>
      <td class="num" colspan="4">${qty == null ? '<i>quantità da rilevare</i>' : num(qty) + (p.um ? ' ' + escHtml(p.um) : '')}</td>
      <td class="num">${p.prezzoUnitario == null ? '—' : eur(p.prezzoUnitario)}</td>
      <td class="num">${eur(eseguitoPartita(p, riga))}</td>
    </tr>`
  }
  const sub = righe.map((r, i) => `<tr class="${(r.quantita || 0) < 0 ? 'nv' : ''}">
      <td class="code">${i === 0 ? escHtml(p.codice) : ''}</td>
      <td>${i === 0 ? escHtml(p.descrizione) : ''}<span class="sub">${escHtml(r.descrizione || '')}</span></td>
      <td class="num">${fatt(r.l1)}</td><td class="num">${fatt(r.l2)}</td><td class="num">${fatt(r.h)}</td><td class="num">${fatt(r.n)}</td>
      <td class="num">${num(r.quantita)}</td>
      <td class="num">${i === 0 ? eur(eseguitoPartita(p, riga)) : ''}</td>
    </tr>`).join('')
  return sub
}

function librettoAMisuraHTML(partite: Partita[], sal: Sal): string {
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  const misura = partite.filter((p) => p.modalita === 'misura' && voceVisibileInSal(p, sal.numero))
  if (!misura.length) return ''
  const body = misura.map((p) => righeMisuraHTML(p, rigaById.get(p.id), sal.numero)).join('')
  const tot = misura.reduce((s, p) => s + eseguitoPartita(p, rigaById.get(p.id), sal.numero), 0)
  return `
    <h2 class="sec-h">Lavorazioni a misura</h2>
    <table class="dtable">
      <thead><tr>
        <th>Codice</th><th>Designazione dei lavori</th>
        <th class="num">Lungh.</th><th class="num">Largh.</th><th class="num">H/peso</th><th class="num">N.</th>
        <th class="num">Quantità</th><th class="num">Importo</th>
      </tr></thead>
      <tbody>${body}
        <tr class="tot"><td colspan="7">Totale lavorazioni a misura a tutto il SAL</td><td class="num">${eur(tot)}</td></tr>
      </tbody>
    </table>`
}

function librettoACorpoHTML(partite: Partita[], sal: Sal): string {
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  const corpo = partite.filter((p) => p.modalita === 'corpo' && voceVisibileInSal(p, sal.numero))
  if (!corpo.length) return ''
  const body = corpo.map((p) => {
    const r = rigaById.get(p.id)
    const soppressa = voceSoppressaInSal(p, sal.numero)
    const quota = soppressa ? 0 : (r?.quotaPct ?? null)
    return `<tr class="${soppressa ? 'nv' : ''}">
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}${soppressa ? `<span class="sub">corpo soppresso e portato in detrazione al SAL n. ${escHtml(String(p.soppressaSal))} (storno)</span>` : ''}</td>
      <td class="num">${eur(importoContrattualePartita(p))}</td>
      <td class="num">${aliquotaCorpoPct(p, partite) == null ? '—' : pct(aliquotaCorpoPct(p, partite))}</td>
      <td class="num">${soppressa ? '<i>stornata</i>' : quota == null ? '<i>—</i>' : pct(quota, 1)}</td>
      <td class="num">${eur(eseguitoPartita(p, r, sal.numero))}</td>
    </tr>`
  }).join('')
  const tot = corpo.reduce((s, p) => s + eseguitoPartita(p, rigaById.get(p.id), sal.numero), 0)
  return `
    <h2 class="sec-h">Lavorazioni a corpo</h2>
    <p class="note">Per gli appalti a corpo si registra la quota percentuale dell'aliquota della voce disaggregata eseguita a ogni stato di avanzamento (art. 12, All. II.14).</p>
    <table class="dtable">
      <thead><tr>
        <th>Corpo</th><th>Categoria / designazione</th><th class="num">Importo corpo</th>
        <th class="num">Aliquota</th><th class="num">% eseguita</th><th class="num">Importo maturato</th>
      </tr></thead>
      <tbody>${body}
        <tr class="tot"><td colspan="5">Totale lavorazioni a corpo a tutto il SAL</td><td class="num">${eur(tot)}</td></tr>
      </tbody>
    </table>`
}

/** Sezione «Lavorazioni in economia»: le liste settimanali che competono al SAL. */
function librettoEconomiaHTML(liste: ListaEconomia[] | undefined, sal: Sal): string {
  const del = listeATuttoSal(liste, sal.numero)
  if (!del.length) return ''
  const body = del.map((l) => {
    const v = valorizzaLista(l)
    return `<tr>
      <td class="code">L${escHtml(String(l.numero ?? ''))}</td>
      <td>Lista settimanale in economia${l.data ? ` del ${escHtml(l.data)}` : ''}<span class="sub">mano d'opera ${eur(v.manodopera)} · noli ${eur(v.noli)} · provviste ${eur(v.provviste)}</span></td>
      <td class="num">${eur(v.totale)}</td>
    </tr>`
  }).join('')
  const tot = del.reduce((s, l) => s + valorizzaLista(l).totale, 0)
  return `
    <h2 class="sec-h">Lavorazioni in economia</h2>
    <p class="note">Lavori disposti dal DL e contabilizzati per risorse impiegate (liste settimanali di operai, mezzi e provviste), art. 181 D.Lgs. 36/2023.</p>
    <table class="dtable">
      <thead><tr><th>Rif. lista</th><th>Designazione</th><th class="num">Importo</th></tr></thead>
      <tbody>${body}
        <tr class="tot"><td colspan="2">Totale lavorazioni in economia a tutto il SAL</td><td class="num">${eur(tot)}</td></tr>
      </tbody>
    </table>`
}

export function librettoHTML(appalto: Appalto, partite: Partita[], sal: Sal, liste?: ListaEconomia[]): string {
  const misuraHTML = librettoAMisuraHTML(partite, sal)
  const corpoHTML = librettoACorpoHTML(partite, sal)
  const economiaHTML = librettoEconomiaHTML(liste, sal)
  const body = `
    <p class="note">Libretto delle misure — accerta le lavorazioni eseguite a tutto il SAL n. ${escHtml(String(sal.numero))}${sal.data ? ` (${escHtml(sal.data)})` : ''}. Le misure sono rilevate in contraddittorio con l'esecutore.</p>
    ${misuraHTML}
    ${corpoHTML}
    ${economiaHTML}
    ${!misuraHTML && !corpoHTML && !economiaHTML ? '<p class="note"><i>Nessuna lavorazione registrata per questo SAL.</i></p>' : ''}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: "L'esecutore" }])}
  `
  return renderDocPage({
    tool: 'beta',
    brand: 'none',
    enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Libretto · SAL ${sal.numero}`),
    title: 'Libretto delle Misure',
    sub: `SAL n. ${sal.numero}${sal.data ? ' del ' + sal.data : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 13 (a misura) / art. 12 (a corpo) Allegato II.14 D.Lgs. 36/2023. Importi al netto di IVA.', page: `Libretto SAL ${sal.numero}` },
    docTitle: `Libretto delle Misure — SAL ${sal.numero}`,
  })
}
