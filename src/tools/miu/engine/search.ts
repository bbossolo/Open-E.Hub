/**
 * RICERCA con ranking — motore puro sopra il thesaurus: espande la
 * query in famiglie+token, assegna uno score per voce e ordina per rilevanza.
 *
 * Contratto di retro-compatibilità: query SENZA famiglie riconosciute (codici,
 * token liberi) ⇒ stesso comportamento della ricerca storica di μ (AND di
 * token, ordine del prezzario). Il ranking entra solo quando il thesaurus
 * riconosce almeno una famiglia.
 *
 * Segnali di score:
 *  - peso di campo: descrizione breve/tipologia > keywords/materia > declaratoria;
 *  - penalità ACCESSORIO: «coperchio per passerella» resta sotto ogni passerella;
 *  - penalità CAPITOLO non impiantistico (via macrocategorie): una keyword
 *    dentro una voce edile/agronomica non la porta nei primi 10.
 */

import { expandQuery, normQuery, normMisure, stemText, type ExpandedQuery, type Famiglia } from '../../../shared/compositore/thesaurus'
import { variantiParola } from '../../../shared/compositore/sinonimi-parola'
import { textIndexFor, buildTextIndex, buildTextIndexAsync, candidatesForTerm, intersectCandidates, unionCandidates, type TextIndex } from './text-index'
import { macrocategorieFor } from '../../../shared/compositore/macrocategorie'
import type { PriceRow } from './types'

/** Pesi/penalità del ranking (numeri piccoli, confrontabili, testati dal golden set). */
const W = {
  primary: 30,      // sinonimo nella descrizione breve / tipologia
  secondary: 15,    // sinonimo in keywords / materia / settore
  body: 8,          // sinonimo solo nella declaratoria
  liberoPrimary: 6,   // token libero (misura/sigla/parola descrittiva) nella descrizione breve
  liberoSecondary: 3, // token libero in keywords/materia/settore
  liberoBody: 2,      // token libero solo nella declaratoria
  frase: 12,        // specificità: la voce contiene la frase come digitata («guaina spiralata»)
  accessorio: -25,  // la voce è l'accessorio della famiglia cercata (e NON è stato chiesto)
  accessorioChiesto: 18, // l'accessorio è stato chiesto esplicitamente («coperchio passerella») → premia
  fuoriMacro: -20,  // capitolo non impiantistico con query impiantistica
  opera: -4,        // voce di sola lavorazione: il componente (fornitura) viene prima
  risorsa: -8,      // costo elementare (RISORSA MATERIALE/UMANA/STRUMENTALE): l'opera compiuta gemella viene prima
}

// Voci di RISORSA elementare (Lombardia marca la tipologia: RISORSA MATERIALE /
// UMANA / STRUMENTALE …): a pari pertinenza la voce in opera deve stare sopra —
// scegliere il costo elementare al posto dell'opera compiuta è l'errore che il
// ranking deve prevenire (rilievo utente su Lombardia).
//
// NB: un tentativo di generalizzare questa penalità a TUTTI i prezzari via
// `naturaDichiarata`/`isMaterialeRow` (stesso segnale strutturale usato dal
// picker Materiali) è stato provato e SCARTATO: rompe la precisione reale sul
// golden set (query «armadio rack» su Veneto perde risultati corretti che il
// prezzario classifica come "materiale" per capitolo/codice ma che sono la
// risposta giusta). Il modo robusto per "mai materiale come primo risultato"
// è il toggle UI «Solo opere compiute» (default ON, nasconde i materiali) in
// legacy/index.js, non uno score generalizzato qui.
const RISORSA_RE = /^RISORSA\b/i
function isRisorsaRow(r: Pick<PriceRow, 'tipologia'>): boolean {
  return RISORSA_RE.test(String(r.tipologia || ''))
}

// Voci che descrivono un'OPERA e non il componente: per una query di componente
// stanno sotto le forniture (rompe i pareggi a favore della merce).
const OPERA_RE =
  /^(realizzazione|esecuzione|rimozion|smontaggio|montaggio|demolizion|riparazion|risanament|maggiorazion|sovrapprezzo|allaccio|allacciament|posa in opera di|posa di)/

// Doppio piano di matching (ADDITIVO): raw = normQuery+normMisure (il match
// substring storico, ora anche con misure canoniche 3x2,5→3x2.5); stem = piano
// morfologico (faretti↔faretto), già PADDED con spazi per il vincolo di match
// a inizio parola (' farett' non scatta dentro «supporto»).
interface Hay {
  primary: string; secondary: string; body: string; full: string
  primaryStem: string; secondaryStem: string; bodyStem: string; fullStem: string
}

/** Termine di ricerca sui due piani; stemP è GIÀ paddato (niente concat per riga). */
interface Term { raw: string; stem: string; stemP: string; num: boolean }
function termOf(raw: string): Term {
  const stem = stemText(raw)
  return { raw, stem, stemP: ' ' + stem, num: /\d/.test(raw) }
}

/** Match di un termine: substring raw (retro-compat) OR inizio-parola sul piano stemmato. */
function hitTerm(raw: string, stemPadded: string, t: Term): boolean {
  return raw.includes(t.raw) || stemPadded.includes(t.stemP)
}

/** Match di un token in una QUALSIASI delle sue forme equivalenti (sinonimi-parola). */
function hitAny(raw: string, stemPadded: string, forme: Term[]): boolean {
  return forme.some(t => hitTerm(raw, stemPadded, t))
}

/** Token libero → forme equivalenti come Term: PRIMA il token esatto, poi le varianti. */
function formeOf(token: string): Term[] {
  const esatto = normMisure(token)
  const forme = [termOf(esatto)]
  for (const v of variantiParola(token)) {
    const nv = normMisure(v)
    if (nv !== esatto) forme.push(termOf(nv))
  }
  return forme
}

/**
 * Match VINCOLANTE di un termine (più severo del boost): i token alfabetici
 * matchano solo a INIZIO PAROLA sul piano stemmato («vista» non passa dentro
 * «prevista»), le misure/sigle con cifre restano substring come nella ricerca
 * storica («150» dentro «50x150»). `short=true` limita il match ai campi
 * identificativi (descrizione breve/tipologia + keywords), escludendo la
 * declaratoria — che nei prezzari a capitoli è CONDIVISA tra le voci e
 * renderebbe il vincolo inutile.
 */
function hitVincolo(h: Hay, t: Term, short: boolean): boolean {
  if (t.num) return short ? (h.primary.includes(t.raw) || h.secondary.includes(t.raw)) : h.full.includes(t.raw)
  return short ? (h.primaryStem.includes(t.stemP) || h.secondaryStem.includes(t.stemP)) : h.fullStem.includes(t.stemP)
}

// Cache dell'haystack normalizzato per riga: la normalizzazione (NFD + regex su
// 4 campi) è il costo dominante su un prezzario da ~40k voci; calcolarla una
// volta sola per riga (memoizzata sull'oggetto, stabile per tutta la sessione)
// invece che a ogni scansione/battuta è il guadagno di performance principale.
const HAY_CACHE = new WeakMap<PriceRow, Hay>()

// Cache dei termini-accessorio normalizzati (statici per famiglia): evita di
// rinormalizzarli per ognuna delle ~40k righe a ogni battuta.
const ACC_CACHE = new WeakMap<Famiglia, string[]>()
function accessoriNorm(f: Famiglia): string[] {
  let a = ACC_CACHE.get(f)
  if (!a) { a = f.accessori.map(normQuery); ACC_CACHE.set(f, a) }
  return a
}

function hayOf(r: PriceRow): Hay {
  const cached = HAY_CACHE.get(r)
  if (cached) return cached
  const primary = normMisure(normQuery(`${r.desc_short ?? ''} ${r.tipologia ?? ''}`))
  const secondary = normMisure(normQuery(`${r.keywords ?? ''} ${r.materia ?? ''} ${r.settore ?? ''}`))
  const body = normMisure(normQuery(r.declaratoria ?? ''))
  const full = `${normQuery(r.codice ?? '')} ${primary} ${secondary} ${body}`
  const hay: Hay = {
    primary, secondary, body, full,
    primaryStem: ' ' + stemText(primary), secondaryStem: ' ' + stemText(secondary),
    bodyStem: ' ' + stemText(body), fullStem: ' ' + stemText(full),
  }
  HAY_CACHE.set(r, hay)
  return hay
}

// Termini della query preparati sui due piani, calcolati UNA volta per query
// (scoreRow gira su ~40k righe): la cache è sull'oggetto ExpandedQuery.
interface PreparedQuery { gruppi: Term[][]; liberi: Term[][]; frasi: Term[] }
const PREP_CACHE = new WeakMap<ExpandedQuery, PreparedQuery>()
function prepOf(exp: ExpandedQuery): PreparedQuery {
  let p = PREP_CACHE.get(exp)
  if (!p) {
    p = {
      gruppi: exp.gruppi.map(g => g.map(s => termOf(normMisure(s)))),
      // ogni token libero porta con sé le forme equivalenti (sinonimi-parola)
      liberi: exp.liberi.map(formeOf),
      frasi: exp.frasi.map(f => termOf(normMisure(f))),
    }
    PREP_CACHE.set(exp, p)
  }
  return p
}

/** Score di una voce per una query espansa; 0 = non pertinente (esclusa). */
export function scoreRow(exp: ExpandedQuery, r: PriceRow): number {
  const hay = hayOf(r)
  const q = prepOf(exp)
  let score = 1
  for (const gruppo of q.gruppi) {
    let best = 0
    for (const s of gruppo) {
      // il match LETTERALE tiene i pesi storici; il match solo-STEM (flessione:
      // «rivelazione incendi» per il sinonimo «rivelazione incendio») vale un
      // gradino sotto — una citazione flessa in descrizione non deve superare
      // la voce che scrive il sinonimo per esteso (rilievo golden Lombardia)
      if (hay.primary.includes(s.raw)) { best = W.primary; break }
      if (best < W.secondary && (hay.secondary.includes(s.raw) || hay.primaryStem.includes(' ' + s.stem))) best = W.secondary
      else if (best < W.body && (hay.body.includes(s.raw) || hay.secondaryStem.includes(' ' + s.stem) || hay.bodyStem.includes(' ' + s.stem))) best = W.body
    }
    if (!best) return 0 // AND tra famiglie: l'IDENTITÀ (famiglia) deve sempre matchare
    score += best
  }
  // Esclusione DURA di famiglia "sorella" (es. cavidotto/interrato per tubo corrugato/rigido,
  // canali di gronda/pluviali per canale portacavi): niente punteggio parziale, la voce va
  // rimossa PRIMA che il vincolo AND sui liberi (searchRows) possa raccoglierla — un libero
  // come «metallica» che matcha SOLO la famiglia sorella (es. «MATERIALI METALLICI» nel
  // settore di un canale di gronda) altrimenti la fa vincere per esclusione, perché la voce
  // vera non ha alternative nel set filtrato (rilievo utente: «canala metallica» tornava
  // canali di gronda, «corrugati da incasso» tornava «Cavidotto…»)
  const chiesto = (a: string): boolean => a.split(' ').some(w => w.length > 2 && exp.liberi.includes(w))
  const pWords0 = ' ' + hay.primary
  for (const f of exp.famiglie) {
    if (f.esclude && f.esclude.some(t =>
          (pWords0.includes(' ' + t) || hay.primaryStem.includes(' ' + t)) && !chiesto(t))) {
      return 0
    }
  }
  // Token liberi (misure, sigle, PAROLE DESCRITTIVE della query naturale): qui restano un
  // BOOST graduato che ordina per aderenza. Il vincolo AND sui token descrittivi (stopword
  // escluse) vive in searchRows, CON FALLBACK: se l'AND svuota il set («bollitore PER
  // PRODUZIONE ACCUMULO acqua» su voci scarne) si torna al solo ranking, così la famiglia
  // resta comunque visibile (US: «restituire subito i risultati»).
  // il token ESATTO vale i pesi pieni; la variante (sinonimo-parola) un
  // gradino sotto — «punto luce interrotto» mette le voci «interrotto» sopra
  // quelle «interruttore» (rilievo utente su Lombardia)
  for (const forme of q.liberi) {
    const esatto = forme[0]!
    if (hitTerm(hay.primary, hay.primaryStem, esatto)) score += W.liberoPrimary
    else if (hitTerm(hay.secondary, hay.secondaryStem, esatto)) score += W.liberoSecondary
    else if (hitTerm(hay.body, hay.bodyStem, esatto)) score += W.liberoBody
    else if (forme.length > 1) {
      if (hitAny(hay.primary, hay.primaryStem, forme)) score += W.liberoSecondary
      else if (hitAny(hay.secondary, hay.secondaryStem, forme) || hitAny(hay.body, hay.bodyStem, forme)) score += W.liberoBody
    }
  }
  for (const f of q.frasi) if (hitTerm(hay.primary, hay.primaryStem, f)) score += W.frase
  // Accessorio della famiglia (es. «coperchio» per «passerella»): se NON è stato chiesto va
  // sotto la famiglia (penalità); se è stato chiesto esplicitamente («coperchio passerella»)
  // l'utente vuole proprio quello → PREMIA (altrimenti le voci nude della famiglia, spinte dal
  // boost frase, lo seppellirebbero).
  for (const f of exp.famiglie) {
    let done = false
    for (const a of accessoriNorm(f)) {
      if (!hay.primary.includes(a)) continue
      score += chiesto(a) ? W.accessorioChiesto : W.accessorio
      done = true; break
    }
    if (done) break
  }
  // penalità fuori-contesto: manca il token di famiglia a INIZIO PAROLA nella
  // descrizione breve (un cavo «in rame ricotto» non vince su «tubo rame»;
  // «spingitubo» non è un «tubo»)
  if (exp.famiglie.length && OPERA_RE.test(hay.primary)) score += W.opera
  const pWords = ' ' + hay.primary
  for (const f of exp.famiglie) {
    // le radici `richiede` sono già tronche: valgono da prefisso di parola su
    // entrambi i piani (raw storico + stemmato, additivo)
    if (f.richiede && !f.richiede.some(t => pWords.includes(' ' + t) || hay.primaryStem.includes(' ' + t))) {
      score += W.accessorio; break
    }
  }
  // penalità capitolo non impiantistico (usa r.macro se già assegnato a load) + penalità
  // macrocategoria fuori dominio (es. tubo corrugato di IMPIANTI MECCANICI/drenaggio quando
  // la famiglia cercata è elettrica): il sinonimo letterale «corrugato»/«flessibile» è
  // condiviso da tubi di scarico/drenaggio non elettrici, che senza questo controllo
  // pareggiano con la vera voce elettrica e vincono il tie-break per ordine di catalogo
  if (exp.famiglie.length) {
    const macro = Array.isArray(r.macro) ? r.macro : macrocategorieFor(r)
    if (!macro.length) score += W.fuoriMacro
    else if (exp.famiglie.some(f => f.macroAttesa && !macro.includes(f.macroAttesa as typeof macro[number]))) {
      score += W.fuoriMacro
    } else if (macro.length === 1 && macro[0] === 'OPERE EDILI'
      && !exp.famiglie.some(f => f.macroAttesa === 'OPERE EDILI')) {
      // regola simmetrica anti-flooding: le prime parole dettano la disciplina.
      // Le famiglie SENZA macroAttesa sono impiantistiche per convenzione: una
      // voce solo-edile resta in coda esattamente come quando tornava senza macro
      score += W.fuoriMacro
    }
  }
  if (isRisorsaRow(r)) score += W.risorsa
  return score
}

// Stopword italiane: nella query naturale («punto luce interrotto A vista»)
// non portano informazione e non devono vincolare il match. Tutto il resto
// (parole descrittive, misure, sigle) è VINCOLANTE — vedi searchRows.
const STOPWORDS = new Set([
  'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'con', 'col', 'coi',
  'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'di', 'del', 'dello',
  'della', 'dei', 'degli', 'delle', 'e', 'ed', 'o', 'od', 'in', 'nel', 'nello',
  'nella', 'nei', 'negli', 'nelle', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un',
  'uno', 'una', 'per', 'su', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'tra', 'fra', 'tipo',
])

/**
 * Ricerca con ranking: filtra (score>0) e ordina per rilevanza (ordinamento
 * stabile: a parità di score resta l'ordine del prezzario). Query vuota ⇒
 * rows invariato; query senza famiglie ⇒ filtro AND storico, senza riordino.
 *
 * MIRATA MA FLESSIBILE (fix ricerca naturale, tutte le macrocategorie): con
 * famiglia riconosciuta i token liberi descrittivi (stopword escluse) tornano
 * a essere un AND come nella ricerca storica — «punto luce interrotto a vista»
 * restituisce solo le voci che contengono davvero «interrotto» e «vista», non
 * l'intera famiglia. Se l'AND svuota il set (voci scarne che non contengono
 * tutte le parole digitate) si ripiega sul solo ranking: mai zero risultati
 * quando la famiglia esiste nel prezzario.
 */
// Testo su cui è costruito l'indice trigrammi: ENTRAMBI i piani di hitTerm
// (raw + stem, ciascuno paddato) — il lato stem indicizzato per esteso rende i
// candidati selettivi anche per le frasi-sinonimo flesse. Cambiare questo
// testo richiede di rivedere la losslessness di candidatesForTerm.
function indexTextOf(r: PriceRow): string {
  const h = hayOf(r)
  return ' ' + h.full + ' |' + h.fullStem + ' '
}

/** Pre-costruisce l'indice trigrammi (SINCRONO: test/CLI, dataset piccoli). */
export function prewarmSearchIndex(rows: PriceRow[]): void {
  buildTextIndex(rows, indexTextOf)
}

/**
 * Pre-costruzione ASINCRONA a chunk per la UI (da chiamare in idle dopo il
 * load del prezzario): il thread resta libero, le ricerche nel frattempo
 * scansionano come oggi e l'indice entra in gioco appena pronto.
 */
export async function prewarmSearchIndexAsync(rows: PriceRow[]): Promise<void> {
  await buildTextIndexAsync(rows, indexTextOf)
}

// Prefiltro candidati per il ramo RANKIZZATO: AND tra i gruppi-famiglia, OR
// (unione) dentro il gruppo. null ⇒ nessun prefiltro possibile → scansione.
// MAI filtrare su liberi/vincolanti: il fallback vuole l'intero set scored.
// Un gruppo poco SELETTIVO (candidati oltre metà catalogo) non filtra: a quel
// punto scansionare costa meno che unire/intersecare liste enormi.
function candidatesForGroups(idx: TextIndex, gruppi: Term[][], totale: number): Uint32Array | null {
  const soglia = totale / 2
  let cand: Uint32Array | null = null
  for (const gruppo of gruppi) {
    let g: Uint32Array | null = null
    let senzaFiltro = false
    for (const s of gruppo) {
      const c = candidatesForTerm(idx, s)
      if (c === null) { senzaFiltro = true; break } // sinonimo troppo corto: il gruppo non filtra
      g = g ? unionCandidates(g, c) : c
      if (g.length > soglia) { senzaFiltro = true; break }
    }
    if (senzaFiltro || g === null) continue
    cand = cand ? intersectCandidates(cand, g) : g
    if (!cand.length) break
  }
  return cand
}

export function searchRows(rows: PriceRow[], q: unknown): PriceRow[] {
  // normMisure sulla query intera PRIMA di espandere: «diametro 25» diventa il
  // singolo token «ø25», identico alla forma canonica dell'haystack.
  const nq = normMisure(normQuery(q))
  if (!nq) return rows
  const exp = expandQuery(nq)
  const idx = textIndexFor(rows)
  if (!exp.famiglie.length) {
    // ramo storico (query-codice, parole ignote): AND letterale, NIENTE
    // stemming — solo le misure sono canoniche su entrambi i lati (additivo)
    const pass = (r: PriceRow): boolean => { const h = hayOf(r).full; return exp.liberi.every(t => h.includes(t)) }
    if (idx) {
      let cand: Uint32Array | null = null
      for (const t of exp.liberi) {
        const c = candidatesForTerm(idx, termOf(t))
        if (c) cand = cand ? intersectCandidates(cand, c) : c
        if (cand && !cand.length) return []
      }
      if (cand) {
        const out: PriceRow[] = []
        for (const i of cand) if (pass(rows[i]!)) out.push(rows[i]!)
        return out
      }
    }
    return rows.filter(pass)
  }
  const scored: { r: PriceRow; s: number; i: number }[] = []
  const cand = idx ? candidatesForGroups(idx, prepOf(exp).gruppi, rows.length) : null
  if (cand) {
    for (const i of cand) {
      const s = scoreRow(exp, rows[i]!)
      if (s > 0) scored.push({ r: rows[i]!, s, i })
    }
  } else {
    for (let i = 0; i < rows.length; i++) {
      const s = scoreRow(exp, rows[i]!)
      if (s > 0) scored.push({ r: rows[i]!, s, i })
    }
  }
  // Famiglia riconosciuta ma NESSUNA voce col sinonimo per esteso (capita sui
  // prezzari che descrivono per attributi: «Faretto…; geometria: orientabile»):
  // ripiego sull'AND stem-aware dei token digitati, RANKIZZATO per campo —
  // meglio le voci che hanno tutte le parole (anche flesse) che zero risultati,
  // e prima quelle che le hanno nella descrizione breve.
  if (!scored.length) {
    const terms = nq.split(' ').filter(t => !STOPWORDS.has(t)).map(termOf)
    if (!terms.length) return []
    const ripiego: { r: PriceRow; s: number; i: number }[] = []
    for (let i = 0; i < rows.length; i++) {
      const h = hayOf(rows[i]!)
      if (!terms.every(t => hitTerm(h.full, h.fullStem, t))) continue
      let s = 0
      for (const t of terms) {
        if (hitTerm(h.primary, h.primaryStem, t)) s += W.liberoPrimary
        else if (hitTerm(h.secondary, h.secondaryStem, t)) s += W.liberoSecondary
        else s += W.liberoBody
      }
      if (isRisorsaRow(rows[i]!)) s += W.risorsa
      ripiego.push({ r: rows[i]!, s, i })
    }
    ripiego.sort((a, b) => b.s - a.s || a.i - b.i)
    return ripiego.map(x => x.r)
  }
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  // Vincolo a CASCATA sui token digitati (ogni token passa in una qualsiasi
  // delle sue forme equivalenti — «presa stagna» tiene anche le voci «IP65»):
  // 1) prima i campi identificativi (descrizione breve): l'utente specifico
  //    («punto luce interrotto a vista») vuole SOLO quelle voci;
  // 2) se la breve non basta, il testo completo (declaratoria inclusa);
  // 3) se nemmeno quello, resta il ranking di famiglia (mai zero risultati).
  const vincolanti = exp.liberi.filter(t => !STOPWORDS.has(t)).map(formeOf)
  if (vincolanti.length) {
    const passa = (r: PriceRow, short: boolean): boolean => {
      const h = hayOf(r)
      return vincolanti.every(forme => forme.some(t => hitVincolo(h, t, short)))
    }
    let strict = scored.filter(x => passa(x.r, true))
    if (!strict.length) strict = scored.filter(x => passa(x.r, false))
    if (strict.length) return strict.map(x => x.r)
  }
  return scored.map(x => x.r)
}

/**
 * Righe di TARIFFA ORARIA MANODOPERA (categorie CCNL edile: operaio comune/
 * qualificato/specializzato, capo squadra…) — pescate dal capitolo dedicato
 * che OGNI prezzario regionale porta già (es. Veneto "RU", umi="h"; verificato
 * su più regioni), non un elenco fabbricato: solo un filtro sul catalogo reale
 * già caricato.
 *
 * UM a tempo (ora/h) da SOLO non basta: molte «opere in economia» (scavo a
 * mano, demolizioni, uso di scalpello, videoispezioni…) sono anch'esse
 * prezzate a ora ma NON sono manodopera — servono ENTRAMBI i segnali: UM a
 * tempo E il RUOLO in testa alla descrizione (non ovunque nel testo: una voce
 * come «INFORMAZIONE DEI LAVORATORI — operaio specializzato», capitolo
 * sicurezza/formazione, contiene "operaio" ma NON è una tariffa di manodopera
 * — le vere righe del capitolo manodopera iniziano SEMPRE col ruolo).
 */
const MANODOPERA_TIME_UM = new Set(['h', 'h.', 'hr', 'ora', 'ore'])
const MANODOPERA_ROLE_RE = /^(OPERAI[OA]\b|MANODOPERA\b|CAPO\s*SQUADRA|CAPOSQUADRA|MANOVALE\b|AIUTANTE\b|GEOMETRA\b|DIRIGENTE\s+TECNICO|IMPIEGATO\s+TECNICO|DIRETTORE\s+(DI\s+)?CANTIERE|ASSISTENTE\b|AUTISTA\b)/i

/** True se la riga è una tariffa oraria di manodopera (vedi sopra). Pura. */
export function isManodoperaRow(r: Pick<PriceRow, 'um' | 'desc_short' | 'codice'> & Partial<Pick<PriceRow, 'tipologia'>>): boolean {
  // Lombardia marca la tipologia: RISORSA UMANA = tariffa di manodopera anche
  // quando il ruolo non è nel FRASARIO («Impiegato edile di livello 7°»)
  if (/^RISORSA UMANA$/i.test(String(r.tipologia || ''))) return true
  const um = String(r.um || '').trim().toLowerCase()
  if (!MANODOPERA_TIME_UM.has(um)) return false
  return MANODOPERA_ROLE_RE.test(String(r.desc_short || '').trim())
}

/**
 * Ricerca ristretta alle sole righe di manodopera: stesso motore di
 * ranking di `searchRows`, applicato a un pool già filtrato — niente più
 * "scavo" o altre voci non a tariffa oraria tra i risultati della manodopera.
 */
export function searchManodoperaRows(rows: PriceRow[], q: unknown): PriceRow[] {
  return searchRows(rows.filter(isManodoperaRow), q)
}

/**
 * NOLI (sezione C dell'Analisi Prezzi): righe di noleggio mezzi/attrezzature.
 * Segnale testuale in testa alla descrizione («NOLO …», «NOLEGGIO …») — nei
 * prezzari reali il capitolo noli usa queste diciture in apertura; una voce di
 * opera compiuta che CITA un nolo nel corpo non deve passare.
 */
const NOLO_RE = /^(NOLO|NOLEGGIO|NOLI)\b/i

/** True se la riga è un nolo (capitolo noleggi). Pura. */
export function isNoloRow(r: Pick<PriceRow, 'desc_short'> & Partial<Pick<PriceRow, 'tipologia'>>): boolean {
  // Lombardia: le RISORSE STRUMENTALI (produttive = mezzi a ora, tecnologiche =
  // apprestamenti) sono l'equivalente dei noli anche senza «NOLO» in testa
  if (/^RISORSA STRUMENTALE/i.test(String(r.tipologia || ''))) return true
  return NOLO_RE.test(String(r.desc_short || '').trim())
}

/** Ricerca ristretta ai soli NOLI: stesso ranking di searchRows su pool filtrato. */
export function searchNoloRows(rows: PriceRow[], q: unknown): PriceRow[] {
  return searchRows(rows.filter(isNoloRow), q)
}

/**
 * MATERIALI (sezione B): nelle analisi le componenti elementari vanno assunte
 * come COSTI, non come opere compiute — si ESCLUDONO le voci «in opera»/«posa
 * in opera» (già comprensive di manodopera), le tariffe di manodopera e i noli.
 * Restano fornitura/materiali a piè d'opera e prezzi elementari.
 */
/*
 * I marcatori di un'OPERA COMPIUTA nei prezzari italiani.
 *
 * Le prime forme («in opera», «fornitura e posa») sono quelle ovvie. Le ultime due sono
 * quelle che contano davvero, e le abbiamo imparate sul Veneto: le sue voci-cavo — che
 * SONO fornitura e posa — non scrivono MAI le parole «in opera». Scrivono la formula di
 * rito: «Compresi: … formazione di teste con capicorda … giunzioni … collegamenti in
 * morsettiera … quant'altro necessario alla realizzazione del lavoro A REGOLA D'ARTE».
 * Cercando solo «in opera» se ne riconoscevano 64 su 781; con la formula di rito, 307.
 * Un cavo agganciato al costo elementare del rame nudo è un errore di computo: il prezzo
 * esce basso e la voce non è appaltabile.
 */
const OPERA_COMPIUTA_RE = /\b(posa\s+in\s+opera|in\s+opera|fornitura\s+e\s+posa|posti?\s+in\s+opera|dat[oa]\s+in\s+opera)\b|a\s+regola\s+d[’']\s*arte|quant[’']?\s*altro\s+necessario/i

/**
 * Come i prezzari DICHIARANO la natura di una voce, nel loro capitolo di primo livello.
 * Il vocabolario è stato censito su TUTTI i prezzari interni, non immaginato:
 *
 *   materiale · «MATERIALI» (Veneto, Campania) · «MT01 - MATERIALI» (Emilia-Romagna) ·
 *              «MATERIALI IN FORNITURA A PIE' D'OPERA» (Friuli) · «Prezzi elementari»
 *              (Bolzano) · «PRODOTTI DA COSTRUZIONE», «PRODOTTI C.A.M.» (Calabria,
 *              Basilicata) · «RISORSA MATERIALE» (Lombardia) · noli e manodopera
 *   opera    · «OPERE …», «OPERE COMPIUTE …», «IMPIANTI …», «LAVORI/LAVORAZIONI …»,
 *              «NUOVE COSTRUZIONI», «RISTRUTTURAZIONI», «PARTE D - IMPIANTI ELETTRICI»
 *              (Cratere), «Tubazioni, fornitura e posa in opera» (Bolzano)
 *
 * I listini METEL non dichiarano nulla: sono cataloghi di PRODOTTO, e infatti non hanno
 * opere compiute — il ripiego (se il filtro svuota il pool, si tiene tutto) li copre.
 */
const MATERIALE_L1_RE = /\bMATERIAL[EI]\b|\bPRODOTTI\b|PREZZI\s+ELEMENTARI|\bNOL(I|EGGI)\b|\bATTREZZATURE\b|\bMANODOPERA\b|RISORS[AE]\s+(MATERIALE|UMANA|STRUMENTALE)/i
const CODICE_MATERIALE_RE = /(^|[-.\s])PR[-.]A[.\d]/i
const OPERA_L1_RE = /\bOPER[AE]\b|\bIMPIANT[IO]\b|\bLAVOR(I|AZIONI)\b|NUOVE\s+COSTRUZIONI|RISTRUTTURAZION|POSA\s+IN\s+OPERA|\bTUBAZIONI\b/i

/**
 * Il prezzario, quando può, DICHIARA la natura della voce — e allora si crede a lui, non a
 * un'euristica sul testo. Il Veneto ha un capitolo di primo livello intero intitolato
 * «MATERIALI (escluse spese generali e utile dell'impresa)» (8.883 voci) e uno «NOLI»; le
 * opere compiute stanno sotto «OPERE ELETTRICHE», «OPERE EDILI», «LAVORAZIONI FINITE».
 * Nessuna regex sul testo può competere con un'informazione strutturale così esplicita.
 *
 * Ritorna `true` (materiale), `false` (opera compiuta) o `null` (il prezzario non lo dice,
 * si passa alle euristiche).
 */
function naturaDichiarata(r: Partial<Pick<PriceRow, 'tipologia' | 'liv1' | 'codice' | 'desc_short' | 'declaratoria'>>): boolean | null {
  // Alcuni prezzari lo dicono già nel CODICE. Il Veneto codifica i materiali come
  // `VEN26-PR-A.xx.xx.xx`: tutte e 8.883 le voci del capitolo «MATERIALI» hanno quel
  // prefisso, le opere compiute hanno codici numerici. Verificato: `PR-A` non compare in
  // nessun altro prezzario, quindi non c'è rischio di collisione.
  if (CODICE_MATERIALE_RE.test(String(r.codice || ''))) return true

  const tip = String(r.tipologia || '')
  if (/^RISORSA (MATERIALE|UMANA|STRUMENTALE)/i.test(tip)) return true
  if (/^(OPERA COMPIUTA|PRODOTTO IN OPERA|LAVORO PROVVISIONALE)\b/i.test(tip)) return false

  const l1 = String(r.liv1 || '')
  if (!l1) return null
  // MATERIALE va provato PER PRIMO: «MATERIALI IMPIANTI MECCANICI» contiene anche
  // «IMPIANTI», e «MATERIALI IN FORNITURA A PIE' D'OPERA» contiene anche «D'OPERA».
  if (MATERIALE_L1_RE.test(l1)) {
    // Eccezione: la Valle d'Aosta titola l'INTERO capitolo disciplinare
    // «P60 - MATERIALI - IMPIANTI ELETTRICI» anche quando dentro ci sono voci di
    // fornitura E posa (es. «Cavo … fornito e posato in opera»): qui il titolo di
    // capitolo è un'etichetta di disciplina, non una dichiarazione di natura riga per
    // riga. Se il testo della voce dichiara ESPLICITAMENTE l'opera compiuta, quel
    // segnale (più specifico, a livello di riga) vince sul titolo di capitolo (più
    // generico, a livello di sezione): si torna a `null` e si passa alle euristiche.
    const testo = `${r.desc_short || ''} ${r.declaratoria || ''}`
    if (OPERA_COMPIUTA_RE.test(testo)) return null
    return true
  }
  if (OPERA_L1_RE.test(l1)) return false
  return null
}

/** True se la riga è un costo elementare di MATERIALE (non opera compiuta/manodopera/nolo). Pura. */
export function isMaterialeRow(r: Pick<PriceRow, 'um' | 'desc_short' | 'codice' | 'declaratoria'> & Partial<Pick<PriceRow, 'tipologia' | 'liv1'>>): boolean {
  // Se il prezzario dichiara la natura della voce, decide lui.
  const dichiarata = naturaDichiarata(r)
  if (dichiarata !== null) return dichiarata
  if (isManodoperaRow(r)) return false
  if (isNoloRow(r)) return false
  const testo = `${r.desc_short || ''} ${r.declaratoria || ''}`
  return !OPERA_COMPIUTA_RE.test(testo)
}

/**
 * True se la riga è un'OPERA COMPIUTA: fornitura E posa, finita e a regola d'arte.
 *
 * È ciò che serve a una distinta di CAVI: un computo non mette a prezzo il rame nudo a piè
 * d'opera — mette il cavo **fornito e posato**, con manodopera, accessori e sfridi dentro.
 * Agganciare un cavo a un costo elementare di materiale è un errore di computo: il prezzo
 * esce basso e la voce non è appaltabile.
 */
export function isOperaCompiutaRow(
  r: Pick<PriceRow, 'um' | 'desc_short' | 'codice' | 'declaratoria'> & Partial<Pick<PriceRow, 'tipologia' | 'liv1'>>,
): boolean {
  const dichiarata = naturaDichiarata(r)
  if (dichiarata !== null) return !dichiarata
  if (isManodoperaRow(r) || isNoloRow(r)) return false
  return OPERA_COMPIUTA_RE.test(`${r.desc_short || ''} ${r.declaratoria || ''}`)
}

/** Ricerca ristretta ai soli MATERIALI elementari: ranking di searchRows su pool filtrato. */
export function searchMaterialeRows(rows: PriceRow[], q: unknown): PriceRow[] {
  return searchRows(rows.filter(isMaterialeRow), q)
}

/**
 * Parole del capitolo manodopera che indicano la categoria DISCIPLINARE (non
 * generica) per macrocategoria di impianto — es. "OPERAIO QUALIFICATO
 * ELETTRICISTA" per gli impianti elettrici, "OPERAIO QUALIFICATO IMPIANTISTICA
 * TERMOIDRAULICA"/"IGIENICO-SANITARIA" per i meccanici (visti nel capitolo
 * manodopera reale, es. Veneto). Nessuna sigla di livello fissa (quelle
 * cambiano da prezzario a prezzario, es. Lombardia le chiama B1/C2) — solo
 * parole di ricerca sul catalogo manodopera già caricato.
 */
const MACRO_MANODOPERA_KEYWORDS: Record<string, RegExp> = {
  'IMPIANTI ELETTRICI': /ELETTRIC/i,
  ILLUMINAZIONE: /ELETTRIC/i,
  'IMPIANTI MECCANICI': /IDRAULIC|TERMOIDRAULIC|IGIENIC[O0][\s-]*SANITARI/i,
  'IMPIANTI ANTINCENDIO': /IDRAULIC|ELETTRIC/i,
  'OPERE EDILI': /EDIL|MURATOR|CARPENTIER|PIASTRELLIST|IMBIANCHIN|PITTORE/i,
}

/**
 * Propone le righe manodopera più adatte alla macrocategoria di impianto della
 * voce in composizione: prima le categorie DISCIPLINARI del
 * prezzario aperto (es. "operaio qualificato elettricista" per gli impianti
 * elettrici); se il prezzario non ne ha di specifiche per quella disciplina,
 * ripiega sulla coppia base specializzato+qualificato (la "squadra tipo" da 2,
 * livelli generici — mai fabbricati: solo quello che il prezzario ha davvero).
 * Nessun default se il prezzario aperto non ha affatto manodopera.
 */
export function suggestManodoperaPerMacro(rows: PriceRow[], macro?: string): PriceRow[] {
  const pool = rows.filter(isManodoperaRow).filter(r => !/sovrapprezzo/i.test(r.desc_short || ''))
  if (!pool.length) return []
  const re = macro ? MACRO_MANODOPERA_KEYWORDS[macro] : undefined
  const disciplinare = re ? pool.filter(r => re.test(r.desc_short || '')) : []
  if (disciplinare.length) return disciplinare.slice(0, 2)
  const specializzato = pool.find(r => /SPECIALIZZAT/i.test(r.desc_short || ''))
  const qualificato = pool.find(r => /QUALIFICAT/i.test(r.desc_short || '') && r !== specializzato)
  return [specializzato, qualificato].filter((r): r is PriceRow => !!r)
}
