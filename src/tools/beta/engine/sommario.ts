/**
 * β Contabilità — SOMMARIO DEL REGISTRO (art. 15, All. II.14). Sintesi per gruppi di
 * lavorazioni omogenee (categoria): importo contrattuale, importo a tutto il SAL
 * corrente, importo dei SAL precedenti, importo nel SAL corrente (differenza).
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { calcolaSals, importoContrattualePartita, voceVisibileInSal } from './contabilita'
import { economiaATuttoSal } from './economia'
import { categoriaLiv1 } from './import'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi } from './doc-common'

interface RigaSommario { categoria: string; contrattuale: number; aTutto: number; precedenti: number; corrente: number }

/** Aggrega per categoria (liv.1) gli importi contrattuali e gli eseguiti al SAL k e k−1. */
export function buildSommario(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): RigaSommario[] {
  const results = calcolaSals(appalto, partite, sals, liste)
  const cur = results.find((s) => s.numero === numero)
  const prev = results.filter((s) => s.numero < numero).sort((a, b) => b.numero - a.numero)[0]
  const esegById = (r?: typeof cur): Map<string, number> => {
    const m = new Map<string, number>()
    if (!r) return m
    for (const rr of r.righe) m.set(rr.partita.id, rr.eseguito)
    return m
  }
  const curMap = esegById(cur), prevMap = esegById(prev)
  const gruppi = new Map<string, RigaSommario>()
  for (const p of partite) {
    if (!voceVisibileInSal(p, numero)) continue // le voci introdotte dopo questo SAL non esistono ancora
    const cat = categoriaLiv1(p.categoria)
    const g = gruppi.get(cat) || { categoria: cat, contrattuale: 0, aTutto: 0, precedenti: 0, corrente: 0 }
    g.contrattuale = round2(g.contrattuale + importoContrattualePartita(p))
    g.aTutto = round2(g.aTutto + (curMap.get(p.id) || 0))
    g.precedenti = round2(g.precedenti + (prevMap.get(p.id) || 0))
    g.corrente = round2(g.aTutto - g.precedenti)
    gruppi.set(cat, g)
  }
  // Lavori in economia: categoria a sé (senza importo contrattuale: si paga sull'effettivo).
  const ecoA = economiaATuttoSal(liste, numero)
  const ecoP = prev ? economiaATuttoSal(liste, prev.numero) : 0
  if (ecoA > 0 || ecoP > 0) gruppi.set('Lavori in economia', { categoria: 'Lavori in economia', contrattuale: 0, aTutto: ecoA, precedenti: ecoP, corrente: round2(ecoA - ecoP) })
  return [...gruppi.values()]
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function sommarioHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): string {
  const righe = buildSommario(appalto, partite, sals, numero, liste)
  const tot = righe.reduce((a, r) => ({
    contrattuale: round2(a.contrattuale + r.contrattuale), aTutto: round2(a.aTutto + r.aTutto),
    precedenti: round2(a.precedenti + r.precedenti), corrente: round2(a.corrente + r.corrente),
  }), { contrattuale: 0, aTutto: 0, precedenti: 0, corrente: 0 })
  const rows = righe.map((r) => `<tr>
      <td>${escHtml(r.categoria)}</td>
      <td class="num">${eur(r.contrattuale)}</td>
      <td class="num">${eur(r.aTutto)}</td>
      <td class="num">${eur(r.precedenti)}</td>
      <td class="num">${eur(r.corrente)}</td>
    </tr>`).join('')
  const body = `
    <p class="note">Sommario del registro di contabilità — riepilogo per gruppi di lavorazioni omogenee (categoria) al SAL n. ${escHtml(String(numero))}. Facilita la verifica dell'avanzamento complessivo. Importi al netto di IVA.</p>
    <table class="dtable">
      <thead><tr><th>Categoria di lavorazioni</th><th class="num">Contrattuale</th><th class="num">A tutto il SAL ${escHtml(String(numero))}</th><th class="num">SAL precedenti</th><th class="num">Nel SAL ${escHtml(String(numero))}</th></tr></thead>
      <tbody>${rows}
        <tr class="tot"><td>TOTALE</td><td class="num">${eur(tot.contrattuale)}</td><td class="num">${eur(tot.aTutto)}</td><td class="num">${eur(tot.precedenti)}</td><td class="num">${eur(tot.corrente)}</td></tr>
      </tbody>
    </table>`
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Sommario · SAL ${numero}`),
    title: 'Sommario del Registro di Contabilità',
    sub: `al SAL n. ${numero}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 15 Allegato II.14 D.Lgs. 36/2023. Importi al netto di IVA.', page: `Sommario SAL ${numero}` },
    docTitle: `Sommario del Registro — SAL ${numero}`,
  })
}
