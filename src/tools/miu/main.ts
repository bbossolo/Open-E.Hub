/**
 * Modulo ES di μ Prezzi (STEP 4d): gestisce i prezzari INTERNI con caricamento
 * a RICHIESTA.
 *
 * Il manifest (`prezzari/_bundle/manifest.js`) popola la sidebar all'avvio senza
 * caricare i dati. Al clic su un prezzario, lo script legacy chiama
 * `window.__pricelistLoadRows(slug)` che:
 *  1. inietta `prezzari/_bundle/<slug>.js` via <script src> — funziona sotto
 *     file:// (dove `fetch` è bloccato dall'iframe srcdoc), come i vendor;
 *  2. decodifica il gzip base64 registrato su `window.__PRZ[slug]` con
 *     Blob + DecompressionStream (nessun fetch);
 *  3. ricostruisce le righe con `unpackPrezzario`.
 */
import { unpackPrezzario, classifyTematica, TEMATICHE, macrocategorieFor, MACROCATEGORIE, searchRows, prewarmSearchIndexAsync, searchManodoperaRows, isManodoperaRow, isNoloRow, searchNoloRows, isMaterialeRow, isOperaCompiutaRow, searchMaterialeRows, suggestManodoperaPerMacro, scomposizioneToRighe, indicePerCodice, hasScomposizione, suggestRows, suggestLabel, isConduit, scoreConduit, productText, scoreCable, parseMetel, isMetel, buildComputoModel, computoHTML, FRASARIO, componiDescrizione, verificaCoerenza, suggerisciFamiglia, frasarioFor, VOCI_PRONTE, voceProntaText, estraiVociDaScheda, rideriveDescrizione, MARCHI, SETTORE_LABEL, calcolaAnalisi, incidenzaManodopera, DEFAULT_SPESE_GENERALI_PCT, DEFAULT_UTILE_IMPRESA_PCT, analisiPrezziHTML, fascicoloAnalisiHTML, analisiPrezziAOA, analisiPrezziFileName, fascicoloIndiceAOA, fascicoloSheetName, fascicoloFileName, aoaColWidths, aoaMerges, computoMetricoAOA, computoMetricoFileName, CATEGORIE_GOLDEN, normalizzaAmbito, calcolaRigaMisurazione, sommaMisurazioni, type PackedPrezzario, type PriceRow, type ComputoItem, type ComputoMeta, type VoceProposta, type AnalisiPrezzi } from './engine'
import { loadScript, loadPDF, parseVersionFromURL, onHubMessage, type CompanyBrand } from '../../shared'
import { makeResizer, makeAccordion, makeCollapse, toggleGuide, closeGuide as closeGuideShared, bindGuideShortcut, flashElement, viewEnter, undoToast } from '../../shared/ui/components/index'
import { registerGuide } from '../../shared/ui/guide'
import { MIU_GUIDE } from './data/guida'
import { startTour } from '../../shared/ui/components/tour'
import { MIU_TOUR } from './data/tour'
import { initAnalytics } from '../../shared/analytics'

initAnalytics()

interface ManifestEntry { slug: string; regione: string | null; anno: string | null; count: number; categoria?: 'pubblico' | 'privato' | 'metel' }

declare global {
  interface Window {
    __PRZ?: Record<string, string>
    __PRZ_MANIFEST?: ManifestEntry[]
    __pricelistRegister?: (manifest: ManifestEntry[]) => void
    __pricelistLoadRows?: (slug: string, onP?: (p: number) => void) => Promise<PriceRow[]>
    /** Report computo/estratto (engine puro), usato dallo script inline di index.html. */
    miuComputoReport?: (items: ComputoItem[], meta?: ComputoMeta) => string
    /** Report PDF dell'Analisi Prezzi (engine puro), usato dallo script inline. */
    miuAnalisiPrezziReport?: (a: AnalisiPrezzi) => string
    /** Fascicolo PDF di TUTTE le Analisi Prezzi del carrello (sistema ε). */
    miuFascicoloAnalisiReport?: (list: AnalisiPrezzi[]) => string
    /** Avvia il tour guidato di μ, richiamato dal bottone nella guida (script inline). */
    startMiuTour?: () => void
    /** Layer condiviso di micro-interazioni, per lo script legacy inline. */
    ehbFeedback?: { flashElement: typeof flashElement; viewEnter: typeof viewEnter; undoToast: typeof undoToast }
  }
}

// Intestazione dello studio (azienda) ricevuta dall'hub per le stampe.
let suiteCompany: CompanyBrand | null = null
onHubMessage((m) => { if (m.type === 'hub:set-company') suiteCompany = m.company })

// Esposto su window: lo script classico inline di index.html non può importare i
// moduli ES, quindi gli passiamo l'engine del report come funzione pronta all'uso.
window.miuComputoReport = (items, meta) => computoHTML(buildComputoModel(items, meta), suiteCompany)
window.miuAnalisiPrezziReport = (a) => analisiPrezziHTML(a, suiteCompany)
window.miuFascicoloAnalisiReport = (list) => fascicoloAnalisiHTML(list, suiteCompany)
window.startMiuTour = () => startTour(MIU_TOUR)
window.ehbFeedback = { flashElement, viewEnter, undoToast }

// Guida rapida μ → sezione del manuale unico condiviso (visore F1). Sovrascrive
// openGuide/closeGuide dello script legacy (main.ts viene caricato dopo).
registerGuide({ ...MIU_GUIDE, onTour: () => startTour(MIU_TOUR) })
bindGuideShortcut('miu')
Object.assign(window, { openGuide: () => toggleGuide('miu'), closeGuide: () => closeGuideShared() })

/** Decodifica un gzip base64 in PackedPrezzario senza fetch (Blob + DecompressionStream). */
async function decodeGz(b64: string): Promise<PackedPrezzario> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  return JSON.parse(text) as PackedPrezzario
}

window.__pricelistLoadRows = async (slug, onP): Promise<PriceRow[]> => {
  onP?.(15)
  await loadScript(`prezzari/_bundle/${slug}.js`)   // <script src> esterno (ok sotto file://)
  const b64 = window.__PRZ?.[slug]
  if (!b64) throw new Error('dataset interno non trovato: ' + slug)
  onP?.(45)
  const packed = await decodeGz(b64)
  onP?.(80)
  const { rows } = unpackPrezzario(packed)
  for (const r of rows) {
    r.tematica = classifyTematica(r) // macro-tematica per il filtro
    r.macro = macrocategorieFor(r)   // macrocategorie impianti, 0..n
  }
  onP?.(100)
  return rows
}

// Esposte allo script legacy (inline): classificatore + elenco ufficiale tematiche.
;(window as unknown as { classifyTematica?: typeof classifyTematica; TEMATICHE?: string[] }).classifyTematica = classifyTematica
;(window as unknown as { TEMATICHE?: string[] }).TEMATICHE = TEMATICHE
;(window as unknown as { macrocategorieFor?: typeof macrocategorieFor }).macrocategorieFor = macrocategorieFor
;(window as unknown as { MACROCATEGORIE?: string[] }).MACROCATEGORIE = MACROCATEGORIE
;(window as unknown as { searchRows?: typeof searchRows }).searchRows = searchRows
;(window as unknown as { prewarmSearchIndexAsync?: typeof prewarmSearchIndexAsync }).prewarmSearchIndexAsync = prewarmSearchIndexAsync
;(window as unknown as { searchManodoperaRows?: typeof searchManodoperaRows }).searchManodoperaRows = searchManodoperaRows
;(window as unknown as { isManodoperaRow?: typeof isManodoperaRow }).isManodoperaRow = isManodoperaRow
;(window as unknown as { isNoloRow?: typeof isNoloRow }).isNoloRow = isNoloRow
;(window as unknown as { searchNoloRows?: typeof searchNoloRows }).searchNoloRows = searchNoloRows
;(window as unknown as { isMaterialeRow?: typeof isMaterialeRow }).isMaterialeRow = isMaterialeRow
;(window as unknown as { isOperaCompiutaRow?: typeof isOperaCompiutaRow }).isOperaCompiutaRow = isOperaCompiutaRow
;(window as unknown as { searchMaterialeRows?: typeof searchMaterialeRows }).searchMaterialeRows = searchMaterialeRows
;(window as unknown as { suggestManodoperaPerMacro?: typeof suggestManodoperaPerMacro }).suggestManodoperaPerMacro = suggestManodoperaPerMacro
;(window as unknown as { scomposizioneToRighe?: typeof scomposizioneToRighe }).scomposizioneToRighe = scomposizioneToRighe
;(window as unknown as { indicePerCodice?: typeof indicePerCodice }).indicePerCodice = indicePerCodice
;(window as unknown as { hasScomposizione?: typeof hasScomposizione }).hasScomposizione = hasScomposizione
;(window as unknown as { suggestRows?: typeof suggestRows }).suggestRows = suggestRows
;(window as unknown as { suggestLabel?: typeof suggestLabel }).suggestLabel = suggestLabel
;(window as unknown as { isConduit?: typeof isConduit }).isConduit = isConduit
;(window as unknown as { scoreConduit?: typeof scoreConduit }).scoreConduit = scoreConduit
;(window as unknown as { scoreCable?: typeof scoreCable }).scoreCable = scoreCable
;(window as unknown as { parseMetel?: typeof parseMetel }).parseMetel = parseMetel
;(window as unknown as { isMetel?: typeof isMetel }).isMetel = isMetel
;(window as unknown as { productText?: typeof productText }).productText = productText
// Compositore di descrizioni per voci di computo (engine puro).
;(window as unknown as { FRASARIO?: typeof FRASARIO }).FRASARIO = FRASARIO
;(window as unknown as { componiDescrizione?: typeof componiDescrizione }).componiDescrizione = componiDescrizione
;(window as unknown as { verificaCoerenza?: typeof verificaCoerenza }).verificaCoerenza = verificaCoerenza
;(window as unknown as { suggerisciFamiglia?: typeof suggerisciFamiglia }).suggerisciFamiglia = suggerisciFamiglia
// una distinta pubblica solo famigliaId (non un testo): per il match nel prezzario
// si cerca sul NOME della famiglia (allineato al thesaurus), non sulla dicitura
// propria della distinta, che non è detto coincida con alias/sinonimi del prezzario.
;(window as unknown as { frasarioFor?: typeof frasarioFor }).frasarioFor = frasarioFor
// Libreria di voci pronte (seed curato minato dai computi golden) + helper testo.
;(window as unknown as { VOCI_PRONTE?: typeof VOCI_PRONTE }).VOCI_PRONTE = VOCI_PRONTE
;(window as unknown as { voceProntaText?: typeof voceProntaText }).voceProntaText = voceProntaText
// Import scheda tecnica (PDF) → voci candidate. Il testo lo estrae pdf.js qui
// (adapter impuro); il riconoscimento è l'engine puro `estraiVociDaScheda`.
;(window as unknown as { estraiVociDaScheda?: typeof estraiVociDaScheda }).estraiVociDaScheda = estraiVociDaScheda
// Ricalcola breve/estesa di una voce-da-scheda quando marca/modello vengono
// arricchiti DOPO l'estrazione (es. un match METEL) — senza, l'arricchimento
// non arrivava mai al testo mostrato/caricato nel compositore.
;(window as unknown as { rideriveDescrizione?: typeof rideriveDescrizione }).rideriveDescrizione = rideriveDescrizione
// KB marchi + label settori: la UI mostra per quali produttori/comparti l'import
// è ottimizzato (pannello ⓘ) — si aggiorna da sola quando la KB cresce.
;(window as unknown as { MARCHI?: typeof MARCHI }).MARCHI = MARCHI
;(window as unknown as { SETTORE_LABEL?: typeof SETTORE_LABEL }).SETTORE_LABEL = SETTORE_LABEL
;(window as unknown as { importDatasheetPDF?: (f: File) => Promise<VoceProposta[]> }).importDatasheetPDF = importDatasheetPDF

// Analisi Prezzi (engine puro): calcolo totali + default SG/UI + matrice export Excel.
;(window as unknown as { calcolaAnalisi?: typeof calcolaAnalisi }).calcolaAnalisi = calcolaAnalisi
;(window as unknown as { incidenzaManodopera?: typeof incidenzaManodopera }).incidenzaManodopera = incidenzaManodopera
// Computo Metrico (engine puro): righe di misura L1×L2×H×n → quantità di voce.
;(window as unknown as { calcolaRigaMisurazione?: typeof calcolaRigaMisurazione }).calcolaRigaMisurazione = calcolaRigaMisurazione
;(window as unknown as { sommaMisurazioni?: typeof sommaMisurazioni }).sommaMisurazioni = sommaMisurazioni
;(window as unknown as { DEFAULT_SPESE_GENERALI_PCT?: number }).DEFAULT_SPESE_GENERALI_PCT = DEFAULT_SPESE_GENERALI_PCT
;(window as unknown as { DEFAULT_UTILE_IMPRESA_PCT?: number }).DEFAULT_UTILE_IMPRESA_PCT = DEFAULT_UTILE_IMPRESA_PCT
;(window as unknown as { analisiPrezziAOA?: typeof analisiPrezziAOA }).analisiPrezziAOA = analisiPrezziAOA
;(window as unknown as { analisiPrezziFileName?: typeof analisiPrezziFileName }).analisiPrezziFileName = analisiPrezziFileName
// Fascicolo multi-analisi (toolbar): Indice + un foglio per analisi del carrello.
;(window as unknown as { fascicoloIndiceAOA?: typeof fascicoloIndiceAOA }).fascicoloIndiceAOA = fascicoloIndiceAOA
;(window as unknown as { fascicoloSheetName?: typeof fascicoloSheetName }).fascicoloSheetName = fascicoloSheetName
;(window as unknown as { fascicoloFileName?: typeof fascicoloFileName }).fascicoloFileName = fascicoloFileName
;(window as unknown as { aoaColWidths?: typeof aoaColWidths }).aoaColWidths = aoaColWidths
;(window as unknown as { aoaMerges?: typeof aoaMerges }).aoaMerges = aoaMerges
// Export Excel del Computo Metrico (generico, nessun template esterno).
;(window as unknown as { computoMetricoAOA?: typeof computoMetricoAOA }).computoMetricoAOA = computoMetricoAOA
;(window as unknown as { computoMetricoFileName?: typeof computoMetricoFileName }).computoMetricoFileName = computoMetricoFileName
// Vocabolario categorie (vista Categorie: pannello suggerimenti/drag&drop) —
// vedi src/tools/miu/engine/categorie-db.ts.
;(window as unknown as { CATEGORIE_GOLDEN?: typeof CATEGORIE_GOLDEN }).CATEGORIE_GOLDEN = CATEGORIE_GOLDEN
;(window as unknown as { normalizzaAmbito?: typeof normalizzaAmbito }).normalizzaAmbito = normalizzaAmbito

/**
 * Estrae il testo di TUTTE le pagine di un PDF scheda-tecnica con pdf.js (già in
 * vendor/, offline) e ne ricava le voci candidate. PDF scansionati senza layer
 * testo ⇒ testo vuoto ⇒ nessuna proposta (l'UI mostra il messaggio dedicato).
 */
async function importDatasheetPDF(file: File): Promise<VoceProposta[]> {
  await loadPDF() // inietta vendor/pdf.min.js una sola volta
  const pdfjsLib = (window as unknown as { pdfjsLib: any }).pdfjsLib
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'
  const data = new Uint8Array(await file.arrayBuffer())
  // isEvalSupported:false → una scheda tecnica PDF ostile non esegue JS nel
  // renderer (CVE-2024-4367): qui il file arriva da un produttore qualsiasi.
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  let testo = ''
  let titolo = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const items = tc.items as { str?: string; height?: number; transform?: number[] }[]
    testo += items.map(it => it.str ?? '').join(' ') + '\n'
    // titolo = il testo più GRANDE della prima pagina (di solito modello + codice),
    // raggruppato per RIGA (y da transform[5]): i titoli su due righe restano in
    // ordine di lettura e non si mescolano con frammenti sparsi della pagina.
    if (i === 1) {
      const nonVuoti = items.filter(it => (it.str ?? '').trim())
      const maxH = Math.max(0, ...nonVuoti.map(it => it.height ?? 0))
      const grandi = nonVuoti.filter(it => (it.height ?? 0) >= maxH * 0.85)
      const righe = new Map<number, string[]>()
      for (const it of grandi) {
        const y = Math.round((it.transform?.[5] ?? 0) / 3) // tolleranza ~3pt di baseline
        if (!righe.has(y)) righe.set(y, [])
        righe.get(y)!.push(it.str ?? '')
      }
      titolo = [...righe.entries()]
        .sort((a, b) => b[0] - a[0]) // y PDF cresce verso l'alto: prima le righe in alto
        .slice(0, 2)
        .map(([, frag]) => frag.join(' '))
        .join(' ')
    }
  }
  return estraiVociDaScheda(testo, { titolo })
}

// Popola la sidebar coi prezzari interni (dal manifest), senza caricarne i dati.
window.__pricelistRegister?.(window.__PRZ_MANIFEST ?? [])

// Pannello dettaglio (destro) ridimensionabile (handle al bordo sinistro).
makeResizer(document.getElementById('detail-resize'), {
  cssVar: '--detail-w', side: 'right', min: 280, max: 560, storageKey: 'pricelist:detail-w',
})

// Dock della selezione ("Da copiare"): l'elenco ha un tetto, e la
// maniglia sul bordo superiore lo alza/abbassa (asse y: trascinare in su fa
// crescere il dock). Tetto massimo a metà finestra: la lista dei risultati
// non deve mai sparire sotto il dock.
makeResizer(document.getElementById('sel-dock-resize'), {
  cssVar: '--sel-dock-h', side: 'right', axis: 'y',
  min: 56, max: Math.round(window.innerHeight * 0.5), storageKey: 'miu:sel-dock-h',
})

// Sidebar sinistra ridimensionabile — unifica il resizer inline sul condiviso.
makeResizer(document.getElementById('sidebar-resize'), {
  cssVar: '--sidebar-w', side: 'left', min: 200, max: 600, storageKey: 'sidebarW',
})

// Sidebar comprimibile — componente condiviso della suite.
// Migrazione one-shot della vecchia chiave non-namespaced → 'miu:sidebar-collapsed'.
;(function migrateSidebarKey(): void {
  const old = localStorage.getItem('sidebarCollapsed')
  if (old !== null && localStorage.getItem('miu:sidebar-collapsed') === null) {
    localStorage.setItem('miu:sidebar-collapsed', old)
    localStorage.removeItem('sidebarCollapsed')
  }
})()
const _sidebar = makeCollapse(
  document.getElementById('sidebar'),
  document.getElementById('sidebar-collapse-btn'),
  { storageKey: 'miu:sidebar-collapsed' },
)
// Secondo trigger: l'affordance di espansione (visibile da CSS quando .collapsed).
document.querySelector('#sidebar-collapsed-icon button')?.addEventListener('click', () => _sidebar.toggle())

// Filtri: drawer a fisarmonica dietro un solo bottone "Filtri ▾" (schermata
// leggera — macrocategorie + griglia campi restano a riposo finché non servono).
// La mini-search "filtra opzioni" compare solo a filtri aperti; alla chiusura
// si nasconde e il suo filtro viene azzerato.
// Default COLLASSATO alla prima visita (a differenza della vecchia .filter-grid,
// aperta di default): seminiamo la chiave solo se non è già stata scelta dall'utente.
if (localStorage.getItem('pricelist:filters-collapsed') === null) {
  localStorage.setItem('pricelist:filters-collapsed', '1')
}
makeAccordion(
  document.getElementById('filtri-btn'),
  document.getElementById('filtri-drawer'),
  {
    storageKey: 'pricelist:filters-collapsed',
    onChange: (collapsed: boolean): void => {
      const mini = document.getElementById('filter-mini-search') as HTMLInputElement | null
      if (mini) {
        mini.style.display = collapsed ? 'none' : ''
        if (collapsed) {
          mini.value = ''
          ;(window as unknown as { filterMiniSearch?: (q: string) => void }).filterMiniSearch?.('')
        }
      }
      ;(window as unknown as { updateFiltriBtnLabel?: () => void }).updateFiltriBtnLabel?.()
    },
  },
)

// Versione (da filename, modulo condiviso) → titolo, sottotitolo, tooltip + app:ready.
;(function applyAppVersion(): void {
  const v = parseVersionFromURL()
  const vStr = v ? ` · v${v}` : ''
  document.title = `μ Prezzi — Consultazione prezzari${v ? ' v' + v : ''}`
  const logo = document.getElementById('app-logo')
  if (logo) logo.title = `μ Prezzi${v ? ' v' + v : ''}`
  const sub = document.getElementById('appLogoSub')
  if (sub) sub.textContent = `consultazione prezzari · Elenco Prezzi${vStr}`
  try {
    window.parent.postMessage({ type: 'app:ready' }, '*')
  } catch {
    /* fuori da iframe */
  }
})()
