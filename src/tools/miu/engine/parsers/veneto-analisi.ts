/**
 * Parser COMPANION per le **Analisi Prezzi del Veneto** (`<analisiPrezzi>`) —
 * un file separato dal prezzario che porta la scomposizione ufficiale per voce:
 *
 *   <analisiPrezzi cod="2026" desc="Prezzario 2026">
 *     <articolo cod="VEN26-01.02.01.00" spese="0.265" val="2.74" utile="0.7261" tot="3.4661">
 *       <desc>SCAVO DI PULIZIA…</desc>
 *       <prezzi>
 *         <prezzo cod="VEN26-AT.09.01.b" umi="h" qta="0.024" val="67.69" tot="1.62">NOLO A CALDO…</prezzo>
 *
 * Non produce voci: arricchisce le righe del prezzario Veneto (stesso anno) con
 * `PriceRow.risorse` via `applyAnalisi`. `val`/`tot` a livello articolo: costo
 * diretto e prezzo (tot = val + utile, aliquota unica `spese` ~26,5%).
 */
import { makeParser, num, toArray } from '../xml'
import type { PriceRow, RisorsaComponente } from '../types'
import type { AnalisiRigaTipo } from '../../../../shared/compositore/analisi-prezzi'

const parser = makeParser({ parseTagValue: false })

interface VAPrezzo { '@_cod'?: string; '@_umi'?: string; '@_qta'?: string; '@_val'?: string; '#text'?: string }
interface VAArticolo { '@_cod'?: string; prezzi?: { prezzo?: VAPrezzo | VAPrezzo[] } }

/** Sezione dell'analisi dal prefisso del codice risorsa (VEN26-RU… / VEN26-AT…), con fallback testuale. */
function tipoComponente(cod: string, desc: string): AnalisiRigaTipo {
  if (/-RU\./i.test(cod)) return 'manodopera'
  if (/-AT\./i.test(cod)) return 'nolo'
  if (/^(NOLO|NOLEGGIO)\b/i.test(desc)) return 'nolo'
  if (/^(OPERAI|MANODOPERA|CAPO ?SQUADRA)/i.test(desc)) return 'manodopera'
  return 'materiale'
}

/** true se `xml` è un file di analisi prezzi Veneto (sniff sulla testa). */
export function isVenetoAnalisi(head: string): boolean {
  return head.includes('<analisiPrezzi')
}

/** Legge il file in una mappa codice voce → componenti della scomposizione. */
export function parseVenetoAnalisi(xml: string): { anno: string | null; byCod: Map<string, RisorsaComponente[]> } {
  const doc = parser.parse(xml)
  const root = doc?.analisiPrezzi
  const byCod = new Map<string, RisorsaComponente[]>()
  if (!root) return { anno: null, byCod }
  const anno = String(root['@_cod'] ?? '').match(/20\d{2}/)?.[0] ?? null
  for (const a of toArray<VAArticolo>(root.articolo)) {
    const codice = String(a['@_cod'] ?? '').trim()
    if (!codice) continue
    const comp: RisorsaComponente[] = []
    for (const p of toArray<VAPrezzo>(a.prezzi?.prezzo)) {
      const cod = String(p['@_cod'] ?? '').trim()
      const quantita = num(p['@_qta'])
      if (!cod || quantita <= 0) continue
      const desc = String(p['#text'] ?? '').trim()
      comp.push({
        codice: cod,
        tipo: tipoComponente(cod, desc),
        quantita,
        prezzo: num(p['@_val']),
        um: String(p['@_umi'] ?? '').trim(),
        descrizione: desc,
      })
    }
    if (comp.length) byCod.set(codice, comp)
  }
  return { anno, byCod }
}

/** Attacca le scomposizioni alle righe del prezzario (per codice). Ritorna quante voci arricchite. */
export function applyAnalisi(rows: PriceRow[], byCod: Map<string, RisorsaComponente[]>): number {
  let n = 0
  for (const r of rows) {
    if (r.risorse?.length) continue
    const comp = byCod.get(r.codice)
    if (comp) { r.risorse = comp; n++ }
  }
  return n
}
