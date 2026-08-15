/* =====================================================================
   APP REGISTRY — elenco dei tool dell'hub. Aggiungi nuovi tool qui.
   Estratto FEDELMENTE dal monolite EHub_v3_5_0.html. Single source of truth.
   `version` e `resolvedFile` sono popolati a runtime da resolveFiles()
   (vedi engine/resolve.ts) in base ai file trovati nella cartella.
   ===================================================================== */

export type LogoType = 'miu' | 'phi' | 'lc' | string
export type AppStatus = 'stable' | 'beta'

/** Tematica del tool per il raggruppamento nell'hub. `amministrazione`
 *  è popolata SOLO da tool `adminOnly` — vuota (quindi omessa da groupByCategory)
 *  per qualunque profilo non-admin. La vecchia `computo-documenti` (6 tool eterogenei)
 *  si è divisa in `calcolo-prezzi` (μ: lavora sui numeri) e `documenti-commessa`
 *  (δ/β: producono le carte da consegnare). `strumenti-dxf` (χ) si è staccata da
 *  `progettazione`: non disegnano l'impianto, preparano/rifiniscono i DXF che ci girano
 *  intorno — un gruppo a sé accanto a progettazione, come computo metrico lo è accanto
 *  a documentazione. */
export type AppCategory = 'calcolo-prezzi' | 'documenti-commessa' | 'progettazione' | 'strumenti-dxf' | 'amministrazione'

/**
 * Ordine ed etichette delle tematiche.
 *
 * I computi e i documenti stanno davanti perché sono il lavoro di tutti i giorni; la
 * progettazione dopo, con `strumenti-dxf` subito affiancata (stessa logica: un gruppo
 * satellite accanto al gruppo principale, non dentro).
 */
export const CATEGORY_ORDER: AppCategory[] = ['calcolo-prezzi', 'documenti-commessa', 'progettazione', 'strumenti-dxf', 'amministrazione']
export const CATEGORY_LABELS: Record<AppCategory, string> = {
  'calcolo-prezzi': 'Computo metrico',
  'documenti-commessa': 'Documentazione',
  'progettazione': 'Progettazione',
  'strumenti-dxf': 'Strumenti DXF',
  'amministrazione': 'Amministrazione',
}

export interface AppNote {
  icon: string
  text: string
  beta?: boolean
}

export interface AppDef {
  id: string
  name: string
  tagline: string
  /** Versione rilevata dal filename (null finché non risolta). */
  /** Nome file HTML STABILE (senza versione) che l'hub scopre nella cartella. */
  file: string
  /** Cartella sorgente in `src/tools/` (es. 'gamma' per Gamma.html). OBBLIGATORIA:
   *  è la fonte unica del legame tool↔cartella per i doc generati
   *  ([scripts/sync-docs.ts]) e per le guardie di build ([tests/web]). Campo
   *  richiesto apposta: un tool nuovo senza `srcDir` non compila, quindi la
   *  documentazione non può restare indietro. */
  srcDir: string
  logoType: LogoType
  tags: string[]
  status: AppStatus
  /** Integrazioni con altri tool (glifo + tooltip accanto al nome nella welcome-card). Una card può averne più di una. */
  notes?: AppNote[]
  /** Tematica del tool (raggruppamento nell'hub). */
  category: AppCategory
  /** File HTML risolto nella cartella (= `file` se presente, null se assente). */
  resolvedFile?: string | null
  /** true = visibile SOLO al profilo admin (di sistema o aziendale) — divieto
   *  assoluto, nessun opt-in possibile. Vedi engine/visibility.ts::isToolVisible. */
  adminOnly?: boolean
}

/** Un gruppo tematico di tool (per il render a sezioni dell'hub). */
export interface AppGroup {
  key: AppCategory
  label: string
  apps: AppDef[]
}

/**
 * Raggruppa i tool per TEMATICA nell'ordine `CATEGORY_ORDER`, preservando l'ordine interno della
 * lista in ingresso. I gruppi vuoti (es. dopo un filtro di ricerca) sono omessi.
 * PURO e testabile. La ricerca/tag resta trasversale: si filtra prima, poi si raggruppa.
 */
export function groupByCategory(apps: AppDef[]): AppGroup[] {
  return CATEGORY_ORDER
    .map(key => ({ key, label: CATEGORY_LABELS[key], apps: apps.filter(a => a.category === key) }))
    .filter(g => g.apps.length > 0)
}

export const APP_REGISTRY: AppDef[] = [
  /* L'ORDINE CONTA: groupByCategory preserva l'ordine di questa lista dentro ogni
     categoria, quindi è qui che si decide come appaiono le card nell'hub. */
  {
    id: 'miu-price-list',
    name: 'μ Prezzi',
    tagline: 'Prezzari e computo metrico',
    file: 'miu.html',
    srcDir: 'miu',
    logoType: 'miu',
    tags: ['prezzario', 'excel', 'costi', 'miu'],
    status: 'stable',
    category: 'calcolo-prezzi',
  },
  {
    id: 'delta-pages',
    name: 'δ Copertine',
    tagline: 'Copertine degli elaborati',
    file: 'Delta.html',
    srcDir: 'delta',
    logoType: 'delta',
    tags: ['copertine', 'elaborati', 'frontespizio', 'template', 'pdf', 'tavole', 'delta'],
    status: 'stable',
    category: 'documenti-commessa',
  },
  {
    id: 'beta-contabilita',
    name: 'β Contabilità',
    tagline: 'Contabilità lavori pubblici',
    file: 'Beta.html',
    srcDir: 'beta',
    logoType: 'beta',
    tags: ['contabilità', 'appalti', 'pubblici', 'sal', 'libretto', 'registro', 'certificato', 'pagamento', 'corpo', 'misura', 'verbali', 'consegna', 'sospensione', 'direttore lavori'],
    status: 'stable',
    category: 'documenti-commessa',
    notes: [{ icon: 'miu', text: 'Importa il computo di μ Prezzi e ne redige la contabilità' }],
  },
  {
    id: 'chi-refs',
    name: 'χ Refs',
    tagline: 'Basi DXF esterne come xref',
    file: 'Chi.html',
    srcDir: 'chi',
    logoType: 'chi',
    tags: ['xref', 'dxf', 'layer', 'collaboratore', 'base', 'architettonico', 'planimetria', 'chi'],
    status: 'stable',
    category: 'strumenti-dxf',
  },
  {
    id: 'alfa-control-center',
    name: 'α Alfa',
    tagline: 'Centro di controllo dell\'hub',
    file: 'Alfa.html',
    srcDir: 'alfa',
    logoType: 'alfa',
    tags: ['admin', 'amministrazione', 'utenti', 'statistiche', 'alfa'],
    status: 'stable',
    category: 'amministrazione',
    adminOnly: true,
  },
  // ── AGGIUNGI NUOVI TOOL QUI ──
  // Campi: id, name, tagline, file (nome stabile), srcDir (cartella in src/tools/),
  //        logoType, tags, status, category
  // Dopo aver aggiunto una voce: `npm run sync:docs` (riallinea README e Docs). Vedi Docs/04.
  // resolvedFile viene popolato automaticamente da resolveFiles()
]
