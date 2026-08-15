/**
 * Registro AZIENDE/studi (profili aziendali dell'hub).
 *
 * FONDAMENTA estensibili: aggiungere un'azienda = una riga in `COMPANIES`, senza
 * toccare la UI. Un profilo aziendale porta con sé logo + intestazioni discrete
 * nelle schermate e nei documenti; l'admin (senza azienda) ha comportamento normale.
 *
 * PREDISPOSIZIONE: il logo può non essere ancora caricato → si mostra un TEMPLATE
 * placeholder (sigla) da riempire con l'immagine quando arriverà (`logo`).
 *
 * Open E.Hub include un solo profilo demo, sostituibile: ogni studio che scarica
 * la suite modifica `COMPANIES` con la propria ragione sociale e il proprio logo.
 */

import { escHtml as escAttr } from '../../shared/doc/doc'

/** Logo placeholder generico (monogramma vettoriale, nessuna identità reale). */
const STUDIO_DEMO_LOGO_DATA_URL =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">'
    + '<rect width="120" height="120" rx="16" fill="#2b3a55"/>'
    + '<text x="60" y="72" font-family="sans-serif" font-size="44" font-weight="700" '
    + 'fill="#e8edf7" text-anchor="middle">SD</text></svg>',
  )

export interface Company {
  /** Chiave di riconoscimento (match case-insensitive sul nome digitato). */
  id: string
  /** Ragione sociale completa (mostrata nelle intestazioni). */
  name: string
  /** Sigla breve per il placeholder del logo (default: id in maiuscolo). */
  short?: string
  /** Indirizzo (per le intestazioni dei documenti). */
  address?: string
  /** URL/percorso del logo. ASSENTE → si usa il template placeholder (sigla). */
  logo?: string
}

/** Aziende/studi riconosciuti. Sostituisci questa voce con la tua: id, ragione
 *  sociale, indirizzo e logo (data URL, così resta incorporato anche nei PDF). */
export const COMPANIES: Company[] = [
  {
    id: 'studio-demo',
    short: 'SD',
    name: 'Studio Demo',
    logo: STUDIO_DEMO_LOGO_DATA_URL,
  },
]

/** Riconosce un'azienda dal nome digitato (id, nome esatto o prefisso). */
export function findCompany(input: string): Company | null {
  const q = (input || '').trim().toLowerCase()
  if (!q) return null
  return (
    COMPANIES.find((c) => c.id === q || c.name.toLowerCase() === q) ||
    COMPANIES.find((c) => c.name.toLowerCase().startsWith(q) || c.id.startsWith(q)) ||
    null
  )
}

/** Sigla del logo placeholder. */
export function companyShort(c: Company): string {
  return (c.short || c.id).toUpperCase()
}

/**
 * HTML del logo azienda. Se `logo` è presente → <img> con FALLBACK: se il file
 * non si carica (non ancora salvato, o percorso non risolto in un iframe srcdoc),
 * l'`onerror` nasconde l'immagine e rivela il placeholder (sigla) accanto.
 * Se `logo` è assente → direttamente il TEMPLATE placeholder.
 */
export function companyLogoHtml(c: Company, cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  const ph = (hidden: boolean): string =>
    `<span class="co-logo co-logo--ph${cl}"${hidden ? ' style="display:none"' : ''} data-company="${escAttr(c.id)}" title="Logo ${escAttr(c.name)} — da caricare">${escAttr(companyShort(c))}</span>`
  if (c.logo) {
    return `<img class="co-logo${cl}" src="${escAttr(c.logo)}" alt="${escAttr(c.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">${ph(true)}`
  }
  return ph(false)
}
