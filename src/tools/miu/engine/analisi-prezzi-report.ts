/**
 * Report PDF dell'ANALISI PREZZI di μ Prezzi — gemello di `report.ts`
 * (computo/estratto voci): niente DOM, produce l'HTML stampabile completo via
 * il sistema documentale unificato (`renderDocPage`/DOC_CSS), la UI si limita
 * ad aprirlo e lanciare "Stampa/Salva PDF".
 */
import type { AnalisiPrezzi, AnalisiRiga, AnalisiTotali } from '../../../shared/compositore/analisi-prezzi'
import { calcolaAnalisi, incidenzaManodopera } from '../../../shared/compositore/analisi-prezzi'
import { renderDocPage, escHtml as esc, fmtDateTime as formatDate, type DocCompany } from '../../../shared/doc'

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const groupThousands = (intPart: string): string => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const numIt = (n: number): string => {
  const neg = n < 0
  const [int, dec] = Math.abs(round2(n)).toFixed(2).split('.')
  return (neg ? '-' : '') + groupThousands(int) + ',' + dec
}

const qtyIt = (n: number): string => {
  const neg = n < 0
  const s = Math.abs(n).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  const [int, dec] = s.split('.')
  return (neg ? '-' : '') + groupThousands(int) + (dec ? ',' + dec : '')
}

const TIPO_LABEL: Record<AnalisiRiga['tipo'], string> = {
  manodopera: 'Manodopera',
  materiale: 'Materiali',
  nolo: 'Noli',
  varie: 'Varie',
}

// lettere dello schema classico delle analisi nuovi prezzi (A..D)
const TIPO_LETTERA: Record<AnalisiRiga['tipo'], string> = {
  manodopera: 'A',
  materiale: 'B',
  nolo: 'C',
  varie: 'D',
}

// Righe di UNA sezione (A/B/C/D), da comporre dentro un'UNICA tabella per l'intera
// scomposizione — niente più una <table>+<thead> per sezione: il documento
// "Analisi Nuovi Prezzi" da capitolato è tradizionalmente una tabella continua
// con intestazioni di sezione a riga piena (tr.sec, già nel sistema documentale ε).
function sezioneRowsHTML(tipo: AnalisiRiga['tipo'], righe: AnalisiRiga[], subtotale: number): string {
  const rr = righe.filter((r) => r.tipo === tipo)
  if (!rr.length) return ''
  const rows = rr
    .map(
      (r) => `<tr>
      <td><b>${esc(r.descrizione)}</b>${r.fonte ? `<span class="sub">${esc(r.fonte.codice)} · ${esc(r.fonte.regione)} ${esc(r.fonte.anno)}</span>` : ''}</td>
      <td class="num">${esc(r.um)}</td>
      <td class="num">€ ${numIt(r.prezzoUnitario)}</td>
      <td class="num">${qtyIt(r.quantita)}</td>
      <td class="num">€ ${numIt(r.quantita * r.prezzoUnitario)}</td>
    </tr>`
    )
    .join('')
  return `<tr class="sec"><td colspan="5">${TIPO_LETTERA[tipo]} — ${esc(TIPO_LABEL[tipo])}</td></tr>
    ${rows}
    <tr class="tot"><td></td><td></td><td></td><td>Totale ${esc(TIPO_LABEL[tipo].toLowerCase())} (${TIPO_LETTERA[tipo]})</td><td class="num">€ ${numIt(subtotale)}</td></tr>`
}

function totaliHTML(a: AnalisiPrezzi, t: AnalisiTotali): string {
  const lettere = (['manodopera', 'materiale', 'nolo', 'varie'] as const)
    .filter((tipo) => a.righe.some((r) => r.tipo === tipo))
    .map((tipo) => TIPO_LETTERA[tipo])
  const somma = lettere.length ? lettere.join('+') : 'A+B+C+D'
  const incMO = incidenzaManodopera(t)
  return `<table class="dtable">
    <tbody>
      <tr class="tot"><td>Totale costi elementari (${somma})</td><td class="num">€ ${numIt(t.costoDiretto)}</td></tr>
      <tr><td>Spese Generali (${esc(String(a.speseGeneraliPct))}%)</td><td class="num">€ ${numIt(t.speseGenerali)}</td></tr>
      <tr class="tot"><td>Totale</td><td class="num">€ ${numIt(t.subtotale)}</td></tr>
      <tr><td>Utile d'Impresa (${esc(String(a.utileImpresaPct))}%)</td><td class="num">€ ${numIt(t.utileImpresa)}</td></tr>
      <tr class="tot"><td><b>Prezzo di applicazione (€/${esc(a.um)})</b></td><td class="num"><b>€ ${numIt(t.prezzoUnitario)}</b></td></tr>
      <tr><td>Incidenza manodopera</td><td class="num">${numIt(incMO)}%</td></tr>
    </tbody>
  </table>`
}

/** Corpo (chips + sezioni + quadro economico) di UNA analisi — riusato dal fascicolo. */
function analisiBodyHTML(a: AnalisiPrezzi, t: AnalisiTotali): string {
  const righeSezioni = (['manodopera', 'materiale', 'nolo', 'varie'] as const)
    .map((tipo) => sezioneRowsHTML(tipo, a.righe, tipo === 'manodopera' ? t.totManodopera : tipo === 'materiale' ? t.totMateriali : tipo === 'nolo' ? t.totNoli : t.totVarie))
    .join('')
  return `
    <div class="chips">
      <div class="chip"><b>${esc(a.codice)}</b><span>Codice</span></div>
      <div class="chip"><b>${esc(a.um)}</b><span>U.M.</span></div>
      <div class="chip"><b>${a.righe.length}</b><span>Righe</span></div>
      <div class="chip"><b>${numIt(incidenzaManodopera(t))}%</b><span>Manodopera</span></div>
    </div>
    <h2 class="sec-h" data-n="A-D">Scomposizione</h2>
    <table class="dtable">
      <thead><tr><th>Descrizione</th><th class="num">UM</th><th class="num">Prezzo</th><th class="num">Q.tà</th><th class="num">Importo</th></tr></thead>
      <tbody>${righeSezioni}</tbody>
    </table>
    <h2 class="sec-h" data-n="·">Quadro economico</h2>
    ${totaliHTML(a, t)}
    ${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}`
}

/** HTML stampabile completo (documento autonomo) per l'Analisi Prezzi. */
export function analisiPrezziHTML(a: AnalisiPrezzi, company?: DocCompany | null, now?: number | Date): string {
  const t = calcolaAnalisi(a)
  const body = analisiBodyHTML(a, t)

  return renderDocPage({
    tool: 'miu',
    company: company || undefined,
    kicker: 'Prezzi · Analisi Prezzi',
    title: `${a.codice} — ${a.descrizioneBreve}`,
    sub: a.descrizioneEstesa && a.descrizioneEstesa !== a.descrizioneBreve ? a.descrizioneEstesa : undefined,
    docTitle: `Analisi Prezzi ${a.codice}`,
    headMeta: [
      { k: 'Data', v: esc(formatDate(now)) },
      { k: 'U.M.', v: esc(a.um) },
      { k: 'Prezzo unitario', v: `€ ${numIt(t.prezzoUnitario)}` },
    ],
    bodyHTML: body,
    footer: {
      fields: [
        { k: 'Data', v: esc(formatDate(now)) },
        { k: 'Spese Generali', v: `${esc(String(a.speseGeneraliPct))}%` },
        { k: 'Utile d\'Impresa', v: `${esc(String(a.utileImpresaPct))}%` },
      ],
      disc: 'Analisi Prezzi: costo diretto (manodopera+materiali+noli+varie) + Spese Generali % + Utile d\'Impresa %. Elaborato non vincolante ai fini contrattuali.',
      page: 'Pag. 1',
    },
  })
}

/**
 * FASCICOLO Analisi Prezzi: UN documento (sistema documentale ε, stessa testata
 * e cartiglio degli altri PDF della suite) con l'indice in prima pagina e una
 * analisi per pagina (interruzione di stampa tra le analisi).
 */
export function fascicoloAnalisiHTML(analisi: AnalisiPrezzi[], company?: DocCompany | null, now?: number | Date): string {
  const calcolate = analisi.map((a) => ({ a, t: calcolaAnalisi(a) }))
  const indice = `<h2 class="sec-h" data-n="·">Indice delle analisi</h2>
  <table class="dtable">
    <thead><tr><th>N.</th><th>Codice</th><th>Descrizione</th><th class="num">U.M.</th><th class="num">Prezzo di applicazione</th></tr></thead>
    <tbody>${calcolate
      .map(({ a, t }, i) => `<tr><td>${i + 1}</td><td>${esc(a.codice || `AP${String(i + 1).padStart(2, '0')}`)}</td><td>${esc(a.descrizioneBreve)}</td><td class="num">${esc(a.um)}</td><td class="num">€ ${numIt(t.prezzoUnitario)}</td></tr>`)
      .join('')}
    </tbody>
  </table>`
  const corpo = calcolate
    .map(({ a, t }, i) => `<div style="page-break-before:always"></div>
    <h2 class="sec-h" data-n="${i + 1}">${esc(a.codice || `AP${String(i + 1).padStart(2, '0')}`)} — ${esc(a.descrizioneBreve)}</h2>
    ${analisiBodyHTML(a, t)}`)
    .join('')
  return renderDocPage({
    tool: 'miu',
    company: company || undefined,
    kicker: 'Prezzi · Fascicolo Analisi Prezzi',
    title: `Fascicolo Analisi Prezzi (${analisi.length})`,
    docTitle: 'Fascicolo Analisi Prezzi',
    headMeta: [
      { k: 'Data', v: esc(formatDate(now)) },
      { k: 'Analisi', v: String(analisi.length) },
    ],
    bodyHTML: indice + corpo,
    footer: {
      fields: [{ k: 'Data', v: esc(formatDate(now)) }, { k: 'Analisi', v: String(analisi.length) }],
      disc: "Analisi Prezzi: costi elementari (manodopera+materiali+noli+varie) + Spese Generali % + Utile d'Impresa %. Elaborato non vincolante ai fini contrattuali.",
    },
  })
}
