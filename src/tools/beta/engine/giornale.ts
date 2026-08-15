/**
 * β Contabilità — GIORNALE DEI LAVORI (art. 12, All. II.14). Annotazioni giornaliere:
 * ordine e progressione delle lavorazioni, manodopera e mezzi impiegati,
 * provviste, circostanze rilevanti, ordini di servizio, sospensioni.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import type { Appalto, RigaGiornale } from './types'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi } from './doc-common'

export function giornaleHTML(appalto: Appalto, righe: RigaGiornale[]): string {
  const rows = (righe || []).length
    ? righe.map((r) => `<tr>
        <td class="code">${escHtml(r.data || '')}</td>
        <td>${escHtml(r.meteo || '')}</td>
        <td>${escHtml(r.manodopera || '')}</td>
        <td>${escHtml(r.mezzi || '')}</td>
        <td>${escHtml(r.lavorazioni || '')}${r.note ? `<span class="sub">${escHtml(r.note)}</span>` : ''}</td>
      </tr>`).join('')
    : '<tr class="empty"><td colspan="5">Nessuna annotazione registrata. Il giornale si compila progressivamente e contemporaneamente allo svolgersi delle attività in cantiere.</td></tr>'
  const body = `
    <p class="note">Giornale dei lavori — il Direttore dei Lavori (o l'assistente delegato) annota progressivamente le attività di cantiere, contemporaneamente al loro svolgersi.</p>
    <table class="dtable">
      <thead><tr><th>Data</th><th>Meteo</th><th>Manodopera</th><th>Mezzi / provviste</th><th>Lavorazioni e annotazioni</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Giornale'),
    title: 'Giornale dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 12 Allegato II.14 D.Lgs. 36/2023.', page: 'Giornale' },
    docTitle: `Giornale dei Lavori — ${appalto.oggetto || 'Lavori'}`,
  })
}
