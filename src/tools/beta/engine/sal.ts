/**
 * β Contabilità — STATO DI AVANZAMENTO LAVORI (art. 16, All. II.14). Riepiloga le
 * lavorazioni eseguite dall'inizio dell'appalto a tutto il SAL e ne ricava
 * l'importo del presente stato: cascata acconto − ritenuta 0,5% − SAL precedenti.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { calcolaSals, type SalResult } from './contabilita'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML } from './doc-common'

const rigaKv = (k: string, v: string, cls = ''): string => `<tr class="${cls}"><td>${escHtml(k)}</td><td class="num">${v}</td></tr>`

/** Tabella riepilogo per partita (descrizione · progressivo · importo eseguito). */
function dettaglioHTML(res: SalResult): string {
  const rows = res.righe.filter((r) => r.eseguito > 0 || r.progressivo != null).map((r) => `<tr>
      <td class="code">${escHtml(r.partita.codice)}</td>
      <td>${escHtml(r.partita.descrizione)}<span class="sub">${r.partita.modalita === 'corpo' ? 'a corpo' : 'a misura'}</span></td>
      <td class="num">${r.progressivo == null ? '—' : (r.partita.modalita === 'corpo' ? pct(r.progressivo, 1) : r.progressivo)}</td>
      <td class="num">${eur(r.eseguito)}</td>
    </tr>`).join('')
  if (!rows) return '<p class="note"><i>Nessuna lavorazione eseguita registrata per questo SAL.</i></p>'
  return `<table class="dtable">
    <thead><tr><th>Codice</th><th>Designazione</th><th class="num">% / Qtà</th><th class="num">Importo a tutto il SAL</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function salHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const res = results.find((s) => s.numero === numero)
  if (!res) {
    return renderDocPage({
      tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
      kicker: kickerDi(appalto, `SAL ${numero}`), title: `Stato di Avanzamento Lavori n. ${numero}`,
      bodyHTML: '<p class="note">SAL non trovato.</p>',
      footer: { fields: footerFieldsDi(appalto), disc: '', page: `SAL ${numero}` },
    })
  }
  const cascata = `
    <h2 class="sec-h">Determinazione dell'importo del SAL</h2>
    <table class="dtable">
      <tbody>
        ${rigaKv('Lavori a misura eseguiti a tutto il SAL', eur(res.lavoriMisura))}
        ${rigaKv('Lavori a corpo eseguiti a tutto il SAL', eur(res.lavoriCorpo))}
        ${res.lavoriEconomia ? rigaKv('Lavori in economia a tutto il SAL', eur(res.lavoriEconomia)) : ''}
        ${rigaKv('Oneri per la sicurezza (quota di avanzamento)', eur(res.oneriSicurezzaEseguiti))}
        ${rigaKv('Totale eseguito a tutto il SAL', eur(res.totaleEseguito), 'sub')}
        ${res.detrazioni ? rigaKv('a dedurre: detrazioni per lavorazioni non conformi', '− ' + eur(res.detrazioni)) : ''}
        ${rigaKv('Totale contabilizzato (conforme)', eur(res.totaleContabilizzato), 'sub')}
        ${rigaKv('a dedurre: ritenuta di garanzia 0,50% (art. 125)', '− ' + eur(res.ritenuta))}
        ${rigaKv('Netto progressivo a tutto il SAL', eur(res.nettoProgressivo), 'sub')}
        ${rigaKv('a dedurre: importo dei SAL precedenti', '− ' + eur(res.salPrecedenti))}
        ${rigaKv('IMPORTO DEL PRESENTE SAL (netto IVA)', eur(res.importoSal), 'tot')}
      </tbody>
    </table>
    <div class="kvgrid" style="margin-top:5mm">
      <div class="kv"><span>IVA ${pct(appalto.ivaPct == null ? 10 : appalto.ivaPct, 0)} (informativa)</span><b>${eur(res.iva)}</b></div>
      <div class="kv"><span>Totale lordo del SAL (informativo)</span><b>${eur(res.totaleLordo)}</b></div>
    </div>`

  const body = `
    <p class="note">Stato di avanzamento dei lavori eseguiti dal principio dell'appalto a tutto il SAL n. ${escHtml(String(res.numero))}${res.data ? ` (${escHtml(res.data)})` : ''}. Importi al netto di IVA.</p>
    <h2 class="sec-h">Riepilogo delle lavorazioni</h2>
    ${dettaglioHTML(res)}
    ${cascata}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: 'Il RUP', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `SAL ${res.numero}`),
    title: `Stato di Avanzamento Lavori n. ${res.numero}`,
    sub: res.data ? `Lavori a tutto il ${res.data}` : undefined,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 16 Allegato II.14 D.Lgs. 36/2023. Ritenuta di garanzia 0,50% (art. 125). Importi al netto di IVA.', page: `SAL ${res.numero}` },
    docTitle: `SAL n. ${res.numero} — ${appalto.oggetto || 'Lavori'}`,
  })
}
