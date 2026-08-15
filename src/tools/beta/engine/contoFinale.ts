/**
 * β Contabilità — CONTO FINALE + RELAZIONE FINALE (art. 18, All. II.14). Compilati dal
 * Direttore dei Lavori dopo l'ultimazione: importi finali complessivi, credito
 * residuo dell'impresa; la relazione descrive le vicende dell'esecuzione e il
 * giudizio motivato sulle domande (riserve) non transatte.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto, Partita, Sal, Riserva, Verbale, ListaEconomia } from './types'
import { calcolaSals, totaleContrattuale } from './contabilita'
import { importoInLettere } from './certificato'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo } from './doc-common'
import { VERBALE_LABEL } from './verbali'

export function contoFinaleHTML(appalto: Appalto, partite: Partita[], sals: Sal[], verbali?: Verbale[], liste?: ListaEconomia[]): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const totContab = ultimo ? ultimo.totaleContabilizzato : 0
  const ritenuta = ultimo ? ultimo.ritenuta : 0
  const giaPagato = ultimo ? ultimo.salPrecedenti : 0
  const creditoResiduo = ultimo ? ultimo.importoSal : 0
  const contrattuale = totaleContrattuale(appalto, partite)
  // Gate SOFT: il conto finale presuppone il certificato di ultimazione (da cui
  // decorrono i termini). Se manca, si avvisa ma il documento resta producibile.
  const haUltimazione = (verbali || []).some((v) => v.tipo === 'ultimazione')
  const avviso = haUltimazione ? '' : `<p class="note" style="border-left-color:#b02a7a">Avviso: non risulta redatto il <b>certificato di ultimazione dei lavori</b>, dal quale decorrono i termini per il conto finale. Redigerlo dalla timeline prima di trasmettere il conto finale.</p>`
  const body = `
    ${avviso}
    <p class="note">Conto finale dei lavori — compilato dopo l'ultimazione e sottoscritto dall'impresa esecutrice. Importi al netto di IVA.</p>
    <h2 class="sec-h">Riepilogo finale</h2>
    <table class="dtable"><tbody>
      <tr><td>Importo contrattuale dell'appalto</td><td class="num">${eur(contrattuale)}</td></tr>
      <tr><td>Totale lavori contabilizzati a fine lavori</td><td class="num">${eur(totContab)}</td></tr>
      <tr><td>a dedurre: ritenuta di garanzia 0,50% (svincolo a collaudo)</td><td class="num">− ${eur(ritenuta)}</td></tr>
      <tr><td>a dedurre: già pagato con i SAL/certificati precedenti</td><td class="num">− ${eur(giaPagato)}</td></tr>
      <tr class="tot"><td>CREDITO RESIDUO dell'impresa (netto IVA)</td><td class="num">${eur(creditoResiduo)}</td></tr>
    </tbody></table>
    <p class="prose"><i>Diconsi euro ${escHtml(importoInLettere(creditoResiduo))} oltre IVA.</i></p>
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: "L'impresa esecutrice" }, { ruolo: 'Il RUP', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Conto finale'),
    title: 'Conto Finale dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 18 Allegato II.14 D.Lgs. 36/2023. La ritenuta di garanzia si svincola in sede di conto finale/collaudo, previo DURC regolare.', page: 'Conto finale' },
    docTitle: `Conto Finale — ${appalto.oggetto || 'Lavori'}`,
  })
}

export function relazioneFinaleHTML(appalto: Appalto, partite: Partita[], sals: Sal[], riserve?: Riserva[], testo?: string, verbali?: Verbale[], liste?: ListaEconomia[]): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const nSal = results.length
  // Allegati obbligatori: i verbali/comunicazioni prodotti in corso d'opera, in ordine di data.
  const atti = [...(verbali || [])].sort((x, y) => (x.data || '').split('/').reverse().join('').localeCompare((y.data || '').split('/').reverse().join('')))
  const allegatiTxt = atti.length
    ? `<ul class="excl">${atti.map((v) => `<li>${escHtml(VERBALE_LABEL[v.tipo])}${v.numero != null ? ` n. ${escHtml(String(v.numero))}` : ''}${v.data ? ` del ${escHtml(v.data)}` : ''}${v.oggetto ? ` — ${escHtml(v.oggetto)}` : ''}</li>`).join('')}</ul>`
    : '<p class="prose">Nessun verbale o comunicazione registrato in corso d\'opera.</p>'
  const riserveTxt = (riserve && riserve.length)
    ? `<ul class="excl">${riserve.map((r) => `<li>Riserva n. ${escHtml(String(r.numero))}${r.importo != null ? ` (${eur(r.importo)})` : ''}: ${escHtml(r.oggetto)} — ${r.controdeduzioni ? escHtml(r.controdeduzioni) : 'giudizio del DL da formulare'}</li>`).join('')}</ul>`
    : '<p class="prose">Alla data della presente relazione non risultano riserve non transatte.</p>'
  // Testo delle vicende: editato dal DL (paragrafi separati da a-capo) o, se assente, sintesi automatica.
  const vicende = (testo && testo.trim())
    ? testo.trim().split(/\n{2,}|\n/).filter(Boolean).map((p) => `<p class="prose">${escHtml(p)}</p>`).join('')
    : `<p class="prose">I lavori di <b>${orTodo(appalto.oggetto)}</b> si sono svolti sotto la direzione del sottoscritto Direttore dei Lavori. Nel corso dell'appalto sono stati emessi ${escHtml(String(nSal))} stati di avanzamento. ${appalto.dataStipula ? `Contratto stipulato in data ${escHtml(appalto.dataStipula)}.` : ''}</p>`
  const body = `
    <h2 class="sec-h">Vicende dell'esecuzione</h2>
    ${vicende}
    <h2 class="sec-h">Giudizio sulle domande dell'esecutore (riserve)</h2>
    ${riserveTxt}
    <h2 class="sec-h">Allegati al conto finale</h2>
    ${allegatiTxt}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Relazione finale'),
    title: 'Relazione Finale del Direttore dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 18 Allegato II.14 D.Lgs. 36/2023 — allegata al conto finale.', page: 'Relazione finale' },
    docTitle: `Relazione Finale — ${appalto.oggetto || 'Lavori'}`,
  })
}
