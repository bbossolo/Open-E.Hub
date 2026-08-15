/**
 * COMPOSITORE di descrizioni per voci di computo metrico.
 *
 * Frasario per le famiglie del THESAURUS: per ogni famiglia
 * le diciture REALI (sinonimi dei prezzari + stile delle voci dei computi
 * osservato nei computi reali) con cui comporre una descrizione breve + estesa in
 * stile computo «Fornitura e posa in opera di…».
 *
 * Regola «se non c'è non si menziona»: ogni segmento è reso SOLO se lo
 * slot è valorizzato — nessun dato inventato, punteggiatura sempre corretta
 * anche a slot tutti vuoti. Le famiglie NON sono duplicate: `famigliaId` è
 * una FK verso `FAMIGLIE[].id` del thesaurus (garantita dai test).
 *
 * Solo terminologia generica di componente: nessun dato identificativo di
 * progetto (guardia anti-leak nei test, come per il thesaurus).
 */

import { FAMIGLIE, normQuery, type Famiglia } from './thesaurus'
import type { MacroCategoria } from './macrocategorie'
import { FRASARIO_DATA } from 'compositore-catalog:componi'

/** Slot «misura» di una famiglia: etichetta di resa + valori tipici per i chip. */
export interface SlotMisura {
  /** come si chiama la misura nella frase estesa: «dimensioni», «diametro», «taratura»… */
  etichetta: string
  /** valori tipici (chip proposti in UI) — l'utente può sempre digitarne uno libero */
  valori: string[]
}

/** Frasario di una famiglia: come si scrive la voce di computo di quel componente. */
export interface FrasarioFamiglia {
  /** FK verso FAMIGLIE[].id (thesaurus) — fonte unica delle famiglie */
  famigliaId: string
  /** etichetta del chip famiglia in UI (minuscola, come nel thesaurus) */
  nome: string
  /** soggetto della descrizione breve (iniziale maiuscola) */
  soggettoBreve: string
  /** soggetto della frase estesa, dopo «Fornitura e posa in opera di » */
  soggettoEsteso: string
  /** unità di misura tipiche della famiglia nei prezzari (per la coerenza) */
  umTipiche: string[]
  misura?: SlotMisura
  /** materiali/esecuzioni reali (chip a scelta singola) */
  materiale?: string[]
  /** modalità di posa reali (chip a scelta singola) */
  posa?: string[]
  /** opzioni multiple: frasi già complete, rese verbatim («con coperchio»…) */
  opzioni?: string[]
  /** norma tecnica di riferimento (UNI/CEI/EN), verificata — solo se accertata, mai dedotta */
  normativa?: string
  /** voci «Compresi:» in stile computo reale (oneri/accessori generici della famiglia) */
  compresi?: string[]
  /** macrotemi a cui appartiene — 1+, per raggruppare il picker famiglie a scomparsa */
  macro: MacroCategoria[]
  /**
   * Famiglia FUORI PREZZARIO — nessun prezzario regionale la elenca
   * come voce a sé (emersa dal mining delle voci «analisi prezzi», UM «a
   * corpo», nei computi reali). Se true, `nota` è la didascalia mostrata nel
   * compositore: il prezzo va da analisi prezzi/preventivo fornitore, non da
   * listino — l'unico percorso per queste voci è comporle e aggiungerle al
   * carrello, mai agganciarle a una voce di prezzario.
   */
  fuoriPrezzario?: boolean
  /** didascalia mostrata quando fuoriPrezzario è true */
  nota?: string
  /**
   * FACILE A LISTINO: la voce si trova già bell'e pronta in ogni prezzario (cavi,
   * cavidotti, tubi, canaline, passerelle…), quindi NON ha senso comporla a mano.
   * La famiglia resta nel thesaurus per la RICERCA prezzario e l'aggancio, ma è
   * NASCOSTA dal picker del compositore e dalle proposte dell'import scheda: il
   * compositore serve alle voci che NON sono nei prezzari (allacci, oneri,
   * apparecchi da configurare).
   */
  facilePrezzario?: boolean
}

/**
 * Frasario per famiglia. `compositore-catalog:componi` risolve (alias di
 * build, vedi vite.config.ts) ai dati veri; Open E.Hub non porta dataset
 * proprietari, quindi il bundle parte sempre dallo stub vuoto (lo studio
 * importa il proprio catalogo).
 */
export const FRASARIO: FrasarioFamiglia[] = FRASARIO_DATA

/** Frasario di una famiglia per id (FK thesaurus), o undefined se sconosciuta. */
export function frasarioFor(famigliaId: unknown): FrasarioFamiglia | undefined {
  return FRASARIO.find(f => f.famigliaId === String(famigliaId ?? ''))
}

/** Input del compositore: solo gli slot valorizzati compaiono nella descrizione. */
export interface ComponiInput {
  famigliaId: string
  misura?: string
  materiale?: string
  posa?: string
  opzioni?: string[]
}

export interface Descrizione {
  /** una riga: soggetto + caratteristiche sintetiche */
  breve: string
  /** paragrafo in stile computo «Fornitura e posa in opera di…» */
  estesa: string
}

/** Compatta spazi e scarta i valori vuoti. */
function pulisci(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Compone descrizione breve + estesa per la famiglia. Regola «se non c'è non
 * si menziona»: gli slot non valorizzati NON producono testo. Lancia se la
 * famiglia non è nel frasario.
 */
export function componiDescrizione(input: ComponiInput): Descrizione {
  const fr = frasarioFor(input.famigliaId)
  if (!fr) throw new Error('famiglia sconosciuta al frasario: ' + input.famigliaId)
  const misura = pulisci(input.misura)
  const materiale = pulisci(input.materiale)
  const posa = pulisci(input.posa)
  const opzioni = (input.opzioni ?? []).map(pulisci).filter(Boolean)

  // — breve: «Soggetto {misura}{ in materiale}{, opzione…}{, posa …}»
  let breve = fr.soggettoBreve
  if (misura) breve += ' ' + misura
  if (materiale) breve += ' in ' + materiale
  for (const o of opzioni) breve += ', ' + o
  if (posa) breve += ', posa ' + posa

  // — estesa: segmenti condizionali + chiusura fissa di regola d'arte
  const seg: string[] = ['Fornitura e posa in opera di ' + fr.soggettoEsteso]
  if (materiale) seg.push('in ' + materiale)
  if (misura) seg.push((fr.misura?.etichetta ?? 'misura') + ' ' + misura)
  seg.push(...opzioni)
  if (posa) seg.push('posa ' + posa)
  if (fr.normativa) seg.push('conforme a ' + fr.normativa)
  const chiusura = fr.compresi?.length
    ? `compresi ${fr.compresi.join(', ')} e quanto necessario per dare il lavoro finito a regola d'arte`
    : "inclusi accessori di fissaggio e quota parte di sfridi, in opera a regola d'arte"
  seg.push(chiusura)
  const estesa = seg.join(', ') + '.'

  return { breve, estesa }
}

// ————————————————————————————————————————————————————————————————————
// Coerenza con la voce di prezzario agganciata
// ————————————————————————————————————————————————————————————————————

/** Voce di prezzario agganciata (sottoinsieme di PriceRow, senza dipendenza). */
export interface VocePrezzario {
  codice?: string
  um?: string
  desc?: string
}

export interface EsitoCoerenza {
  ok: boolean
  avvisi: string[]
}

/** Normalizza una U.M. per il confronto (ml→m, mq/m2→m², cadauno/n/nr→cad…). */
export function normUm(um: unknown): string {
  const u = normQuery(um).replace(/[.\s]/g, '')
  const map: Record<string, string> = {
    ml: 'm', mt: 'm', mq: 'm²', m2: 'm²', mc: 'm³', m3: 'm³',
    cadauno: 'cad', cadauna: 'cad', n: 'cad', nr: 'cad', num: 'cad', pz: 'cad',
  }
  return map[u] ?? u
}

/** Firme di misura in un testo: diametri (`d25`) e dimensioni (`200x60`). */
function firmeMisura(text: unknown): { diametri: Set<string>; dimensioni: Set<string> } {
  const t = normQuery(text)
  const diametri = new Set<string>()
  const dimensioni = new Set<string>()
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/g)) {
    dimensioni.add(m[1] + 'x' + m[2])
  }
  for (const m of t.matchAll(/(?:⌀|ø|diametro|diam\.?|dn)\s*(\d+(?:[.,]\d+)?)/g)) {
    diametri.add(m[1])
  }
  return { diametri, dimensioni }
}

function intersecano(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true
  return false
}

/**
 * Verifica la coerenza della descrizione composta con la voce di prezzario
 * agganciata: U.M. della voce vs `umTipiche` della famiglia e misura impostata
 * vs misure nella descrizione della voce (pattern ⌀ n / n×m). MAI bloccante:
 * solo avvisi motivati; senza voce agganciata non ci sono avvisi.
 */
export function verificaCoerenza(input: ComponiInput, voce?: VocePrezzario | null): EsitoCoerenza {
  const avvisi: string[] = []
  const fr = frasarioFor(input.famigliaId)
  if (!fr || !voce) return { ok: true, avvisi }

  const um = normUm(voce.um)
  if (um && !fr.umTipiche.map(normUm).includes(um)) {
    avvisi.push(`L'U.M. della voce («${pulisci(voce.um)}») non è tra quelle tipiche della famiglia ${fr.nome} (${fr.umTipiche.join(', ')}).`)
  }

  const misura = pulisci(input.misura)
  if (misura && voce.desc) {
    const mia = firmeMisura(misura)
    const sua = firmeMisura(voce.desc)
    if (mia.diametri.size && sua.diametri.size && !intersecano(mia.diametri, sua.diametri)) {
      avvisi.push(`La voce di prezzario indica ⌀ ${[...sua.diametri].join('/')} mm, la descrizione composta ⌀ ${[...mia.diametri].join('/')} mm: verifica la misura o scegli la voce del diametro corretto.`)
    }
    if (mia.dimensioni.size && sua.dimensioni.size && !intersecano(mia.dimensioni, sua.dimensioni)) {
      avvisi.push(`La voce di prezzario indica ${[...sua.dimensioni].join('/')} mm, la descrizione composta ${[...mia.dimensioni].join('/')} mm: verifica le dimensioni o scegli la voce della misura corretta.`)
    }
  }

  return { ok: avvisi.length === 0, avvisi }
}

/**
 * Propone la famiglia più pertinente per la descrizione di una voce (per il
 * pre-aggancio dal pannello dettaglio): match dei sinonimi/alias del thesaurus
 * nella descrizione, frase più specifica prima. `null` se nessuna famiglia.
 */
export function suggerisciFamiglia(desc: unknown): string | null {
  const t = ' ' + normQuery(desc) + ' '
  let best: { f: Famiglia; len: number } | null = null
  for (const f of FAMIGLIE) {
    if (!frasarioFor(f.id)) continue
    for (const s of [...f.sinonimi, ...f.alias]) {
      const n = normQuery(s)
      if (n && t.includes(' ' + n + ' ') && (!best || n.length > best.len)) best = { f, len: n.length }
    }
  }
  return best ? best.f.id : null
}
