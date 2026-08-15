/* β Contabilità — shell del tool. Contabilità dei lavori pubblici che EVOLVE nel tempo:
   il workspace è una cronologia di cantiere. A sinistra si avanza nei giorni e si
   tengono anagrafica e computo; al centro la catena documentale come timeline di
   schede datate; a destra lo storico dei documenti prodotti.
   Le schede APRONO UN EDITOR: solo il primo libretto delle misure è generato in
   automatico dal computo, gli altri atti si editano durante il cantiere. Engine
   puro in ./engine/. */
import { sendToHub, onHubMessage, loadXLSX, loadJSZip, bindThemeShortcut, applySuiteAesthetics, type HubToTool } from '../../shared'
import { htmlDocToSimpleDoc, buildSimpleDocxParts, DOCX_MIME, buildOdtParts, ODT_MIME, ODT_MIMETYPE_ENTRY } from '../../shared/doc'
import { bindGuideShortcut, toggleGuide } from '../../shared/ui/components'
import { registerGuide } from '../../shared/ui/guide'
import { BETA_GUIDE } from './data/guida'
import { calcolaRigaMisurazione, sommaMisurazioni, type MisurazioneRiga } from '../../shared/compositore/misurazioni'
import { initAnalytics } from '../../shared/analytics'
import {
  importaComputo, ribassoPct, totaleContrattuale, totaleContrattualeLavori, importoContrattualePartita,
  eseguitoPartita, calcolaSals, voceVisibileInSal, voceSoppressaInSal,
  frontespizioHTML, giornaleHTML, librettoHTML, registroHTML, sommarioHTML, salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML,
  verbaleHTML, nuovoVerbale, VERBALE_LABEL, VERBALE_ART, VERBALE_DESC, VERBALE_TIPI,
  listaEconomiaHTML, nuovaLista, valorizzaLista,
  salAOA, registroAOA, sommarioAOA, aoaColWidths,
} from './engine'
import type { Appalto, Partita, Sal, RigaSal, RigaGiornale, Riserva, Consegna, StatoBeta, Modalita, Verbale, VerbaleTipo, ListaEconomia, RigaOperaio, RigaMezzo, RigaProvvista } from './engine'
import type { VoceImport } from './engine/import'

initAnalytics()

const DRAFT_KEY = 'beta:draft:v1'

interface MiuCart { name?: string; items?: VoceImport[] }
interface State {
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  giornale: RigaGiornale[]
  riserve: Riserva[]
  relazione: string
  verbali: Verbale[]
  economia: ListaEconomia[]
  consegne: Consegna[]
  dataCorrenteISO: string
  miuCart: MiuCart | null
  importMode: Modalita
  editor: { fase: string; tipo: string } | null
}

const emptyAppalto = (): Appalto => ({ oggetto: '', ente: { denominazione: '' }, impresa: { denominazione: '' }, modalita: 'misura', ivaPct: 10 })

/* ── Date: modello del tempo (ISO interno yyyy-mm-dd ↔ display gg/mm/aaaa) ── */
const pad = (n: number): string => String(n).padStart(2, '0')
function todayISO(): string { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function isoToIt(iso?: string | null): string { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d && m && y ? `${d}/${m}/${y}` : '' }
function itToISO(it?: string | null): string | null { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((it || '').trim()); return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null }
function addDaysISO(iso: string, n: number): string { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` }

const S: State = {
  appalto: emptyAppalto(), partite: [], sals: [], giornale: [], riserve: [], relazione: '', verbali: [], economia: [], consegne: [],
  dataCorrenteISO: todayISO(), miuCart: null, importMode: 'misura', editor: null,
}

/* ── Utility ── */
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const eur = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const pctFmt = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + '%')
const numFmt = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 3 }))
/** Voci del libretto espanse (misure di dettaglio visibili) — stato effimero dell'editor. */
const libExpanded = new Set<string>()
const uid = (): string => Math.random().toString(36).slice(2, 9)
const $ = (id: string): HTMLElement | null => document.getElementById(id)
const val = (id: string): string => ($(id) as HTMLInputElement | null)?.value ?? ''

let _toastT: number | undefined
function toast(msg: string, ms = 2800): void { const el = $('toast'); if (!el) return; el.textContent = msg; el.hidden = false; clearTimeout(_toastT); _toastT = window.setTimeout(() => { el.hidden = true }, ms) }

/* ── Tema ── */
function applyTheme(t: string): void { document.documentElement.setAttribute('data-theme', t); const b = $('btnTheme'); if (b) b.textContent = t === 'dark' ? '☀' : '☾' }
function toggleTheme(): void { const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark'; applyTheme(next); sendToHub({ type: 'app:theme', theme: next }) }

/* ── Bus ── */
onHubMessage((m: Record<string, unknown>) => {
  if (m.type === 'hub:set-theme') { applyTheme(m.theme as string); if (m.palette) document.documentElement.setAttribute('data-palette', m.palette as string) }
  applySuiteAesthetics(m as HubToTool)
  if (m.type === 'hub:project-state' && m.source === 'pricelist') { const proj = m.project as MiuCart | undefined; S.miuCart = proj && proj.items && proj.items.length ? proj : null }
  if (m.type === 'hub:collect-state') sendToHub({ type: 'app:full-state', appId: 'beta-contabilita', state: serialize() })
  if (m.type === 'hub:restore-state' && m.state) { hydrate(m.state as Partial<StatoBeta>); renderAll() }
})

/* ── Persistenza ── */
function serialize(): StatoBeta { return { v: 1, appalto: S.appalto, partite: S.partite, sals: S.sals, giornale: S.giornale, riserve: S.riserve, relazione: S.relazione, verbali: S.verbali, economia: S.economia, consegne: S.consegne } }
function hydrate(st: Partial<StatoBeta> | null): void {
  if (!st) return
  S.appalto = { ...emptyAppalto(), ...(st.appalto || {}) }
  S.partite = Array.isArray(st.partite) ? st.partite : []
  S.sals = Array.isArray(st.sals) ? st.sals : []
  S.giornale = Array.isArray(st.giornale) ? st.giornale : []
  S.riserve = Array.isArray(st.riserve) ? st.riserve : []
  S.relazione = typeof st.relazione === 'string' ? st.relazione : ''
  S.verbali = Array.isArray(st.verbali) ? st.verbali : []
  S.economia = Array.isArray(st.economia) ? st.economia : []
  S.consegne = Array.isArray(st.consegne) ? st.consegne : []
  S.importMode = S.appalto.modalita === 'corpo' ? 'corpo' : 'misura'
  S.dataCorrenteISO = itToISO(S.appalto.dataInizio) || S.dataCorrenteISO
}
/* Filosofia della suite: lo stato di lavoro vive SOLO nella
   sessione (RAM) + nel file di Progetto (.ehub, via collect-state/restore-state);
   NON viene persistito in localStorage. Così «Nuovo progetto» (che ricarica l'hub)
   riparte davvero da zero, senza far riemergere la contabilità di un altro lavoro.
   saveDraft resta come hook di modifica (no-op sulla persistenza). */
function saveDraft(): void { /* stato non persistito fuori sessione — vedi nota sopra */ }
/* All'avvio azzera l'eventuale residuo localStorage di sessioni/versioni precedenti
   (β prima salvava una bozza): niente contabilità di un altro progetto. */
function clearDraftResidue(): void { try { localStorage.removeItem(DRAFT_KEY) } catch { /* off */ } }

/* ── Catena documentale: fasi datate ────────────────────────────────────── */
interface DocDesc { tipo: string; label: string; art: string; desc: string; gen: () => string; needsPartite: boolean }
interface Fase { key: string; titolo: string; dataIt: string; salNumero?: number; docs: DocDesc[] }

/** Fase di un verbale/comunicazione del DL: evento datato con un solo atto. */
function verbaleFase(a: Appalto, v: Verbale): Fase {
  const titolo = `${VERBALE_LABEL[v.tipo]}${v.numero != null ? ` n. ${v.numero}` : ''}`
  return { key: `verb-${v.id}`, titolo, dataIt: v.data || '', docs: [
    { tipo: `verbale:${v.id}`, label: VERBALE_LABEL[v.tipo], art: VERBALE_ART[v.tipo], desc: VERBALE_DESC[v.tipo], needsPartite: false, gen: () => verbaleHTML(a, v) },
  ] }
}
function fasi(): Fase[] {
  const a = S.appalto
  const avvio: Fase = { key: 'avvio', titolo: 'Avvio dei lavori', dataIt: a.dataInizio || '', docs: [
    { tipo: 'copertina', label: 'Copertina', art: 'Frontespizio', desc: 'Ente, oggetto, parti, quadro economico.', needsPartite: false, gen: () => frontespizioHTML(a, S.partite) },
    { tipo: 'giornale', label: 'Giornale dei lavori', art: 'art. 12', desc: 'Diario di cantiere, da compilare.', needsPartite: false, gen: () => giornaleHTML(a, S.giornale) },
  ] }
  // Le fasi centrali — SAL e verbali — sono eventi DATATI, ordinati cronologicamente
  // (i non datati in coda). Avvio resta in testa, ultimazione/conto finale in coda.
  const mid: Fase[] = []
  for (const sal of S.sals) {
    const listeSal = S.economia.filter((l) => (l.salNumero ?? 1) === sal.numero)
    const listeDocs: DocDesc[] = listeSal.map((l) => ({
      tipo: `lista:${l.id}`, label: `Lista in economia n. ${l.numero ?? ''}`.trim(), art: 'art. 181', desc: 'Operai, mezzi e provviste su ordine del DL.', needsPartite: false, gen: () => listaEconomiaHTML(a, l),
    }))
    mid.push({ key: `sal-${sal.numero}`, titolo: `Stato di avanzamento n. ${sal.numero}`, dataIt: sal.data || '', salNumero: sal.numero, docs: [
      { tipo: 'libretto', label: 'Libretto delle misure', art: 'art. 13', desc: 'Quantità e prezzi eseguiti a tutto il SAL.', needsPartite: true, gen: () => librettoHTML(a, S.partite, sal, S.economia) },
      { tipo: 'registro', label: 'Registro di contabilità', art: 'art. 14', desc: 'Credito progressivo e riserve.', needsPartite: true, gen: () => registroHTML(a, S.partite, S.sals, S.riserve, S.economia) },
      { tipo: 'sommario', label: 'Sommario', art: 'art. 15', desc: 'Sintesi per categorie omogenee.', needsPartite: true, gen: () => sommarioHTML(a, S.partite, S.sals, sal.numero, S.economia) },
      { tipo: 'sal', label: `SAL n. ${sal.numero}`, art: 'art. 16', desc: 'Cascata dell\'importo, ritenuta 0,5%.', needsPartite: true, gen: () => salHTML(a, S.partite, S.sals, sal.numero, S.economia) },
      { tipo: 'certificato', label: 'Certificato di pagamento', art: 'art. 17', desc: 'Atto del RUP, credito in lettere.', needsPartite: true, gen: () => certificatoHTML(a, S.partite, S.sals, sal.numero) },
      ...listeDocs,
    ] })
  }
  for (const v of S.verbali) mid.push(verbaleFase(a, v))
  const sortKey = (f: Fase): string => itToISO(f.dataIt) || '9999-99-99'
  mid.sort((x, y) => sortKey(x).localeCompare(sortKey(y)))
  const chiusura: Fase = { key: 'chiusura', titolo: 'Ultimazione e conto finale', dataIt: '', docs: [
    { tipo: 'contofinale', label: 'Conto finale', art: 'art. 18', desc: 'Riepilogo finale e credito residuo.', needsPartite: true, gen: () => contoFinaleHTML(a, S.partite, S.sals, S.verbali, S.economia) },
    { tipo: 'relazione', label: 'Relazione finale', art: 'art. 18', desc: 'Vicende, riserve e allegati.', needsPartite: true, gen: () => relazioneFinaleHTML(a, S.partite, S.sals, S.riserve, S.relazione, S.verbali, S.economia) },
  ] }
  return [avvio, ...mid, chiusura]
}
function findDoc(faseKey: string, tipo: string): { f: Fase; d: DocDesc } | null {
  const f = fasi().find((x) => x.key === faseKey); if (!f) return null
  const d = f.docs.find((x) => x.tipo === tipo); if (!d) return null
  return { f, d }
}
function consegnaDi(tipo: string, salNumero?: number): Consegna | undefined { return S.consegne.find((c) => c.tipo === tipo && c.salNumero === salNumero) }
function salById(n?: number): Sal | undefined { return S.sals.find((s) => s.numero === n) }
function rigaFor(sal: Sal, pid: string): RigaSal { let r = sal.righe.find((x) => x.partitaId === pid); if (!r) { r = { partitaId: pid }; sal.righe.push(r) } return r }

/* ── Render: pannello sinistro ──────────────────────────────────────────── */
function renderLeft(): void {
  const a = S.appalto
  const app = $('bAppSummary')
  if (app) app.innerHTML = a.oggetto || a.ente.denominazione
    ? `<div class="b-sumtitle">${esc(a.oggetto || '(oggetto da inserire)')}</div><div class="b-muted">${esc(a.ente.denominazione || 'stazione appaltante da inserire')}</div>${a.cig ? `<div class="b-sumrow"><span>CIG</span><b>${esc(a.cig)}</b></div>` : ''}`
    : '<div class="b-muted">Nessun dato inserito. Comincia da «Dati appalto».</div>'
  const comp = $('bComputoSummary')
  if (comp) comp.innerHTML = !S.partite.length ? '<div class="b-muted">Nessun computo importato.</div>'
    : `<div class="b-sumrow"><span>Partite</span><b>${S.partite.length}</b></div><div class="b-sumrow"><span>Totale lavori</span><b>${eur(totaleContrattualeLavori(S.partite).totale)}</b></div>`
  const cur = $('bDataCorrente') as HTMLInputElement | null; if (cur) cur.value = isoToIt(S.dataCorrenteISO)
  const curCal = $('bDataCorrenteCal') as HTMLInputElement | null; if (curCal) curCal.value = S.dataCorrenteISO || ''
  const fl = $('bFasiList')
  if (fl) fl.innerHTML = fasi().map((f) => {
    const doneN = f.docs.filter((d) => consegnaDi(d.tipo, f.salNumero)).length
    return `<button class="b-fase-link${doneN > 0 && doneN === f.docs.length ? ' is-done' : ''}" onclick="scrollFase('${f.key}')"><span class="b-fase-link__dot"></span>${esc(f.titolo)}<span class="b-fase-link__d">${esc(f.dataIt || '—')}</span></button>`
  }).join('')
}

/* ── Render: timeline centrale ──────────────────────────────────────────── */
function faseStato(f: Fase): 'done' | 'current' | '' { const iso = itToISO(f.dataIt); if (!iso) return ''; return iso < S.dataCorrenteISO ? 'done' : iso === S.dataCorrenteISO ? 'current' : '' }
function renderTimeline(): void {
  const el = $('bTimeline'); if (!el) return
  el.innerHTML = fasi().map((f) => {
    const stato = faseStato(f)
    const cards = f.docs.map((d) => {
      const prodotto = !!consegnaDi(d.tipo, f.salNumero)
      const disabled = d.needsPartite && !S.partite.length
      return `<button class="b-card${prodotto ? ' is-done' : ''}" ${disabled ? 'disabled' : ''} onclick="openEditor('${f.key}','${d.tipo}')" title="Apri e modifica «${esc(d.label)}»">
        <span class="b-card__t">${esc(d.label)}<span class="b-card__art">${esc(d.art)}</span></span>
        <span class="b-card__d">${esc(d.desc)}</span>
        ${prodotto ? '<span class="b-card__done">✓ prodotto</span>' : '<span class="b-card__go">✎ Modifica</span>'}
      </button>`
    }).join('')
    const excel = f.salNumero != null ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportExcel('sal',${f.salNumero})">⬇ SAL .xlsx</button><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportExcel('sommario',${f.salNumero})">⬇ Sommario .xlsx</button></div>` : ''
    return `<div class="b-fase ${stato === 'done' ? 'is-done' : ''} ${stato === 'current' ? 'is-current' : ''}" id="fase-${f.key}"><span class="b-fase__node"></span>
      <div class="b-fase__h"><span class="b-fase__t">${esc(f.titolo)}</span>${f.dataIt ? `<span class="b-fase__date">${esc(f.dataIt)}</span>` : ''}${stato === 'current' ? '<span class="b-fase__badge">oggi</span>' : ''}</div>
      <div class="b-cards">${cards}</div>${excel}</div>`
  }).join('')
}
function scrollFase(key: string): void { $(`fase-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

/* ── Render: pannello destro (documenti prodotti) ───────────────────────── */
function renderConsegne(): void {
  const el = $('bConsegne'); if (!el) return
  if (!S.consegne.length) { el.innerHTML = '<div class="b-empty">Nessun documento ancora prodotto. Apri una scheda, compila e usa «Stampa».</div>'; return }
  el.innerHTML = [...S.consegne].sort((x, y) => y.ts - x.ts).map((c) => `<button class="b-consegna" onclick="riapri('${c.id}')" title="Riapri il documento"><span class="b-consegna__t">${esc(c.label)}</span><span class="b-consegna__m"><span>${esc(c.data || '—')}</span><span>${new Date(c.ts).toLocaleDateString('it-IT')}</span></span></button>`).join('')
}
function renderAll(): void { renderLeft(); renderTimeline(); renderConsegne(); saveDraft() }

/* ── Guida: sezione del manuale unico condiviso (apribile con F1) ─────────── */
function toggleGuida(): void { toggleGuide('beta') }

/* ── Modali generiche ───────────────────────────────────────────────────── */
function closeModal(): void { const h = $('bModalHost'); if (h) h.innerHTML = ''; S.editor = null }
function modal(inner: string, wide = false): void { const h = $('bModalHost'); if (!h) return; h.innerHTML = `<div class="ehb-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="ehb-modal ${wide ? 'b-modal-wide' : ''}" role="dialog" aria-modal="true">${inner}</div></div>` }
const fld = (label: string, v: string | number | null | undefined, oninput: string, type = 'text', ph = ''): string => `<label class="b-field"><span>${esc(label)}</span><input type="${type}" value="${esc(v == null ? '' : String(v))}" placeholder="${esc(ph)}" oninput="${oninput}"></label>`

/* ── Dati appalto ───────────────────────────────────────────────────────── */
function openDati(): void {
  const a = S.appalto
  const logoBox = a.ente.logo
    ? `<div class="b-logo"><img src="${esc(a.ente.logo)}" alt="logo"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="removeLogo()">Rimuovi logo</button></div>`
    : `<div class="b-logo"><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="pickLogo()">↥ Carica logo ente</button><span class="b-muted">Compare in testa a tutti i documenti.</span></div>`
  modal(`<div class="b-modal__h">Dati dell'appalto</div>
    <div class="b-modal__scroll">
    <div class="b-cols2">
      <fieldset class="b-fieldset"><legend>Stazione appaltante</legend>${logoBox}
        ${fld('Denominazione', a.ente.denominazione, "setEnte('denominazione',this.value)", 'text', 'Comune di …')}
        ${fld('Indirizzo', a.ente.indirizzo, "setEnte('indirizzo',this.value)")}
        ${fld('Codice fiscale', a.ente.codiceFiscale, "setEnte('codiceFiscale',this.value)")}</fieldset>
      <fieldset class="b-fieldset"><legend>Impresa esecutrice</legend>
        ${fld('Ragione sociale', a.impresa.denominazione, "setImpresa('denominazione',this.value)")}
        ${fld('Sede', a.impresa.indirizzo, "setImpresa('indirizzo',this.value)")}
        ${fld('P.IVA', a.impresa.partitaIva, "setImpresa('partitaIva',this.value)")}
        ${fld('C.F.', a.impresa.codiceFiscale, "setImpresa('codiceFiscale',this.value)")}</fieldset>
    </div>
    <fieldset class="b-fieldset"><legend>Appalto</legend><div class="b-grid">
      ${fld('Oggetto dei lavori', a.oggetto, "setApp('oggetto',this.value)")}
      ${fld('CUP', a.cup, "setApp('cup',this.value)")}${fld('CIG', a.cig, "setApp('cig',this.value)")}
      ${fld('RUP', a.rup, "setApp('rup',this.value)")}${fld('Direttore dei Lavori', a.direttoreLavori, "setApp('direttoreLavori',this.value)")}
      ${fld('Data consegna lavori', a.dataInizio, "setApp('dataInizio',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Data stipula', a.dataStipula, "setApp('dataStipula',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Art. capitolato (certificato)', a.articoloCapitolato, "setApp('articoloCapitolato',this.value)")}</div></fieldset>
    <fieldset class="b-fieldset"><legend>Economia (netto IVA)</legend><div class="b-grid">
      ${fld('Base d\'asta', a.baseAsta, "setAppNum('baseAsta',this.value)", 'number', '0,00')}
      ${fld('Importo offerto', a.importoOfferta, "setAppNum('importoOfferta',this.value)", 'number', '0,00')}
      ${fld('Ribasso % (opz.)', a.ribassoPct, "setAppNum('ribassoPct',this.value)", 'number', 'auto')}
      ${fld('Oneri sicurezza', a.oneriSicurezza, "setAppNum('oneriSicurezza',this.value)", 'number', '0,00')}
      ${fld('IVA %', a.ivaPct, "setAppNum('ivaPct',this.value)", 'number', '10')}</div>
      <div id="bDatiRiep" class="b-panel__body" style="margin-top:8px">${riepilogoHTML()}</div></fieldset>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal()">Fatto</button></div>`, true)
}
function riepilogoHTML(): string { const a = S.appalto; const rib = a.ribassoPct != null ? a.ribassoPct : ribassoPct(a.baseAsta, a.importoOfferta); return `<div class="b-sumrow"><span>Ribasso</span><b>${rib == null ? '—' : pctFmt(rib)}</b></div><div class="b-sumrow"><span>Totale contrattuale</span><b>${eur(totaleContrattuale(a, S.partite))}</b></div>` }
function refreshRiep(): void { const b = $('bDatiRiep'); if (b) b.innerHTML = riepilogoHTML() }
function setApp(f: keyof Appalto, v: string): void { (S.appalto as unknown as Record<string, string>)[f] = v; if (f === 'dataInizio') { const iso = itToISO(v); if (iso) S.dataCorrenteISO = iso } saveDraft(); renderLeft(); renderTimeline() }
function setAppNum(f: keyof Appalto, v: string): void { (S.appalto as unknown as Record<string, number | null>)[f] = v === '' ? null : Number(v); saveDraft(); refreshRiep(); renderLeft() }
function setEnte(f: string, v: string): void { (S.appalto.ente as unknown as Record<string, string>)[f] = v; saveDraft(); renderLeft() }
function setImpresa(f: string, v: string): void { (S.appalto.impresa as unknown as Record<string, string>)[f] = v; saveDraft() }
function pickLogo(): void { $('bLogoFile')?.click() }
function removeLogo(): void { delete S.appalto.ente.logo; saveDraft(); openDati() }
function onLogoFile(e: Event): void { const inp = e.target as HTMLInputElement; const file = inp.files && inp.files[0]; inp.value = ''; if (!file) return; const r = new FileReader(); r.onload = () => { S.appalto.ente.logo = String(r.result); saveDraft(); openDati(); toast('Logo caricato') }; r.readAsDataURL(file) }

/* ── Import del computo ─────────────────────────────────────────────────── */
function openImport(): void {
  const m = S.importMode
  modal(`<div class="b-modal__h">Importa il computo metrico</div>
    <p class="b-muted" style="margin:0 0 12px">Il computo diventa l'insieme delle partite contabili. A misura conserva le righe di misura; a corpo aggrega per categoria in corpi d'opera con le aliquote. Con l'import viene predisposto il <b>primo libretto</b>, già valorizzato dal computo.</p>
    <div class="b-import-mode">Contabilizza come:
      <label><input type="radio" name="bimp" value="misura"${m !== 'corpo' ? ' checked' : ''} onchange="setImportMode('misura')"> a misura</label>
      <label><input type="radio" name="bimp" value="corpo"${m === 'corpo' ? ' checked' : ''} onchange="setImportMode('corpo')"> a corpo</label></div>
    <div class="b-import-btns">
      <button class="ehb-btn" onclick="importMiu()" ${S.miuCart ? '' : 'disabled'}>μ Usa il computo corrente di μ Prezzi</button>
      ${S.partite.length ? '<button class="ehb-btn ehb-btn--ghost" onclick="svuotaComputo()">Svuota le partite importate</button>' : ''}</div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Chiudi</button></div>`)
}
function setImportMode(v: string): void { S.importMode = v === 'corpo' ? 'corpo' : 'misura'; S.appalto.modalita = S.importMode; saveDraft() }
/** Seed del PRIMO libretto: le quantità/quote del SAL 1 sono valorizzate dal computo. */
function seedPrimoLibretto(sal: Sal): void {
  sal.righe = S.partite.map((p) => p.modalita === 'corpo' ? { partitaId: p.id, quotaPct: 100 } : { partitaId: p.id, quantitaProgressiva: p.qtyProgetto ?? 0 })
}
function ingest(voci: VoceImport[], label: string): void {
  S.partite = importaComputo(voci, S.importMode)
  const sal1: Sal = { numero: 1, data: isoToIt(S.dataCorrenteISO), righe: [] }
  seedPrimoLibretto(sal1)
  S.sals = [sal1]
  saveDraft(); closeModal(); renderAll()
  toast(`${voci.length} voci importate ${label}. Primo libretto valorizzato dal computo.`)
}
function importMiu(): void { if (!S.miuCart || !S.miuCart.items?.length) { toast('Nessun computo μ disponibile'); return } ingest(S.miuCart.items, 'dal computo di μ') }
function svuotaComputo(): void { S.partite = []; S.sals = []; saveDraft(); closeModal(); renderAll() }

/* ── Tempo ──────────────────────────────────────────────────────────────── */
function avanzaGiorni(n: number): void { S.dataCorrenteISO = addDaysISO(S.dataCorrenteISO, n); renderLeft(); renderTimeline() }
/** Data corrente digitata a mano (gg/mm/aaaa). Ignora input incompleti/invalidi. */
function setDataCorrenteIt(v: string): void { const iso = itToISO(v); if (!iso) { renderLeft(); return } S.dataCorrenteISO = iso; renderLeft(); renderTimeline() }
/** Data corrente scelta dal calendario (input date nativo, formato ISO). */
function setDataCorrenteIso(v: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return; S.dataCorrenteISO = v; renderLeft(); renderTimeline() }
function nuovoSalOggi(): void {
  if (!S.partite.length) { toast('Importa prima il computo'); return }
  const n = S.sals.length ? Math.max(...S.sals.map((s) => s.numero)) + 1 : 1
  // I SAL successivi al primo si EDITANO: partono dalle quote del SAL precedente (progressive), da aggiornare.
  const prev = S.sals.find((s) => s.numero === n - 1)
  const righe: RigaSal[] = prev ? prev.righe.map((r) => ({ ...r })) : []
  S.sals.push({ numero: n, data: isoToIt(S.dataCorrenteISO), righe })
  saveDraft(); renderAll()
  toast(`Creato SAL n. ${n} al ${isoToIt(S.dataCorrenteISO)}. Aprilo dalla timeline per aggiornare gli avanzamenti.`)
}

/* ── Verbali e comunicazioni del DL ─────────────────────────────────────── */
function openNuovoVerbale(): void {
  const btns = VERBALE_TIPI.map((t) => `<button class="ehb-btn b-block" style="justify-content:flex-start;text-align:left" onclick="creaVerbale('${t}')"><b>${esc(VERBALE_LABEL[t])}</b><br><span class="b-muted" style="font-size:var(--fs-xs)">${esc(VERBALE_DESC[t])} · ${esc(VERBALE_ART[t])}</span></button>`).join('')
  modal(`<div class="b-modal__h">Nuovo verbale / atto del Direttore dei Lavori</div>
    <p class="b-muted" style="margin:0 0 12px">L'atto viene collocato alla data corrente (${esc(isoToIt(S.dataCorrenteISO) || '—')}); la modificherai nell'editor. Scegli il tipo:</p>
    <div style="display:grid;gap:8px">${btns}</div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button></div>`)
}
function creaVerbale(tipo: string): void {
  const t = tipo as VerbaleTipo
  const v = nuovoVerbale(t, isoToIt(S.dataCorrenteISO), S.verbali, uid())
  S.verbali.push(v)
  saveDraft(); renderAll()
  openEditor(`verb-${v.id}`, `verbale:${v.id}`)
}

/* ── Lavori in economia (liste settimanali) ─────────────────────────────── */
function creaLista(): void {
  if (!S.sals.length) { toast('Crea prima un SAL: la lista in economia confluisce nel SAL di competenza'); return }
  const salN = Math.max(...S.sals.map((s) => s.numero))
  const l = nuovaLista(salN, isoToIt(S.dataCorrenteISO), S.economia, uid())
  S.economia.push(l)
  saveDraft(); renderAll()
  openEditor(`sal-${salN}`, `lista:${l.id}`)
}

/* ── EDITOR dei documenti (le schede aprono qui) ────────────────────────── */
function openEditor(faseKey: string, tipo: string): void {
  const fd = findDoc(faseKey, tipo); if (!fd) return
  if (fd.d.needsPartite && !S.partite.length) { toast('Importa prima il computo (pannello sinistro → Importa computo)'); return }
  S.editor = { fase: faseKey, tipo }
  const foot = `<div class="b-modal__foot">
    <button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Chiudi</button>
    <button class="ehb-btn" onclick="anteprima()">Anteprima</button>
    <button class="ehb-btn ehb-btn--ghost" onclick="esportaEditabile('docx')" title="Esporta editabile per Word">Word (.docx)</button>
    <button class="ehb-btn ehb-btn--ghost" onclick="esportaEditabile('odt')" title="Esporta editabile per LibreOffice/OpenOffice">ODT (.odt)</button>
    <button class="ehb-btn ehb-btn--accent-soft" onclick="stampa()">⎙ Stampa · registra</button></div>`
  modal(`<div class="b-modal__h">${esc(fd.d.label)} <span class="b-muted" style="font-weight:400">— ${esc(fd.f.titolo)}${fd.f.dataIt ? ' · ' + esc(fd.f.dataIt) : ''}</span></div><div class="b-modal__scroll">${editorBody(fd.f, tipo)}</div>${foot}`, true)
}
function reopenEditor(): void { if (S.editor) openEditor(S.editor.fase, S.editor.tipo) }

function editorBody(f: Fase, tipo: string): string {
  if (tipo.startsWith('verbale:')) return editorVerbale(tipo.slice('verbale:'.length))
  if (tipo.startsWith('lista:')) return editorLista(tipo.slice('lista:'.length))
  if (tipo === 'copertina') return `<p class="b-muted">La copertina è composta automaticamente dai dati dell'appalto.</p><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="closeModal();openDati()">Modifica dati appalto</button>`
  if (tipo === 'giornale') return editorGiornale()
  if (tipo === 'libretto') return editorLibretto(f)
  if (tipo === 'registro') return editorRegistro()
  if (tipo === 'sal') return editorSal(f)
  if (tipo === 'certificato') return editorCertificato()
  if (tipo === 'relazione') return editorRelazione()
  if (tipo === 'sommario' || tipo === 'contofinale') return `<p class="b-muted">Documento derivato dagli atti a monte (partite, avanzamenti dei SAL${tipo === 'sommario' ? ', per categoria' : ''}). Usa «Anteprima» per verificarlo e «Stampa» per produrlo.</p>`
  return ''
}

/* Libretto — schermata tipo computo μ: misure di dettaglio L1×L2×H×n per voce
   (con edit veloce a voce chiusa), nuovi prezzi, e STORNO tracciato al posto
   della cancellazione (atti pubblici: niente abrasioni, si porta in detrazione). */
function editorLibretto(f: Fase): string {
  const sal = salById(f.salNumero); if (!sal) return ''
  const salN = sal.numero
  const visibili = S.partite.filter((p) => voceVisibileInSal(p, salN))
  const rows = visibili.map((p) => rigaLibrettoHTML(sal, p)).join('')
  const primo = salN === 1
  return `<p class="b-muted" style="margin:0 0 8px">Misure a tutto il SAL n. ${salN}. Apri «▸ misure» per il dettaglio L×L×H×n (le detrazioni sono righe negative). Le voci già contabilizzate non si cancellano: si <b>stornano</b> con traccia.</p>
    <div class="b-editrow">
      ${fld('Data del libretto (gg/mm/aaaa)', sal.data, `setSalData(${salN},this.value)`)}
      ${primo ? '<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="rigeneraDaComputo(' + salN + ')" title="Rigenera le quantità dal computo (solo primo libretto)">↻ Rigenera dal computo</button>' : ''}
    </div>
    <div class="b-tablewrap"><table class="b-etable"><thead><tr><th></th><th>Codice</th><th>Designazione</th><th>Prezzo unit.</th><th>Eseguito a tutto il SAL</th><th class="b-num">Importo</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="b-muted">Nessuna partita.</td></tr>'}</tbody></table></div>
    <fieldset class="b-fieldset" style="margin-top:12px"><legend>Aggiungi voce / nuovo prezzo</legend><div class="b-grid">
      <label class="b-field"><span>Codice</span><input id="bnv-cod" placeholder="NP.01"></label>
      <label class="b-field"><span>Descrizione</span><input id="bnv-desc" placeholder="Nuova lavorazione"></label>
      <label class="b-field"><span>U.M.</span><input id="bnv-um" placeholder="mq"></label>
      <label class="b-field"><span>Prezzo €</span><input id="bnv-prezzo" type="number" step="0.01" placeholder="0,00"></label>
      <label class="b-field"><span>Modalità</span><select id="bnv-mod"><option value="misura">a misura</option><option value="corpo">a corpo</option></select></label>
      <label class="b-field"><span>&nbsp;</span><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="addVoce(${salN})">＋ Aggiungi</button></label>
    </div></fieldset>`
}
/* Una voce nel libretto: riga principale (edit veloce) + eventuale dettaglio misure. */
function rigaLibrettoHTML(sal: Sal, p: Partita): string {
  const salN = sal.numero
  const r = sal.righe.find((x) => x.partitaId === p.id)
  // Voce soppressa: resta a verbale con lo storno, non è editabile (annullabile solo nel SAL che l'ha stornata).
  if (voceSoppressaInSal(p, salN)) {
    const annulla = p.soppressaSal === salN ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="annullaStorno('${p.id}')" title="Annulla lo storno fatto in questo SAL">↺ annulla</button>` : ''
    return `<tr class="b-row-storno"><td></td><td class="b-mono">${esc(p.codice)}</td><td><span class="b-desc-clamp" title="${esc(p.descrizione)}">${esc(p.descrizione)}</span><span class="b-muted" style="font-size:var(--fs-xs)"> · soppressa al SAL ${esc(String(p.soppressaSal))} (storno)</span></td><td class="b-muted">${eur(importoContrattualePartita(p))}</td><td class="b-muted"><i>stornata</i></td><td class="b-num">${eur(0)}</td><td>${annulla}</td></tr>`
  }
  const prezzo = p.modalita === 'corpo'
    ? `<span class="b-muted">${eur(importoContrattualePartita(p))}</span>`
    : `€ <input type="number" min="0" step="0.01" value="${p.prezzoUnitario ?? ''}" placeholder="prezzo" oninput="setPrezzo('${p.id}',this.value)" style="width:84px">`
  const hasMisure = !!(r?.misurazioni && r.misurazioni.length)
  const expanded = libExpanded.has(p.id)
  // Colonna "eseguito": quota % (a corpo) · quantità rapida (a misura senza dettaglio) · somma (a misura con dettaglio).
  let eseg: string
  let toggle = ''
  if (p.modalita === 'corpo') {
    eseg = `<input type="number" min="0" max="100" step="0.1" value="${r?.quotaPct ?? ''}" placeholder="%" oninput="setSalQuota(${salN},'${p.id}',this.value)" style="width:74px"> %`
  } else if (hasMisure) {
    eseg = `<span class="b-mono" id="bme-${p.id}">${numFmt(sommaMisurazioni(r!.misurazioni))}</span> ${esc(p.um || '')} <span class="b-muted" style="font-size:var(--fs-xs)">(da ${r!.misurazioni!.length} misure)</span>`
    toggle = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="toggleMisure('${p.id}')" title="${expanded ? 'Comprimi' : 'Apri'} le misure di dettaglio">${expanded ? '▾' : '▸'} misure</button>`
  } else {
    eseg = `<input type="number" min="0" step="0.01" value="${r?.quantitaProgressiva ?? ''}" placeholder="qtà" oninput="setSalQta(${salN},'${p.id}',this.value)" style="width:84px"> ${esc(p.um || '')} <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="dettagliaMisure(${salN},'${p.id}')" title="Passa alle misure di dettaglio L×L×H×n">▸ dettaglia</button>`
  }
  const main = `<tr><td class="b-num" style="color:var(--muted)">${toggle}</td><td class="b-mono">${esc(p.codice)}</td><td><span class="b-desc-clamp" title="${esc(p.descrizione)}">${esc(p.descrizione)}</span><span class="b-muted" style="font-size:var(--fs-xs)"> · ${p.modalita === 'corpo' ? 'a corpo' : 'a misura'}${(p.introdottaSal ?? 1) > 1 ? ` · nuovo prezzo (SAL ${p.introdottaSal})` : ''}</span></td><td>${prezzo}</td><td>${eseg}</td><td class="b-num" id="bmimp-${p.id}">${eur(eseguitoPartita(p, r, salN))}</td><td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delVoce('${p.id}',${salN})" title="Elimina / storna la voce">🗑</button></td></tr>`
  if (p.modalita !== 'corpo' && hasMisure && expanded) return main + misureDettaglioHTML(sal, p)
  return main
}
/* Sotto-riga a tutta larghezza: tabella delle misure L1×L2×H×n stile PriMus/μ. */
function misureDettaglioHTML(sal: Sal, p: Partita): string {
  const salN = sal.numero
  const r = sal.righe.find((x) => x.partitaId === p.id)
  const mis = r?.misurazioni || []
  const righe = mis.map((m, i) => `<tr class="${(m.quantita || 0) < 0 ? 'b-row-storno' : ''}">
      <td><input value="${esc(m.descrizione || '')}" placeholder="descrizione (es. piano terra)" oninput="setMisura(${salN},'${p.id}',${i},'descrizione',this.value)"></td>
      <td><input type="number" step="0.01" value="${m.l1 ?? ''}" placeholder="L1" oninput="setMisura(${salN},'${p.id}',${i},'l1',this.value)" style="width:64px"></td>
      <td><input type="number" step="0.01" value="${m.l2 ?? ''}" placeholder="L2" oninput="setMisura(${salN},'${p.id}',${i},'l2',this.value)" style="width:64px"></td>
      <td><input type="number" step="0.01" value="${m.h ?? ''}" placeholder="H/peso" oninput="setMisura(${salN},'${p.id}',${i},'h',this.value)" style="width:64px"></td>
      <td><input type="number" step="0.01" value="${m.n ?? ''}" placeholder="n" oninput="setMisura(${salN},'${p.id}',${i},'n',this.value)" style="width:56px"></td>
      <td class="b-num b-mono" id="bmq-${p.id}-${i}">${numFmt(m.quantita)}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delMisura(${salN},'${p.id}',${i})" title="Elimina la riga di misura">✕</button></td>
    </tr>`).join('')
  return `<tr class="b-misure-row"><td></td><td colspan="6">
    <div class="b-misure"><table class="b-etable b-etable--inner"><thead><tr><th>Designazione della misura</th><th>Lungh.</th><th>Largh.</th><th>H/peso</th><th>N.</th><th class="b-num">Quantità</th><th></th></tr></thead>
    <tbody>${righe || '<tr><td colspan="7" class="b-muted">Nessuna misura. Aggiungi una riga.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="5" class="b-num">Totale a tutto il SAL</td><td class="b-num b-mono" id="bmt-${p.id}">${numFmt(sommaMisurazioni(mis))} ${esc(p.um || '')}</td><td></td></tr></tfoot></table>
    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="addMisura(${salN},'${p.id}',false)">＋ riga di misura</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="addMisura(${salN},'${p.id}',true)" title="Riga di detrazione (quantità negativa)">− riga in detrazione</button>
    </div></div></td></tr>`
}
function editorSal(f: Fase): string {
  const res = calcolaSals(S.appalto, S.partite, S.sals).find((s) => s.numero === f.salNumero)
  const sal = salById(f.salNumero)
  if (!res || !sal) return ''
  const row = (k: string, v: string): string => `<div class="b-sumrow"><span>${esc(k)}</span><b>${v}</b></div>`
  return `<p class="b-muted">Gli avanzamenti si inseriscono nel <b>Libretto</b> di questo SAL. Qui si controlla la cascata e si annotano detrazioni e note.</p>
    <div class="b-editrow">${fld('Detrazioni non conformi €', sal.detrazioni, `setSalDetr(${sal.numero},this.value)`, 'number', '0,00')}</div>
    <div class="b-panel__body" id="bSalCasc">${row('Totale eseguito', eur(res.totaleEseguito)) + row('Detrazioni', '− ' + eur(res.detrazioni)) + row('Ritenuta 0,50%', '− ' + eur(res.ritenuta)) + row('SAL precedenti', '− ' + eur(res.salPrecedenti)) + '<div class="b-sumrow b-kv--tot"><span>Importo del SAL (netto IVA)</span><b>' + eur(res.importoSal) + '</b></div>'}</div>
    <label class="b-field" style="margin-top:10px"><span>Note del SAL</span><textarea rows="2" oninput="setSalNote(${sal.numero},this.value)" placeholder="Annotazioni facoltative">${esc(sal.note || '')}</textarea></label>`
}
function editorCertificato(): string {
  return `<p class="b-muted">Il certificato è emesso dal RUP e riprende il credito del SAL. Campi editabili:</p>
    ${fld('Art. del capitolato richiamato', S.appalto.articoloCapitolato, "setApp('articoloCapitolato',this.value)")}
    ${fld('Data stipula (per la formula)', S.appalto.dataStipula, "setApp('dataStipula',this.value)", 'text', 'gg/mm/aaaa')}
    <p class="b-muted" style="font-size:var(--fs-xs)">Gli importi (credito, ritenuta, IVA, importo in lettere) sono calcolati dal SAL di riferimento.</p>`
}
function editorGiornale(): string {
  const rows = S.giornale.map((g, i) => `<tr>
    <td><input value="${esc(g.data || '')}" placeholder="gg/mm" oninput="setGiornale(${i},'data',this.value)" style="width:80px"></td>
    <td><input value="${esc(g.meteo || '')}" placeholder="sereno" oninput="setGiornale(${i},'meteo',this.value)" style="width:90px"></td>
    <td><input value="${esc(g.manodopera || '')}" placeholder="n. operai" oninput="setGiornale(${i},'manodopera',this.value)"></td>
    <td><input value="${esc(g.mezzi || '')}" placeholder="mezzi/provviste" oninput="setGiornale(${i},'mezzi',this.value)"></td>
    <td><input value="${esc(g.lavorazioni || '')}" placeholder="lavorazioni del giorno" oninput="setGiornale(${i},'lavorazioni',this.value)"></td>
    <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delGiornale(${i})">✕</button></td></tr>`).join('')
  return `<div class="b-tablewrap"><table class="b-etable"><thead><tr><th>Data</th><th>Meteo</th><th>Manodopera</th><th>Mezzi/provviste</th><th>Lavorazioni</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="b-muted">Nessuna annotazione.</td></tr>'}</tbody></table></div>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:10px" onclick="addGiornale()">＋ Aggiungi giornata</button>`
}
function editorRegistro(): string {
  const rows = S.riserve.map((r, i) => `<tr>
    <td class="b-mono">${esc(String(r.numero))}</td>
    <td><input value="${esc(r.oggetto)}" placeholder="oggetto della riserva" oninput="setRiserva(${i},'oggetto',this.value)"></td>
    <td><input type="number" step="0.01" value="${r.importo ?? ''}" placeholder="€" oninput="setRiserva(${i},'importo',this.value)" style="width:100px"></td>
    <td><input type="number" value="${r.salNumero ?? ''}" placeholder="SAL" oninput="setRiserva(${i},'salNumero',this.value)" style="width:60px"></td>
    <td><input value="${esc(r.controdeduzioni || '')}" placeholder="deduzioni del DL" oninput="setRiserva(${i},'controdeduzioni',this.value)"></td>
    <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delRiserva(${i})">✕</button></td></tr>`).join('')
  return `<p class="b-muted">Il registro riporta il credito progressivo (calcolato dai libretti). Qui si iscrivono le <b>riserve</b> dell'esecutore e le deduzioni del DL.</p>
    <div class="b-tablewrap"><table class="b-etable"><thead><tr><th>N.</th><th>Oggetto</th><th>Importo</th><th>SAL</th><th>Deduzioni DL</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="b-muted">Nessuna riserva iscritta.</td></tr>'}</tbody></table></div>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:10px" onclick="addRiserva()">＋ Iscrivi riserva</button>`
}
function editorRelazione(): string { return `<label class="b-field"><span>Vicende dell'esecuzione (testo libero, un paragrafo per riga)</span><textarea rows="8" oninput="setRelazione(this.value)" placeholder="Descrizione dell'andamento dei lavori, sospensioni, proroghe, varianti…">${esc(S.relazione)}</textarea></label><p class="b-muted" style="font-size:var(--fs-xs)">Le riserve non transatte e i verbali prodotti (allegati) sono riportati automaticamente.</p>` }

/* Editor di un verbale/comunicazione del DL: campi comuni + campi per-tipo. */
function editorVerbale(id: string): string {
  const v = S.verbali.find((x) => x.id === id); if (!v) return `<p class="b-muted">Atto non trovato.</p>`
  const t = v.tipo
  let extra = ''
  if (t === 'consegna') {
    const opt = (val: string, lab: string): string => `<label style="margin-right:12px"><input type="radio" name="bvmod" value="${val}"${(v.consegnaMod || 'unica') === val ? ' checked' : ''} onchange="setVerb('${id}','consegnaMod',this.value)"> ${esc(lab)}</label>`
    extra = `<div class="b-import-mode" style="margin-top:4px">Modalità: ${opt('unica', 'unica')}${opt('parziale', 'parziale')}${opt('urgenza', "in via d'urgenza")}</div>`
  } else if (t === 'sospensione') {
    extra = `<div class="b-grid">${fld('Causa della sospensione', v.motivo, `setVerb('${id}','motivo',this.value)`, 'text', 'es. avverse condizioni meteo')}${fld('Durata stimata (giorni)', v.giorniDurata, `setVerb('${id}','giorniDurata',this.value)`, 'number', '0')}</div>`
  } else if (t === 'ripresa') {
    extra = `<div class="b-grid">${fld('Giorni residui contrattuali', v.giorniDurata, `setVerb('${id}','giorniDurata',this.value)`, 'number', '0')}</div>`
  }
  return `<div class="b-grid">
      ${fld('Data (gg/mm/aaaa)', v.data, `setVerb('${id}','data',this.value)`, 'text', 'gg/mm/aaaa')}
      ${fld('Numero', v.numero, `setVerb('${id}','numero',this.value)`, 'number', '1')}
    </div>
    ${fld('Oggetto dell\'atto', v.oggetto, `setVerb('${id}','oggetto',this.value)`, 'text', 'sintesi dell\'oggetto')}
    ${extra}
    <label class="b-field" style="margin-top:8px"><span>Contenuto (testo libero, un paragrafo per riga)</span><textarea rows="6" oninput="setVerb('${id}','testo',this.value)" placeholder="Descrizione dei fatti, disposizioni, accertamenti…">${esc(v.testo || '')}</textarea></label>
    <div style="margin-top:10px"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delVerbale('${id}')" title="Elimina l'atto">🗑 Elimina l'atto</button></div>`
}
function setVerb(id: string, campo: string, v: string): void {
  const atto = S.verbali.find((x) => x.id === id); if (!atto) return
  if (campo === 'numero' || campo === 'giorniDurata') (atto as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v)
  else (atto as unknown as Record<string, string>)[campo] = v
  saveDraft()
  if (campo === 'data' || campo === 'numero') { renderLeft(); renderTimeline() }
}
function delVerbale(id: string): void {
  S.verbali = S.verbali.filter((x) => x.id !== id)
  S.consegne = S.consegne.filter((c) => c.tipo !== `verbale:${id}`)
  saveDraft(); closeModal(); renderAll()
  toast('Atto eliminato')
}

/* ── Editor della lista in economia (operai · mezzi · provviste) ─────────── */
const impOperaio = (r: RigaOperaio): number => (r.ore || 0) * (r.tariffaOraria || 0)
const impMezzo = (r: RigaMezzo): number => (r.ore || 0) * (r.tariffaOraria || 0)
const impProvvista = (r: RigaProvvista): number => (r.quantita || 0) * (r.prezzoUnitario || 0)
function listaTotaliHTML(l: ListaEconomia): string {
  const v = valorizzaLista(l)
  const row = (k: string, x: string): string => `<div class="b-sumrow"><span>${esc(k)}</span><b>${x}</b></div>`
  return row('Mano d\'opera', eur(v.manodopera)) + row('Mezzi e noli', eur(v.noli)) + row('Provviste', eur(v.provviste)) + `<div class="b-sumrow b-kv--tot"><span>Totale in economia</span><b>${eur(v.totale)}</b></div>`
}
function editorLista(id: string): string {
  const l = S.economia.find((x) => x.id === id); if (!l) return '<p class="b-muted">Lista non trovata.</p>'
  const stornata = l.soppressaSal != null
  const operai = (l.operai || []).map((r, i) => `<tr>
      <td><input value="${esc(r.qualifica || '')}" placeholder="qualifica" oninput="setOperaio('${id}',${i},'qualifica',this.value)"></td>
      <td><input value="${esc(r.lavorazione || '')}" placeholder="lavorazione" oninput="setOperaio('${id}',${i},'lavorazione',this.value)"></td>
      <td><input type="number" step="0.5" value="${r.ore ?? ''}" placeholder="ore" oninput="setOperaio('${id}',${i},'ore',this.value)" style="width:70px"></td>
      <td>€ <input type="number" step="0.01" value="${r.tariffaOraria ?? ''}" placeholder="tariffa" oninput="setOperaio('${id}',${i},'tariffaOraria',this.value)" style="width:80px"></td>
      <td class="b-num" id="blo-${id}-${i}">${eur(impOperaio(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delOperaio('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const mezzi = (l.mezzi || []).map((r, i) => `<tr>
      <td><input value="${esc(r.descrizione || '')}" placeholder="mezzo / nolo" oninput="setMezzo('${id}',${i},'descrizione',this.value)"></td>
      <td><input type="number" step="0.5" value="${r.ore ?? ''}" placeholder="ore" oninput="setMezzo('${id}',${i},'ore',this.value)" style="width:70px"></td>
      <td>€ <input type="number" step="0.01" value="${r.tariffaOraria ?? ''}" placeholder="tariffa" oninput="setMezzo('${id}',${i},'tariffaOraria',this.value)" style="width:80px"></td>
      <td class="b-num" id="blm-${id}-${i}">${eur(impMezzo(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delMezzo('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const provviste = (l.provviste || []).map((r, i) => `<tr>
      <td><input value="${esc(r.descrizione || '')}" placeholder="provvista / materiale" oninput="setProvvista('${id}',${i},'descrizione',this.value)"></td>
      <td><input value="${esc(r.um || '')}" placeholder="u.m." oninput="setProvvista('${id}',${i},'um',this.value)" style="width:64px"></td>
      <td><input type="number" step="0.01" value="${r.quantita ?? ''}" placeholder="qtà" oninput="setProvvista('${id}',${i},'quantita',this.value)" style="width:80px"></td>
      <td>€ <input type="number" step="0.01" value="${r.prezzoUnitario ?? ''}" placeholder="prezzo" oninput="setProvvista('${id}',${i},'prezzoUnitario',this.value)" style="width:80px"></td>
      <td class="b-num" id="blp-${id}-${i}">${eur(impProvvista(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delProvvista('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const tbl = (head: string, rows: string, add: string, cols: number): string =>
    `<div class="b-tablewrap" style="margin-top:8px"><table class="b-etable"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="${cols}" class="b-muted">Nessuna riga.</td></tr>`}</tbody></table></div>${add}`
  return `${stornata ? `<p class="note" style="border-left-color:#b02a7a">Lista soppressa e portata in detrazione al SAL ${esc(String(l.soppressaSal))} (storno). <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="annullaStornoLista('${id}')">↺ annulla storno</button></p>` : ''}
    <div class="b-grid">
      ${fld('Settimana (gg/mm/aaaa)', l.data, `setLista('${id}','data',this.value)`, 'text', 'gg/mm/aaaa')}
      ${fld('SAL di competenza', l.salNumero, `setLista('${id}','salNumero',this.value)`, 'number', '1')}
      ${fld('Ordine di servizio (rif.)', l.ordineRef, `setLista('${id}','ordineRef',this.value)`, 'text', 'OdS n. …')}
    </div>
    <fieldset class="b-fieldset"><legend>Mano d'opera</legend>
      ${tbl('<tr><th>Qualifica</th><th>Lavorazione</th><th>Ore</th><th>Tariffa €/h</th><th class="b-num">Importo</th><th></th></tr>', operai, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addOperaio(\'' + id + '\')">＋ operaio</button>', 6)}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Mezzi d'opera e noli</legend>
      ${tbl('<tr><th>Mezzo / nolo</th><th>Ore</th><th>Tariffa €/h</th><th class="b-num">Importo</th><th></th></tr>', mezzi, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addMezzo(\'' + id + '\')">＋ mezzo / nolo</button>', 5)}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Provviste</legend>
      ${tbl('<tr><th>Provvista</th><th>U.M.</th><th>Quantità</th><th>Prezzo €</th><th class="b-num">Importo</th><th></th></tr>', provviste, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addProvvista(\'' + id + '\')">＋ provvista</button>', 6)}
    </fieldset>
    <div class="b-panel__body" id="bl-tot-${id}" style="margin-top:8px">${listaTotaliHTML(l)}</div>
    <label class="b-field" style="margin-top:8px"><span>Note</span><textarea rows="2" oninput="setLista('${id}','note',this.value)" placeholder="Annotazioni facoltative">${esc(l.note || '')}</textarea></label>
    <div style="margin-top:10px"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delLista('${id}')" title="Elimina / storna la lista">🗑 Elimina lista</button></div>`
}
function refreshListaTot(id: string): void { const l = S.economia.find((x) => x.id === id); const box = $(`bl-tot-${id}`); if (l && box) box.innerHTML = listaTotaliHTML(l); renderLeft(); renderTimeline() }
function setLista(id: string, campo: keyof ListaEconomia, v: string): void {
  const l = S.economia.find((x) => x.id === id); if (!l) return
  if (campo === 'salNumero') { l.salNumero = v === '' ? undefined : Number(v); if (S.editor) S.editor.fase = `sal-${l.salNumero}`; saveDraft(); renderAll(); reopenEditor(); return }
  ;(l as unknown as Record<string, string>)[campo] = v
  saveDraft()
  if (campo === 'data') { renderLeft(); renderTimeline() }
}
function addOperaio(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.operai.push({}); saveDraft(); reopenEditor() }
function addMezzo(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.mezzi.push({ descrizione: '' }); saveDraft(); reopenEditor() }
function addProvvista(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.provviste.push({ descrizione: '' }); saveDraft(); reopenEditor() }
function delOperaio(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.operai.splice(i, 1); saveDraft(); reopenEditor() }
function delMezzo(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.mezzi.splice(i, 1); saveDraft(); reopenEditor() }
function delProvvista(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.provviste.splice(i, 1); saveDraft(); reopenEditor() }
function setOperaio(id: string, i: number, campo: keyof RigaOperaio, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.operai[i]; if (!r) return
  if (campo === 'ore' || campo === 'tariffaOraria') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blo-${id}-${i}`); if (c) c.textContent = eur(impOperaio(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function setMezzo(id: string, i: number, campo: keyof RigaMezzo, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.mezzi[i]; if (!r) return
  if (campo === 'ore' || campo === 'tariffaOraria') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blm-${id}-${i}`); if (c) c.textContent = eur(impMezzo(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function setProvvista(id: string, i: number, campo: keyof RigaProvvista, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.provviste[i]; if (!r) return
  if (campo === 'quantita' || campo === 'prezzoUnitario') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blp-${id}-${i}`); if (c) c.textContent = eur(impProvvista(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function delLista(id: string): void {
  const l = S.economia.find((x) => x.id === id); if (!l) return
  const salN = l.salNumero ?? 1
  const prodotto = S.consegne.some((c) => c.tipo === 'libretto' && (c.salNumero ?? 0) >= salN)
  if (!prodotto) { S.economia = S.economia.filter((x) => x.id !== id); saveDraft(); closeModal(); renderAll(); toast('Lista eliminata (non ancora contabilizzata)') }
  else { l.soppressaSal = salN; saveDraft(); renderAll(); reopenEditor(); toast(`Lista soppressa e portata in detrazione al SAL ${salN} (storno): resta a verbale`) }
}
function annullaStornoLista(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; delete l.soppressaSal; saveDraft(); renderAll(); reopenEditor(); toast('Storno annullato') }

/* ── Setter dell'editor ─────────────────────────────────────────────────── */
function setSalQta(n: number, pid: string, v: string): void { const s = salById(n); if (!s) return; rigaFor(s, pid).quantitaProgressiva = v === '' ? null : Number(v); saveDraft(); refreshCascata(n) }
function setSalQuota(n: number, pid: string, v: string): void { const s = salById(n); if (!s) return; rigaFor(s, pid).quotaPct = v === '' ? null : Math.max(0, Math.min(100, Number(v))); saveDraft(); refreshCascata(n) }
function setPrezzo(pid: string, v: string): void { const p = S.partite.find((x) => x.id === pid); if (!p) return; p.prezzoUnitario = v === '' ? null : Number(v); saveDraft(); renderLeft() }
function setSalData(n: number, v: string): void { const s = salById(n); if (!s) return; s.data = v; saveDraft(); renderLeft(); renderTimeline() }
function setSalDetr(n: number, v: string): void { const s = salById(n); if (!s) return; s.detrazioni = v === '' ? null : Number(v); saveDraft(); refreshCascata(n) }
function setSalNote(n: number, v: string): void { const s = salById(n); if (!s) return; s.note = v; saveDraft() }
function refreshCascata(n: number): void { const box = $('bSalCasc'); if (!box || !S.editor || S.editor.tipo !== 'sal') return; const res = calcolaSals(S.appalto, S.partite, S.sals).find((s) => s.numero === n); if (!res) return; const row = (k: string, v: string) => `<div class="b-sumrow"><span>${esc(k)}</span><b>${v}</b></div>`; box.innerHTML = row('Totale eseguito', eur(res.totaleEseguito)) + row('Detrazioni', '− ' + eur(res.detrazioni)) + row('Ritenuta 0,50%', '− ' + eur(res.ritenuta)) + row('SAL precedenti', '− ' + eur(res.salPrecedenti)) + `<div class="b-sumrow b-kv--tot"><span>Importo del SAL (netto IVA)</span><b>${eur(res.importoSal)}</b></div>` }
function rigeneraDaComputo(n: number): void { const s = salById(n); if (!s) return; seedPrimoLibretto(s); saveDraft(); reopenEditor(); toast('Libretto rigenerato dalle quantità del computo') }
function addVoce(salN?: number): void {
  const codice = val('bnv-cod').trim(), desc = val('bnv-desc').trim()
  if (!codice && !desc) { toast('Inserisci almeno codice o descrizione'); return }
  const mod = (val('bnv-mod') === 'corpo' ? 'corpo' : 'misura') as Modalita
  const prezzo = val('bnv-prezzo') === '' ? null : Number(val('bnv-prezzo'))
  // La voce compare dal SAL in cui è introdotta: non retroagisce sui libretti già prodotti.
  const introdottaSal = salN ?? 1
  const base = { id: uid(), codice, descrizione: desc, um: val('bnv-um').trim(), introdottaSal }
  const p: Partita = mod === 'corpo'
    ? { ...base, modalita: 'corpo', importoContrattuale: prezzo }
    : { ...base, modalita: 'misura', prezzoUnitario: prezzo, qtyProgetto: null }
  S.partite.push(p); saveDraft(); renderLeft(); reopenEditor()
  toast(introdottaSal > 1 ? `Nuovo prezzo aggiunto dal SAL ${introdottaSal}` : 'Voce aggiunta')
}
/**
 * «Elimina voce». Atto pubblico: non si cancella ciò che è già stato
 * contabilizzato. Se la voce non è ancora entrata in alcun atto (introdotta in
 * questo stesso SAL e nessun libretto precedente prodotto) si rimuove davvero;
 * altrimenti si SOPPRIME con storno tracciato (detrazione dal SAL corrente).
 */
function delVoce(pid: string, salN: number): void {
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const intro = p.introdottaSal ?? 1
  // Protetta (→ storno) solo se LA VOCE è esistita in un SAL precedente il cui
  // libretto è stato prodotto: un nuovo prezzo di questo stesso SAL resta eliminabile.
  const esistevaPrima = intro < salN
  const prodottaDaAllora = S.consegne.some((c) => c.tipo === 'libretto' && (c.salNumero ?? 0) >= intro && (c.salNumero ?? 0) < salN)
  const giaContabilizzata = esistevaPrima && prodottaDaAllora
  if (!giaContabilizzata) {
    S.partite = S.partite.filter((x) => x.id !== pid)
    for (const s of S.sals) s.righe = s.righe.filter((r) => r.partitaId !== pid)
    libExpanded.delete(pid)
    toast('Voce eliminata (non ancora contabilizzata)')
  } else {
    p.soppressaSal = salN
    libExpanded.delete(pid)
    toast(`Voce soppressa e portata in detrazione al SAL ${salN}: resta a verbale negli atti precedenti (storno).`)
  }
  saveDraft(); renderLeft(); reopenEditor()
}
function annullaStorno(pid: string): void { const p = S.partite.find((x) => x.id === pid); if (!p) return; delete p.soppressaSal; saveDraft(); renderLeft(); reopenEditor(); toast('Storno annullato') }
/* ── Misure di dettaglio del libretto (stile computo μ) ─────────────────── */
function toggleMisure(pid: string): void { if (libExpanded.has(pid)) libExpanded.delete(pid); else libExpanded.add(pid); reopenEditor() }
/** Converte la quantità rapida in una prima riga di misura e apre il dettaglio. */
function dettagliaMisure(salN: number, pid: string): void {
  const s = salById(salN); if (!s) return
  const r = rigaFor(s, pid)
  if (!r.misurazioni || !r.misurazioni.length) {
    const q = r.quantitaProgressiva
    r.misurazioni = [{ descrizione: 'da computo', l1: q ?? null, quantita: q ?? 0 }]
  }
  r.quantitaProgressiva = null // la somma delle misure guida il progressivo
  libExpanded.add(pid); saveDraft(); reopenEditor()
}
function addMisura(salN: number, pid: string, detrazione: boolean): void {
  const s = salById(salN); if (!s) return
  const r = rigaFor(s, pid)
  if (!r.misurazioni) r.misurazioni = []
  r.quantitaProgressiva = null
  r.misurazioni.push(detrazione ? { descrizione: 'detrazione', n: -1, quantita: 0 } : { quantita: 0 })
  libExpanded.add(pid); saveDraft(); reopenEditor()
}
function setMisura(salN: number, pid: string, idx: number, campo: keyof MisurazioneRiga, v: string): void {
  const s = salById(salN); if (!s) return
  const r = s.righe.find((x) => x.partitaId === pid); const m = r?.misurazioni?.[idx]; if (!m) return
  if (campo === 'descrizione') { m.descrizione = v; saveDraft(); return }
  ;(m as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v)
  m.quantita = calcolaRigaMisurazione(m)
  saveDraft()
  // Aggiornamento MIRATO delle celle calcolate (no rimontaggio: si conserva il focus dell'input).
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const cell = $(`bmq-${pid}-${idx}`); if (cell) { cell.textContent = numFmt(m.quantita); cell.parentElement?.classList.toggle('b-row-storno', (m.quantita || 0) < 0) }
  const tot = sommaMisurazioni(r!.misurazioni)
  const tcell = $(`bmt-${pid}`); if (tcell) tcell.textContent = `${numFmt(tot)} ${p.um || ''}`
  const ecell = $(`bme-${pid}`); if (ecell) ecell.textContent = numFmt(tot)
  const icell = $(`bmimp-${pid}`); if (icell) icell.textContent = eur(eseguitoPartita(p, r, salN))
  renderLeft()
}
function delMisura(salN: number, pid: string, idx: number): void {
  const s = salById(salN); if (!s) return
  const r = s.righe.find((x) => x.partitaId === pid); if (!r?.misurazioni) return
  r.misurazioni.splice(idx, 1)
  saveDraft(); reopenEditor()
}
function addGiornale(): void { S.giornale.push({ data: '', lavorazioni: '' }); saveDraft(); reopenEditor() }
function setGiornale(i: number, f: keyof RigaGiornale, v: string): void { if (S.giornale[i]) { (S.giornale[i] as unknown as Record<string, string>)[f] = v; saveDraft() } }
function delGiornale(i: number): void { S.giornale.splice(i, 1); saveDraft(); reopenEditor() }
function addRiserva(): void { const n = S.riserve.length ? Math.max(...S.riserve.map((r) => r.numero)) + 1 : 1; S.riserve.push({ numero: n, oggetto: '' }); saveDraft(); reopenEditor() }
function setRiserva(i: number, f: keyof Riserva, v: string): void { const r = S.riserve[i]; if (!r) return; if (f === 'importo' || f === 'salNumero') (r as unknown as Record<string, number | null>)[f] = v === '' ? null : Number(v); else (r as unknown as Record<string, string>)[f] = v; saveDraft() }
function delRiserva(i: number): void { S.riserve.splice(i, 1); saveDraft(); reopenEditor() }
function setRelazione(v: string): void { S.relazione = v; saveDraft() }

/* ── Anteprima / Stampa (registra nello storico solo su Stampa) ─────────── */
function openDoc(html: string): void { const w = window.open('', '_blank'); if (!w) { toast('Consenti i popup del browser per aprire il documento'); return } w.document.open(); w.document.write(html); w.document.close() }
function anteprima(): void { if (!S.editor) return; const fd = findDoc(S.editor.fase, S.editor.tipo); if (fd) openDoc(fd.d.gen()) }
function stampa(): void {
  if (!S.editor) return; const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd) return
  openDoc(fd.d.gen())
  const dataIt = fd.f.dataIt || isoToIt(S.dataCorrenteISO)
  const prev = consegnaDi(fd.d.tipo, fd.f.salNumero)
  if (prev) { prev.data = dataIt; prev.ts = Date.now() } else S.consegne.push({ id: uid(), tipo: fd.d.tipo, label: fd.d.label, data: dataIt, salNumero: fd.f.salNumero, ts: Date.now() })
  saveDraft(); renderTimeline(); renderConsegne(); toast(`«${fd.d.label}» prodotto e registrato nello storico`)
}
function riapri(id: string): void { const c = S.consegne.find((x) => x.id === id); if (!c) return; const fd = fasi().flatMap((f) => f.docs.map((d) => ({ f, d }))).find((x) => x.d.tipo === c.tipo && x.f.salNumero === c.salNumero); if (fd) { if (fd.d.needsPartite && !S.partite.length) { toast('Computo assente'); return } openDoc(fd.d.gen()) } }

/* ── Export editabile (.docx / .odt) — stesso HTML di anteprima/stampa, convertito
   via il walker generico `htmlDocToSimpleDoc` (shared/doc): funziona per TUTTI gli
   atti di β senza adattare i singoli generatori. */
function nomeFileDoc(label: string): string {
  return 'beta-' + label.replace(/[^\w]+/g, '_').slice(0, 60)
}
async function scaricaBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function esportaEditabile(fmt: 'docx' | 'odt'): Promise<void> {
  if (!S.editor) return
  const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd) return
  try {
    toast(`Generazione .${fmt}…`)
    await loadJSZip()
    const JSZip = (window as unknown as { JSZip?: new () => { file: (path: string, content: string, opts?: { compression?: string }) => void; generateAsync: (o: { type: string; mimeType: string }) => Promise<Blob> } }).JSZip
    if (!JSZip) { toast('Libreria ZIP non disponibile'); return }
    const doc = htmlDocToSimpleDoc(fd.d.gen())
    const zip = new JSZip()
    if (fmt === 'docx') {
      for (const [path, content] of Object.entries(buildSimpleDocxParts(doc))) zip.file(path, content)
      const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME })
      await scaricaBlob(blob, nomeFileDoc(fd.d.label) + '.docx')
    } else {
      for (const [path, content] of Object.entries(buildOdtParts(doc))) zip.file(path, content, path === ODT_MIMETYPE_ENTRY ? { compression: 'STORE' } : undefined)
      const blob = await zip.generateAsync({ type: 'blob', mimeType: ODT_MIME })
      await scaricaBlob(blob, nomeFileDoc(fd.d.label) + '.odt')
    }
  } catch (err) { toast('Errore export: ' + ((err as Error)?.message || err)) }
}

/* ── Export Excel ───────────────────────────────────────────────────────── */
async function exportExcel(kind: 'sal' | 'registro' | 'sommario', salNumero: number): Promise<void> {
  if (!S.partite.length) { toast('Importa prima il computo'); return }
  try {
    await loadXLSX()
    const XLSX = (window as unknown as { XLSX: { utils: Record<string, Function>; writeFile: Function } }).XLSX
    const aoa = kind === 'sal' ? salAOA(S.appalto, S.partite, S.sals, salNumero, S.economia) : kind === 'registro' ? registroAOA(S.appalto, S.partite, S.sals, S.economia) : sommarioAOA(S.appalto, S.partite, S.sals, salNumero, S.economia)
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = aoaColWidths(aoa).map((wch) => ({ wch }))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, (kind === 'registro' ? 'Registro' : `${kind} ${salNumero}`).slice(0, 31))
    XLSX.writeFile(wb, `beta-${kind}-${(S.appalto.oggetto || 'lavori').replace(/[^\w]+/g, '_').slice(0, 30)}.xlsx`)
  } catch (err) { toast('Errore export: ' + ((err as Error)?.message || err)) }
}

/* ── Avvio ──────────────────────────────────────────────────────────────── */
Object.assign(window, {
  toggleTheme, toggleGuida, openDati, closeModal, openImport, avanzaGiorni, setDataCorrenteIt, setDataCorrenteIso, nuovoSalOggi,
  openNuovoVerbale, creaVerbale, setVerb, delVerbale,
  creaLista, setLista, addOperaio, addMezzo, addProvvista, setOperaio, setMezzo, setProvvista,
  delOperaio, delMezzo, delProvvista, delLista, annullaStornoLista,
  setApp, setAppNum, setEnte, setImpresa, pickLogo, removeLogo,
  setImportMode, importMiu, svuotaComputo,
  openEditor, anteprima, stampa, riapri, scrollFase, exportExcel, esportaEditabile,
  setSalQta, setSalQuota, setPrezzo, setSalData, setSalDetr, setSalNote, rigeneraDaComputo, addVoce, delVoce,
  toggleMisure, dettagliaMisure, addMisura, setMisura, delMisura, annullaStorno,
  addGiornale, setGiornale, delGiornale, addRiserva, setRiserva, delRiserva, setRelazione,
})

function boot(): void {
  clearDraftResidue(); registerGuide(BETA_GUIDE); renderAll()
  sendToHub({ type: 'app:request-state', want: 'pricelist' })
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light')
  $('bLogoFile')?.addEventListener('change', onLogoFile)
  bindThemeShortcut(toggleTheme)
  bindGuideShortcut('beta')
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
