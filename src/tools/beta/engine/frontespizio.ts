/**
 * β Contabilità — COPERTINA / frontespizio personalizzato dell'appalto. Atto di
 * apertura del fascicolo contabile: testata dell'ente, oggetto, CUP/CIG, parti,
 * quadro economico. Nessun brand Open E.Hub.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pct } from '../../../shared/format'
import type { Appalto, Partita } from './types'
import { ribassoPct, totaleContrattuale, totaleContrattualeLavori } from './contabilita'
import { enteDi, footerFieldsDi, kickerDi, firmeHTML, orTodo } from './doc-common'

const kv = (k: string, v: string): string => `<div class="kv"><span>${escHtml(k)}</span><b>${v}</b></div>`

export function frontespizioHTML(appalto: Appalto, partite: Partita[]): string {
  const rib = appalto.ribassoPct != null ? appalto.ribassoPct : ribassoPct(appalto.baseAsta, appalto.importoOfferta)
  const lavori = totaleContrattualeLavori(partite)
  const totale = totaleContrattuale(appalto, partite)
  const parti = `
    <div class="bt-parti">
      <div class="bt-parte">
        <div class="bt-parte__ruolo">Stazione appaltante</div>
        <div class="bt-parte__nome">${orTodo(appalto.ente?.denominazione)}</div>
        ${appalto.ente?.indirizzo ? `<div class="bt-parte__riga">${escHtml(appalto.ente.indirizzo)}</div>` : ''}
        ${appalto.ente?.codiceFiscale ? `<div class="bt-parte__riga">C.F. ${escHtml(appalto.ente.codiceFiscale)}</div>` : ''}
      </div>
      <div class="bt-parte">
        <div class="bt-parte__ruolo">Impresa esecutrice</div>
        <div class="bt-parte__nome">${orTodo(appalto.impresa?.denominazione)}</div>
        ${appalto.impresa?.indirizzo ? `<div class="bt-parte__riga">${escHtml(appalto.impresa.indirizzo)}</div>` : ''}
        ${appalto.impresa?.partitaIva ? `<div class="bt-parte__riga">P.IVA ${escHtml(appalto.impresa.partitaIva)}</div>` : ''}
      </div>
    </div>`

  const modalitaLabel = appalto.modalita === 'misto' ? 'a misura e a corpo (misto)' : `a ${appalto.modalita}`
  const qe = `
    <h2 class="sec-h">Quadro economico dell'appalto</h2>
    <div class="kvgrid">
      ${kv('Importo a base d\'asta', eur(appalto.baseAsta))}
      ${kv('Importo offerto (ribassato)', eur(appalto.importoOfferta))}
      ${kv('Ribasso', rib == null ? '—' : pct(rib))}
      ${kv('Lavori a misura', eur(lavori.misura))}
      ${kv('Lavori a corpo', eur(lavori.corpo))}
      ${kv('Oneri per la sicurezza', eur(appalto.oneriSicurezza))}
      ${kv('Totale contrattuale', eur(totale))}
      ${kv('Contabilizzazione', escHtml(modalitaLabel))}
    </div>`

  const body = `
    <p class="note">Fascicolo della contabilità dei lavori ai sensi del D.Lgs. 36/2023 (Allegato II.14). Tutti gli importi sono al netto di IVA salvo diversa indicazione.</p>
    <h2 class="sec-h">Oggetto</h2>
    <p class="prose">${orTodo(appalto.oggetto)}</p>
    <h2 class="sec-h">Parti</h2>
    ${parti}
    ${qe}
    ${firmeHTML([{ ruolo: 'Il Direttore dei Lavori', nome: appalto.direttoreLavori }, { ruolo: 'Il RUP', nome: appalto.rup }])}
  `

  return renderDocPage({
    tool: 'beta',
    brand: 'none',
    enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Copertina'),
    title: 'Contabilità dei lavori',
    sub: appalto.oggetto || undefined,
    headMeta: [{ k: 'CUP', v: escHtml(appalto.cup || '—') }, { k: 'CIG', v: escHtml(appalto.cig || '—') }],
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Fascicolo della contabilità dei lavori · gli importi contabili sono al netto di IVA.', page: 'Copertina' },
    docTitle: `Contabilità — ${appalto.oggetto || 'Lavori'}`,
  })
}
