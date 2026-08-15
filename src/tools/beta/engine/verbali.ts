/**
 * β Contabilità — VERBALI E COMUNICAZIONI del Direttore dei Lavori. Atti che vivono IN
 * PARALLELO alla contabilità e con cui il DL dialoga con l'esecutore, il RUP e la
 * stazione appaltante (D.M. 49/2018 artt. 5, 13; D.Lgs. 36/2023 artt. 120-121 e
 * All. II.14). Sono atti pubblici datati: si collocano sulla cronologia di
 * cantiere e sono allegati obbligatori del conto finale.
 *
 * Tutti gli atti sono HTML stampabili resi in MODALITÀ ISTITUZIONALE (testata
 * dell'ente, niente brand Open E.Hub), come gli altri documenti di β.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import type { Appalto, Verbale, VerbaleTipo } from './types'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo } from './doc-common'

/** Etichetta leggibile dell'atto (timeline, editor, storico). */
export const VERBALE_LABEL: Record<VerbaleTipo, string> = {
  consegna: 'Verbale di consegna dei lavori',
  ordine: 'Ordine di servizio',
  sospensione: 'Verbale di sospensione dei lavori',
  ripresa: 'Verbale di ripresa dei lavori',
  nuoviprezzi: 'Verbale di concordamento nuovi prezzi',
  accertamento: 'Processo verbale di accertamento',
  ultimazione: 'Certificato di ultimazione dei lavori',
  relazioneRup: 'Relazione al RUP',
}

/** Riferimento normativo sintetico (badge della timeline). */
export const VERBALE_ART: Record<VerbaleTipo, string> = {
  consegna: 'All. II.14 art. 3',
  ordine: 'D.M. 49/2018',
  sospensione: 'art. 121 Codice',
  ripresa: 'art. 121 Codice',
  nuoviprezzi: 'art. 120 Codice',
  accertamento: 'D.M. 49/2018',
  ultimazione: 'All. II.14',
  relazioneRup: 'D.M. 49/2018',
}

/** Breve descrizione dell'atto (card della timeline). */
export const VERBALE_DESC: Record<VerbaleTipo, string> = {
  consegna: 'Presa in consegna del cantiere e stato dei luoghi.',
  ordine: 'Disposizione del DL all\'esecutore.',
  sospensione: 'Interruzione dei lavori: causa e durata.',
  ripresa: 'Ripresa dopo sospensione: giorni residui.',
  nuoviprezzi: 'Concordamento di prezzi non contrattuali.',
  accertamento: 'Verifica di fatti, prove o anomalie.',
  ultimazione: 'Attesta la fine dei lavori; precede il conto finale.',
  relazioneRup: 'Comunicazione del DL alla stazione appaltante.',
}

/** Ordine dei tipi nel selettore «+ Verbale/atto». */
export const VERBALE_TIPI: VerbaleTipo[] = ['consegna', 'ordine', 'sospensione', 'ripresa', 'nuoviprezzi', 'accertamento', 'ultimazione', 'relazioneRup']

/** Firme in calce, secondo l'atto (chi sottoscrive in contraddittorio). */
function firmeDi(tipo: VerbaleTipo, a: Appalto): string {
  const dl = { ruolo: 'Il Direttore dei Lavori', nome: a.direttoreLavori }
  const esec = { ruolo: "L'esecutore" }
  const esecPv = { ruolo: "L'esecutore (per presa visione)" }
  const rup = { ruolo: 'Il RUP', nome: a.rup }
  switch (tipo) {
    case 'consegna': return firmeHTML([dl, esec, rup])
    case 'sospensione': return firmeHTML([dl, esec, rup])
    case 'ripresa': return firmeHTML([dl, esec])
    case 'nuoviprezzi': return firmeHTML([dl, esec, rup])
    case 'ultimazione': return firmeHTML([dl, esec])
    case 'ordine': return firmeHTML([dl, esecPv])
    case 'accertamento': return firmeHTML([dl])
    case 'relazioneRup': return firmeHTML([dl])
  }
}

/** Riga (etichetta/valore) della tabella di testa dell'atto. */
const metaRow = (k: string, v: string): string => `<tr><td>${escHtml(k)}</td><td>${v}</td></tr>`

/** Corpo specifico per tipo: righe di meta + eventuali clausole standard. */
function corpoDi(v: Verbale): { meta: string; clausole: string } {
  const numGiorni = v.giorniDurata != null && Number.isFinite(v.giorniDurata) ? String(v.giorniDurata) : ''
  switch (v.tipo) {
    case 'consegna': {
      const mod = v.consegnaMod === 'parziale' ? 'consegna parziale' : v.consegnaMod === 'urgenza' ? 'consegna in via d\'urgenza (sotto le riserve di legge)' : 'consegna unica'
      return {
        meta: metaRow('Modalità di consegna', escHtml(mod)),
        clausole: `
          <h2 class="sec-h">Accertamenti in contraddittorio</h2>
          <ul class="prose">
            <li>l'area su cui devono eseguirsi i lavori è libera da persone e cose;</li>
            <li>sono stati verificati i tracciamenti e posizionati i capisaldi di riferimento;</li>
            <li>l'esecutore è stato riconosciuto idoneo a dare immediato inizio alle lavorazioni;</li>
            <li>sono state richiamate le condizioni e le circostanze speciali locali riconosciute.</li>
          </ul>
          <p class="prose">L'esecutore assume in consegna le aree e si obbliga a dare inizio ai lavori nei termini contrattuali, dandone comunicazione al Direttore dei Lavori.</p>`,
      }
    }
    case 'sospensione':
      return {
        meta: metaRow('Causa della sospensione', orTodo(v.motivo)) + (numGiorni ? metaRow('Durata stimata', `${escHtml(numGiorni)} giorni`) : ''),
        clausole: `<p class="prose">Il Direttore dei Lavori, ricorrendo le condizioni che impediscono la prosecuzione dei lavori a regola d'arte, ordina la sospensione dei lavori dalla data odierna, redigendo il presente verbale in contraddittorio con l'esecutore. Sono descritte lo stato di avanzamento, le opere la cui esecuzione resta interrotta e le cautele adottate.</p>`,
      }
    case 'ripresa':
      return {
        meta: numGiorni ? metaRow('Giorni residui contrattuali', `${escHtml(numGiorni)} giorni`) : '',
        clausole: `<p class="prose">Venute meno le cause che avevano determinato la sospensione, il Direttore dei Lavori dispone la ripresa dei lavori dalla data odierna. Il termine contrattuale è prorogato di un numero di giorni pari alla durata della sospensione.</p>`,
      }
    case 'nuoviprezzi':
      return {
        meta: '',
        clausole: `<p class="prose">Per l'esecuzione di lavorazioni non previste in contratto si concordano i nuovi prezzi in contraddittorio con l'esecutore, ricavati per assimilazione dai prezzi contrattuali o, in mancanza, da nuove analisi. I nuovi prezzi si intendono assoggettati al medesimo ribasso contrattuale e sono soggetti ad approvazione della stazione appaltante.</p>`,
      }
    case 'accertamento':
      return {
        meta: '',
        clausole: `<p class="prose">Il Direttore dei Lavori dà atto dei fatti, delle prove e delle verifiche di seguito descritte, redigendone processo verbale ai fini della documentazione dell'andamento dei lavori.</p>`,
      }
    case 'ultimazione':
      return {
        meta: '',
        clausole: `<p class="prose">Il Direttore dei Lavori, effettuati i necessari accertamenti in contraddittorio con l'esecutore, certifica che i lavori risultano ultimati alla data odierna. Da tale data decorrono i termini per la redazione del conto finale. Restano impregiudicati gli accertamenti in sede di collaudo/regolare esecuzione.</p>`,
      }
    case 'relazioneRup':
      return {
        meta: '',
        clausole: `<p class="prose">Il Direttore dei Lavori riferisce al Responsabile Unico del Progetto in ordine all'andamento dei lavori e alle circostanze rilevanti ai fini dell'esecuzione dell'appalto.</p>`,
      }
    default:
      return { meta: '', clausole: '' }
  }
}

/** Rende un verbale/comunicazione come atto istituzionale stampabile. */
export function verbaleHTML(appalto: Appalto, v: Verbale): string {
  const label = VERBALE_LABEL[v.tipo]
  const titolo = v.numero != null ? `${label} n. ${v.numero}` : label
  const { meta, clausole } = corpoDi(v)
  const testo = (v.testo && v.testo.trim())
    ? v.testo.trim().split(/\n{2,}|\n/).filter(Boolean).map((p) => `<p class="prose">${escHtml(p)}</p>`).join('')
    : ''
  const body = `
    <table class="dtable"><tbody>
      ${metaRow('Atto', escHtml(titolo))}
      ${metaRow('Data', orTodo(v.data))}
      ${v.oggetto ? metaRow('Oggetto', escHtml(v.oggetto)) : ''}
      ${meta}
    </tbody></table>
    ${v.oggetto || testo ? `<h2 class="sec-h">Oggetto e contenuto</h2>` : ''}
    ${v.oggetto ? `<p class="prose"><b>${escHtml(v.oggetto)}</b></p>` : ''}
    ${testo}
    ${clausole}
    ${firmeDi(v.tipo, appalto)}
  `
  return renderDocPage({
    tool: 'beta', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, label),
    title: titolo,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: `${VERBALE_ART[v.tipo]} — atto della direzione dei lavori, allegato al conto finale. Verificare il testo vigente del Codice dei contratti (D.Lgs. 36/2023).`, page: label },
    docTitle: `${titolo} — ${appalto.oggetto || 'Lavori'}`,
  })
}

/** Factory: nuovo verbale con id e numero progressivo per tipo. */
export function nuovoVerbale(tipo: VerbaleTipo, data: string, esistenti: Verbale[], id: string): Verbale {
  const numero = esistenti.filter((x) => x.tipo === tipo).length + 1
  const v: Verbale = { id, tipo, data, numero }
  if (tipo === 'consegna') v.consegnaMod = 'unica'
  return v
}
