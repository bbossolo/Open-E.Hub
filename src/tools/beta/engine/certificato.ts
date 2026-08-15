/**
 * β Contabilità — CERTIFICATO DI PAGAMENTO (art. 17, All. II.14). Emesso dal RUP entro
 * 7 giorni dal SAL, previa verifica della regolarità contributiva (DURC). Il
 * credito dell'impresa coincide col netto del SAL.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal } from './types'
import { calcolaSals } from './contabilita'
import { enteDi, footerFieldsDi, kickerDi, firmeHTML, orTodo } from './doc-common'

/** Importo in lettere (euro) — "Diconsi". Deterministico, italiano. */
export function importoInLettere(n: number): string {
  const euro = Math.floor(Math.abs(n))
  const cent = Math.round((Math.abs(n) - euro) * 100)
  const u = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove']
  const d = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']
  const dueCifre = (x: number): string => {
    if (x < 20) return u[x]
    const dec = Math.floor(x / 10), un = x % 10
    let base = d[dec]
    if (un === 1 || un === 8) base = base.slice(0, -1)
    return base + (un ? u[un] : '')
  }
  const treCifre = (x: number): string => {
    if (x < 100) return dueCifre(x)
    const cen = Math.floor(x / 100), resto = x % 100
    const pref = cen === 1 ? 'cento' : u[cen] + 'cento'
    return pref + (resto ? dueCifre(resto) : '')
  }
  const gruppi = (x: number): string => {
    if (x === 0) return 'zero'
    if (x < 1000) return treCifre(x)
    const migl = Math.floor(x / 1000), resto = x % 1000
    const pref = migl === 1 ? 'mille' : treCifre(migl) + 'mila'
    return pref + (resto ? treCifre(resto) : '')
  }
  const segno = n < 0 ? 'meno ' : ''
  return `${segno}${gruppi(euro)}/${String(cent).padStart(2, '0')}`
}

export function certificatoHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number): string {
  const results = calcolaSals(appalto, partite, sals)
  const res = results.find((s) => s.numero === numero)
  const credito = res ? res.importoSal : 0
  const art = appalto.articoloCapitolato || ''
  const body = `
    <p class="prose">VISTO il contratto d'appalto per l'esecuzione dei lavori di <b>${orTodo(appalto.oggetto)}</b>${appalto.dataStipula ? `, stipulato in data ${escHtml(appalto.dataStipula)}` : ''};</p>
    <p class="prose">RISULTANDO dalla contabilità che i lavori e le somministrazioni eseguiti a tutto lo Stato di Avanzamento n. ${escHtml(String(numero))}${res?.data ? ` (${escHtml(res.data)})` : ''} ammontano alle somme di seguito riportate;</p>

    <h2 class="sec-h">Determinazione del credito</h2>
    <table class="dtable"><tbody>
      <tr><td>Totale contabilizzato a tutto il SAL n. ${escHtml(String(numero))}</td><td class="num">${eur(res?.totaleContabilizzato ?? null)}</td></tr>
      <tr><td>a dedurre: ritenuta di garanzia 0,50%</td><td class="num">− ${eur(res?.ritenuta ?? null)}</td></tr>
      <tr><td>a dedurre: certificati / SAL precedenti</td><td class="num">− ${eur(res?.salPrecedenti ?? null)}</td></tr>
      <tr class="tot"><td>CREDITO dell'impresa (netto IVA)</td><td class="num">${eur(credito)}</td></tr>
      <tr><td>IVA ${pct(appalto.ivaPct == null ? 10 : appalto.ivaPct, 0)}</td><td class="num">${eur(res?.iva ?? null)}</td></tr>
      <tr class="sub"><td>TOTALE GENERALE (lordo)</td><td class="num">${eur(res?.totaleLordo ?? null)}</td></tr>
    </tbody></table>

    <p class="prose" style="margin-top:6mm">Il RUP, verificata la regolarità contributiva (DURC) dell'impresa esecutrice,
    <b>CERTIFICA</b> che ai termini dell'articolo ${orTodo(art)} del capitolato speciale d'appalto si può pagare all'impresa
    <b>${orTodo(appalto.impresa?.denominazione)}</b> la rata di <b>${eur(credito)}</b> oltre IVA.</p>
    <p class="prose"><i>Diconsi euro ${escHtml(importoInLettere(credito))} oltre IVA.</i></p>

    ${firmeHTML([{ ruolo: 'Il Responsabile Unico del Procedimento', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Certificato ${numero}`),
    title: `Certificato di Pagamento n. ${numero}`,
    sub: `per il pagamento della rata relativa al SAL n. ${numero}`,
    headMeta: [{ k: 'SAL', v: escHtml(String(numero)) }, { k: 'CIG', v: escHtml(appalto.cig || '—') }],
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 17 Allegato II.14 D.Lgs. 36/2023 — emesso dal RUP entro 7 giorni dal SAL, previa verifica DURC.', page: `Certificato ${numero}` },
    docTitle: `Certificato di Pagamento n. ${numero}`,
  })
}
