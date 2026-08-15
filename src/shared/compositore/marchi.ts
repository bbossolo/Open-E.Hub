/**
 * KNOWLEDGE BASE MARCHI — produttori REALI per comparto impiantistico, per il
 * riconoscimento marca nelle schede tecniche PDF. Lista STATICA e curata (no
 * mining runtime dei prezzari: l'engine resta puro e sincrono); i nomi presenti
 * nei listini METEL in prezzari/metel-*.json.gz sono la base verificata, il
 * resto sono brand di mercato noti per settore — candidati a verifica Furio.
 *
 * La marca riconosciuta NON decide mai la famiglia: identifica solo il
 * produttore (badge in UI + rinforzo confidenza). I brand multi-comparto
 * (ABB, Vaillant…) si disambiguano col settore del match, ma restano
 * riconosciuti anche fuori dal loro settore d'elezione.
 */

import type { SettoreScheda } from './datasheet-profili'
import { MARCHI_DATA } from 'compositore-catalog:marchi'

export interface Marchio {
  /** forma canonica mostrata all'utente («iGuzzini», «Riello UPS») */
  nome: string
  /** grafie alternative con cui compare in scheda (già minuscole) */
  varianti?: string[]
  /** comparti in cui il brand opera (disambiguazione, mai esclusione) */
  settori: SettoreScheda[]
}

/**
 * Knowledge base marchi. `compositore-catalog:marchi` risolve (alias di
 * build, vedi vite.config.ts) ai dati veri; Open E.Hub non porta dataset
 * proprietari, quindi il bundle parte sempre dallo stub vuoto (lo studio
 * importa il proprio catalogo).
 */
export const MARCHI: Marchio[] = MARCHI_DATA

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Cerca un marchio della KB nel testo (match a parola intera, case-insensitive).
 * Con più marchi presenti vince: 1) chi opera nel `settore` indicato, 2) il nome
 * più lungo (più specifico), 3) l'ordine di apparizione nel testo. Un marchio
 * FUORI settore vale solo se compare in TESTATA (primi ~1500 caratteri): a metà
 * scheda è quasi sempre un componente di terzi («pompa del carburante Bosch» in
 * un gruppo elettrogeno — verificato su scheda Pramac reale), non il produttore.
 * La `serie` è riservata a estensioni future: oggi undefined.
 */
export function rilevaMarchio(
  testo: unknown,
  settore?: SettoreScheda,
): { marca: string; serie?: string } | undefined {
  const t = ' ' + String(testo ?? '').toLowerCase().replace(/\s+/g, ' ') + ' '
  if (t.trim() === '') return undefined
  let best: { marca: string; pos: number; len: number; inSettore: boolean } | undefined
  for (const m of MARCHI) {
    for (const nome of [m.nome.toLowerCase(), ...(m.varianti ?? [])]) {
      const re = new RegExp('(^|[^a-z0-9])' + escapeRe(nome) + '([^a-z0-9]|$)')
      const hit = re.exec(t)
      if (!hit) continue
      const cand = {
        marca: m.nome,
        pos: hit.index,
        len: nome.length,
        inSettore: !settore || m.settori.includes(settore),
      }
      if (!cand.inSettore && cand.pos > 1500) continue // componente di terzi, non produttore
      if (!best
        || (cand.inSettore && !best.inSettore)
        || (cand.inSettore === best.inSettore && (cand.len > best.len
          || (cand.len === best.len && cand.pos < best.pos)))) best = cand
    }
  }
  return best ? { marca: best.marca } : undefined
}
