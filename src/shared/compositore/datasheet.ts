/**
 * ESTRAZIONE VOCI da SCHEDA TECNICA (PDF) — motore PURO e OFFLINE.
 *
 * Dato il TESTO grezzo di una scheda tecnica di prodotto (già estratto a monte
 * con pdf.js: qui NON si tocca né il DOM né pdf.js, così il modulo è testabile),
 * riconosce una o più famiglie del thesaurus e mappa le caratteristiche trovate
 * sugli slot REALI del FRASARIO (misura/materiale/posa/opzioni), proponendo voci
 * di computo «candidate» da rivedere nel compositore.
 *
 * Nessun LLM, nessuna rete: solo il vocabolario già in casa (sinonimi/alias del
 * thesaurus + valori dei chip del FRASARIO) e pattern deterministici. Regola
 * «se non c'è non si menziona»: uno slot resta vuoto se nessun valore combacia —
 * niente dati inventati; l'utente completa nel CMP. I `valori` proposti sono
 * SEMPRE valori realmente presenti nel FRASARIO della famiglia (mai coniati).
 */

import { FAMIGLIE, normQuery, type Famiglia } from './thesaurus'
import { frasarioFor, type FrasarioFamiglia } from './componi'
import {
  estraiCaratteristicheSettore, settoreEsplicito, CHIAVI_BREVE, type SettoreScheda,
} from './datasheet-profili'
import { rilevaMarchio } from './marchi'

/** Match di una famiglia sul testo della scheda, con le frasi che l'hanno guidato. */
export interface FamigliaMatch {
  famiglia: Famiglia
  /** punteggio grezzo (somma lunghezze delle frasi-sinonimo riconosciute) */
  score: number
  /** frasi (sinonimi/alias) effettivamente trovate nel testo — spiegabilità */
  evidenze: string[]
}

/** Voce di computo proposta dalla scheda, da rivedere nel compositore. */
export interface VoceProposta {
  famigliaId: string
  famNome: string
  misura?: string
  materiale?: string
  posa?: string
  opzioni?: string[]
  um: string
  /** 0..1 — per ordinamento ed etichetta (alta/media/bassa) in UI */
  confidenza: number
  /** frammenti (famiglia + valori mappati) che motivano la proposta */
  evidenze: string[]
  /** produttore (dal nome legale in scheda: «… S.p.A./S.r.l./GmbH») — best-effort */
  marca?: string
  /** modello/serie del prodotto (dal titolo della scheda) — best-effort */
  modello?: string
  /** codice/sigla di catalogo (dal titolo della scheda) — best-effort */
  codice?: string
  /** caratteristiche tecniche REALI lette dalla scheda (valori verbatim) */
  caratteristiche?: Caratteristica[]
  /** voce già composta dai valori reali della scheda (non da riscrivere) */
  descBreve?: string
  descEstesa?: string
  /** comparto impiantistico della famiglia (chip in UI) — additivo */
  settore?: SettoreScheda
  /** vero se la marca viene dalla knowledge base marchi (badge in UI) — additivo */
  marcaNota?: boolean
  /** codice EAN-13 se presente in scheda — additivo */
  ean?: string
}

/** Una caratteristica tecnica estratta dalla scheda, col suo valore REALE. */
export interface Caratteristica { etichetta?: string; valore: string }

/**
 * Estrae le CARATTERISTICHE TECNICHE reali dalla scheda (valori verbatim, non i
 * chip generici del FRASARIO): così la voce da scheda non va riscritta a mano.
 * Ordine di lettura da computo. Best-effort: prende ciò che riconosce, salta il
 * resto (regola «se non c'è non si menziona»).
 */
export function estraiCaratteristiche(raw: unknown, settore?: SettoreScheda): Caratteristica[] {
  // dispatch per settore (datasheet-profili.ts); senza settore = profilo
  // illuminazione, replica esatta del comportamento storico (retrocompat).
  return estraiCaratteristicheSettore(raw, settore)
}

/** Compone breve+estesa di una voce DA SCHEDA: soggetto famiglia + caratteristiche
 *  reali + riferimento marca/modello/codice. Niente valori inventati. */
export function voceDaScheda(
  fr: FrasarioFamiglia,
  carat: Caratteristica[],
  ident: { marca?: string; modello?: string; codice?: string },
  settore?: SettoreScheda,
): { breve: string; estesa: string } {
  const chiaveBreve = new Set(CHIAVI_BREVE[settore ?? 'illuminazione'])
  // chiave anche per i valori SENZA etichetta che iniziano con la sigla (EER 3,19)
  const breveSpecs = carat
    .filter(c => (c.etichetta && chiaveBreve.has(c.etichetta)) || (!c.etichetta && chiaveBreve.has(c.valore.split(' ')[0])))
    .map(c => c.valore)
  // Marca/modello vanno nella breve ANCHE senza codice riconosciuto (bug: prima
  // il suffisso era gated solo su ident.codice, quindi una scheda con marca e
  // modello letti ma senza una sigla di catalogo che il regex riconoscesse
  // restava generica — la descrizione perdeva l'unica cosa che la rende una
  // voce "da questa scheda" e non intercambiabile con qualunque altra).
  const suffix = (ident.marca || ident.modello || ident.codice)
    ? ` — ${[ident.marca, ident.modello].filter(Boolean).join(' ')}${ident.codice ? ` (${ident.codice})` : ''}`.replace(/\s+/g, ' ').trimEnd()
    : ''
  const breve = [fr.soggettoBreve, breveSpecs.join(', ')].filter(Boolean).join(' ') + suffix
  const rif = ident.marca || ident.modello
    ? `tipo ${[ident.marca, ident.modello].filter(Boolean).join(' ')}${ident.codice ? ` (cod. ${ident.codice})` : ''} o equivalente`
    : ident.codice ? `codice ${ident.codice}, o equivalente` : ''
  const seg = ['Fornitura e posa in opera di ' + fr.soggettoEsteso]
  for (const c of carat) seg.push(c.etichetta ? `${c.etichetta} ${c.valore}` : c.valore)
  if (rif) seg.push(rif)
  seg.push("in opera a regola d'arte")
  return { breve, estesa: seg.join(', ') + '.' }
}

/**
 * Ricalcola breve/estesa di una `VoceProposta` già estratta — serve per quando
 * marca/modello/codice vengono ARRICCHITI DOPO l'estrazione (es. un match nel
 * listino METEL corregge o completa la marca): senza ricalcolare, la voce
 * mostrata/caricata nel compositore resta quella con l'identificazione
 * originale (magari ancora generica), anche se nel frattempo è stata
 * migliorata. `null` se la famiglia non è più risolvibile (non dovrebbe
 * succedere: la voce l'ha già attraversata in estrazione).
 */
export function rideriveDescrizione(p: VoceProposta): { breve: string; estesa: string } | null {
  const fr = frasarioFor(p.famigliaId)
  if (!fr) return null
  return voceDaScheda(fr, p.caratteristiche || [], { marca: p.marca, modello: p.modello, codice: p.codice }, p.settore)
}

/** Estrae il PRODUTTORE dal nome legale in scheda (best-effort). */
export function estraiMarca(raw: unknown): string | undefined {
  const t = String(raw ?? '').replace(/\s+/g, ' ')
  const m = t.match(/([A-Za-z0-9][\wÀ-ÿ&.'’-]*(?:\s+[A-Za-z0-9][\wÀ-ÿ&.'’-]*){0,3})\s+(?:S\.?p\.?A\.?|S\.?r\.?l\.?|S\.?A\.?|GmbH|Ltd\.?|Inc\.?|B\.?V\.?|A\.?G\.?|N\.?V\.?)\b/)
  if (!m) return undefined
  // il nome sono 1-3 parole SUBITO prima del suffisso: le raccolgo da destra e
  // mi fermo al primo frammento-spec (II., IP66., CE, DALI…) o token senza lettere.
  const words = m[1].trim().split(/\s+/)
  // parola-nome: alfabetica (anche con &'’.-) o del tipo «3F»/«2M» (1-2 cifre + lettere)
  const isNome = (w: string) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ&'’.-]*$/.test(w) || /^\d{1,2}[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9&'’.-]*$/.test(w)
  const SPEC = /^(i{1,3}|iv|v|ce|enec|dali|led|cri|cct|ral|uv|dmx|rgbw?|selv|sdcm)$/i
  const clean: string[] = []
  for (let k = words.length - 1; k >= 0; k--) {
    const w = words[k].replace(/[.,;:]+$/, '')
    if (!isNome(w) || SPEC.test(w)) break
    clean.unshift(w)
    if (clean.length === 3) break
  }
  const nome = clean.join(' ').trim()
  return nome.length >= 2 ? nome : undefined
}

// colori di finitura da scartare in coda al modello (non identificano il prodotto)
const COLORI = /\b(grigio|bianco|nero|antracite|corten|ruggine|silver|argento|alluminio|bronzo|sabbia|verde|blu|rosso|marrone|inox|grafite)\b/i

/** Estrae modello + codice di catalogo (+ EAN) dal TITOLO della scheda (best-effort).
 *  Un codice ETICHETTATO («Codice articolo: …», «Item no. …») ha priorità sul
 *  pattern posizionale; l'EAN-13 viaggia a parte (aggancio prezzo METEL). */
export function estraiRiferimento(titolo: unknown): { modello?: string; codice?: string; ean?: string } {
  const t = String(titolo ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return {}
  const ean = t.match(/\b(\d{13})\b/)?.[1]
  // 1) codice etichettato dal frasario delle schede (ita/eng/fra/ted)
  const etic = t.match(/\b(?:codice\s+(?:articolo|prodotto)|cod\.?\s*art\.?|item\s+no\.?|part\s+no\.?|r[ée]f\.?|artikel(?:nummer)?|model(?:lo)?)\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]{2,20})\b/i)
  // 2) posizionale: sigla lettere+cifre (SU83.15, QG1234, NX-30, 5066) — evita
  //    anni isolati (1900–2099) e valori CCT (es. «4000 K»)
  const cod = etic?.[1]
    ?? t.replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\b\d{4}\s*K\b/gi, ' ')
      .match(/\b([A-Z]{1,5}-?\d{1,6}(?:[.\-/][A-Z0-9]{1,6}){0,2}|\d{4,6})\b/)?.[1]
  const codice = cod?.trim()
  let modello = t
  if (codice) modello = modello.replace(codice, ' ')
  if (ean) modello = modello.replace(ean, ' ')
  modello = modello
    .replace(/\b(?:codice\s+(?:articolo|prodotto)|cod\.?\s*art\.?|item\s+no\.?|part\s+no\.?|r[ée]f\.?|artikel(?:nummer)?|model(?:lo)?)\s*[:.]?/gi, ' ')
    .split(/[•*]/)[0] // gli elenchi puntati non sono il modello (fallback senza titolo)
    .replace(/[/|·–—-]+/g, ' ').replace(COLORI, ' ').replace(/\s+/g, ' ').trim()
  // il modello è una SIGLA breve, non una frase: cap a 6 parole (il fallback
  // «primi 120 caratteri del testo» altrimenti travasa mezzo paragrafo)
  const words = modello.split(' ')
  if (words.length > 6) modello = ''
  return { modello: modello || undefined, codice, ean }
}

/**
 * INDIZI da SCHEDA TECNICA — gergo del COSTRUTTORE (non del prezzario) che
 * identifica una famiglia quando la dicitura-prezzario non compare verbatim: le
 * schede dicono «apparecchio / flusso luminoso / lm/W / CCT / LED», non
 * «plafoniera» o «corpo illuminante». Tenuti QUI e NON nei sinonimi del
 * thesaurus (verificato da Furio sui prezzari) per non inquinare la ricerca. La
 * soglia `minHit` (n. di termini co-presenti) evita i falsi positivi dei termini
 * generici (led, apparecchio…). Estendibile per l'ampio spettro impianti.
 */
interface IndizioScheda {
  famigliaId: string
  /** termini (già in forma normalizzabile) cercati come sottostringa nel testo */
  termini: string[]
  /** quanti termini distinti devono co-comparire perché la famiglia sia riconosciuta */
  minHit: number
}
const INDIZI_SCHEDA: IndizioScheda[] = [
  {
    famigliaId: 'corpo-illuminante',
    termini: [
      'illuminotecniche', 'flusso luminoso', 'efficacia luminosa', 'sorgente luminosa',
      'temperatura di colore', 'resa cromatica', 'lm/w', ' lm ', 'lumen', ' led', 'cct',
      'ugr', 'apparecchio', 'plafonier', 'proiettore', 'downlight', 'faretto', 'lampada',
      'sdcm', 'macadam', 'l80b10', 'l90',
      // schede in inglese (verificato su Thorn/Zumtobel reali)
      'high bay', 'highbay', 'luminaire', 'luminous flux',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'pompa-di-calore',
    termini: [
      'cop', 'scop', 'refrigerante', 'r32', 'r410', 'r290', 'compressore inverter',
      'unita esterna', 'monoblocco', 'split', 'resa termica', 'aria/acqua', 'pdc',
      'pompa di calore',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'gruppo-frigo',
    termini: [
      'chiller', 'refrigeratore', 'eer', 'eseer', 'potenza frigorifera', 'capacita frigorifera',
      'resa frigorifera', 'evaporatore', 'condensatore', 'compressore scroll', 'compressore a vite',
      'free cooling', 'circuiti frigoriferi', 'refrigerante',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'unita-trattamento-aria',
    termini: [
      'uta', 'recuperatore di calore', 'portata aria', 'prevalenza utile', 'batteria di scambio',
      'batteria calda', 'batteria fredda', 'filtri epm', 'sezione ventilante', 'trattamento aria',
      'plug fan', 'umidificazione',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'ventilconvettore',
    termini: [
      'fan coil', 'fancoil', 'ventilconvettore', 'velocita ventilatore', 'a cassetta',
      'resa frigorifera', 'resa termica', 'bacinella condensa', 'mobiletto',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'gruppo-elettrogeno',
    termini: [
      'prp', 'ltp', 'gruppo elettrogeno', 'motore diesel', 'alternatore', 'serbatoio',
      'avviamento automatico', 'cofanatur', 'insonorizzat', 'iso 8528', 'quadro ats', 'genset',
      // schede in inglese (verificato su Caterpillar reali: «Genset power rating»)
      'generator set', 'diesel generator', 'standby power', 'prime power',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'gruppo-continuita-ups',
    termini: [
      'ups', 'doppia conversione', 'line-interactive', 'vfi', 'autonomia', 'batterie',
      'bypass', 'fattore di potenza', 'gruppo di continuita', 'vrla', 'soccorritore',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'bollitore-scaldacqua',
    termini: [
      'accumulo', 'acqua calda sanitaria', 'acs', 'serpentino', 'vetrificat', 'anodo',
      'coibentazione', 'bollitore', 'scaldacqua', 'scambiatore',
    ],
    minHit: 3,
  },
  {
    famigliaId: 'radiatore',
    termini: ['radiatore', 'elementi', 'interasse', 'delta t 50', 'en 442', 'termoarredo'],
    minHit: 3,
  },
  {
    famigliaId: 'stazione-ricarica-ev',
    termini: ['wallbox', 'mode 3', 'type 2', 'ricarica', 'rfid', 'ocpp', 'iec 61851'],
    minHit: 3,
  },
  {
    famigliaId: 'quadro-elettrico-bt',
    termini: ['forma di segregazione', 'icw', 'en 61439', 'unita funzionali', 'quadro elettrico'],
    minHit: 3,
  },
  {
    // verificato su scheda Grundfos Serie 100 reale
    famigliaId: 'circolatore',
    termini: [
      'circolatore', 'circolatori', 'pompa di circolazione', 'rotore bagnato',
      'prevalenza', 'eei', 'indice di efficienza', 'ricircolo',
    ],
    minHit: 3,
  },
  {
    // solo gergo INEQUIVOCABILMENTE bus (knx/eib/ets/konnex): «attuatore» o
    // «din» da soli comparirebbero anche su valvole motorizzate e contattori
    famigliaId: 'attuatore-knx',
    termini: [
      'knx', 'eib', 'konnex', 'ets', 'knx secure', 'bus knx', 'twisted pair knx',
      // schede in inglese (verificato su Zennio MAXinBOX reali)
      'multifunction actuator', 'din rail', 'shutter channel',
    ],
    minHit: 2,
  },
  {
    // le schede TVCC sono quasi sempre in inglese (verificato su Hikvision reali)
    famigliaId: 'telecamera-tvcc',
    termini: [
      'network camera', 'dome camera', 'fixed dome', 'bullet', 'cmos', 'poe', 'onvif',
      'varifocal', 'wdr', 'day/night', 'videosorveglianza', 'telecamera',
    ],
    minHit: 3,
  },
  {
    // protezioni modulari (verificato su schede Schneider Acti9 iC60N / ABB S200
    // reali): «In=», curve B/C/D/K/Z e Icu/Icn non compaiono mai nei prezzari
    famigliaId: 'interruttore-magnetotermico',
    termini: [
      'in =', 'icu', 'icn', 'curva b', 'curva c', 'curva d', 'curva k', 'curva z',
      'iec 60947-2', 'iec 60898-1', 'en 60898-1', 'modulare', 'visitrip',
      'potere di interruzione',
    ],
    minHit: 3,
  },
  {
    // scatolati (verificato su schede Schneider ComPacT NSX / NSXm reali): NSX,
    // Icw ed «estraibile» non compaiono mai nella dicitura-prezzario del modulare
    famigliaId: 'interruttore-scatolato',
    termini: [
      'nsx', 'compact ns', 'scatolato', 'icw', 'sganciatore', 'micrologic',
      'plug-in', 'estraibile', 'fisso',
    ],
    minHit: 3,
  },
  {
    // verificato su schede Schneider Acti9 iCT / Hager reali: AC-1/AC-3/AC-7 e
    // «bobina» sono gergo da scheda, mai nella dicitura-prezzario
    famigliaId: 'contattore-teleruttore',
    termini: [
      'ac-1', 'ac-3', 'ac-7', 'bobina', 'contatti ausiliari', 'iec 60947-4-1',
      'en 60947-4-1', 'contattore',
    ],
    minHit: 2,
  },
  {
    // verificato su schede reali di prese/permutatori (Panduit/Commscope): «cat.
    // 6a»/«keystone»/ISO 11801 non compaiono mai nella dicitura-prezzario
    famigliaId: 'presa-dati-rj45',
    termini: ['cat.6a', 'cat 6a', 'cat. 6a', 'iso/iec 11801', 'keystone', 'schermata', 'utp', 'ftp'],
    minHit: 2,
  },
  {
    famigliaId: 'patch-panel',
    termini: ['24 porte', '48 porte', 'permutazione', '19"', '1u', 'krone', 'lsa'],
    minHit: 2,
  },
  {
    // verificato su schede switch gestiti reali (Cisco/Ubiquiti/TP-Link): PoE+,
    // throughput e layer 2/3 sono gergo da scheda, mai nella dicitura-prezzario
    famigliaId: 'switch-rete',
    termini: [
      'poe+', 'poe++', 'throughput', 'gbe', 'layer 2', 'layer 3', 'uplink', 'sfp',
      'mac address table',
    ],
    minHit: 2,
  },
  {
    famigliaId: 'access-point',
    termini: ['802.11', 'wi-fi 6', 'wifi 6', 'mu-mimo', 'ssid', 'poe out', 'roaming'],
    minHit: 2,
  },
  {
    // verificato su schede centrali/rivelatori reali (Inim/Bentel/Risco): grado
    // EN 50131 e PIR/doppia tecnologia sono gergo da scheda, mai nel prezzario
    famigliaId: 'rivelatore-intrusione',
    termini: [
      'en 50131', 'grado 2', 'grado 3', 'pir', 'doppia tecnologia',
      'portata di rilevazione', 'anti-mascheramento', 'antimascheramento',
    ],
    minHit: 2,
  },
  {
    famigliaId: 'centrale-antintrusione',
    termini: [
      'en 50131-1', 'partizioni', 'combinatore', 'bus a 2 fili', '868 mhz',
      'centrale ibrida',
    ],
    minHit: 2,
  },
  {
    // verificato su schede videocitofoniche IP reali (Comelit/Urmet/2N): SIP e
    // ONVIF (condiviso con telecamera-tvcc, vedi TIE_BREAK) sono gergo da scheda
    famigliaId: 'videocitofono',
    termini: [
      'sip', 'onvif', 'apriporta', 'targa esterna', 'posto esterno', 'posto interno',
      'monitor touch screen',
    ],
    minHit: 2,
  },
  // — round RSA: schede chiamata infermiera, rivelatori gas (verificato su
  // schede reali), testaletto e regolazione idronica —
  {
    // verificato su scheda reale: gergo bus a 2 fili chiamata
    famigliaId: 'terminale-chiamata-presidio',
    termini: ['bus a 2 fili', 'centrale di chiamata', 'protocollo l4', 'indirizzamento chiamate', 'postazione infermieri'],
    minHit: 2,
  },
  {
    famigliaId: 'terminale-chiamata-stanza',
    termini: ['bus a 2 fili', 'ingressi presidio', 'posto letto', 'presa chiamata', 'protocollo l4'],
    minHit: 2,
  },
  {
    famigliaId: 'pulsante-chiamata-paziente',
    termini: ['perella', 'peretta', 'pulsante a pera', 'ergonomico antibatterico', 'cordone', 'ip67'],
    minHit: 2,
  },
  {
    famigliaId: 'rivelatore-gas',
    termini: [
      'sensore catalitico', 'sensore elettrochimico', 'soglia di allarme', 'uscita 4-20 ma',
      'gas esplosivi', 'metano', 'gpl', 'monossido di carbonio', 'lel', 'autotest',
    ],
    minHit: 3,
  },
  {
    // trave testaletto: verificato su schede reali (Hillrom/Amico/MES): gas
    // medicali e slot presa integrata sono gergo esclusivo da scheda
    famigliaId: 'apparecchio-testaletto',
    termini: ['trave testa letto', 'gas medicali', 'presa ossigeno', 'presa vuoto', 'posto letto', 'chiamata infermiera integrata'],
    minHit: 2,
  },
  {
    // PICV: verificato su schede Belimo/Danfoss reali
    famigliaId: 'valvola-combinata-picv',
    termini: ['picv', 'pressure independent', 'indipendente dalla pressione', 'kvs', 'delta p costante', 'bilanciamento dinamico'],
    minHit: 2,
  },
  {
    famigliaId: 'contabilizzatore-calore',
    termini: ['mid', 'en 1434', 'ultrasuoni', 'portata nominale qp', 'm-bus', 'wireless m-bus'],
    minHit: 2,
  },
]

// Parole di servizio da ignorare nel match dei chip materiale/posa/opzioni.
const STOP = new Set([
  'con', 'per', 'in', 'su', 'di', 'da', 'del', 'della', 'dei', 'delle', 'a', 'al',
  'serie', 'tipo', 'ed', 'il', 'la', 'lo', 'le', 'gli', 'quanto',
])

/**
 * Parole «di contenuto» di una frase, normalizzate: ≥3 lettere OPPURE numeri di
 * ≥2 cifre (per distinguere i valori-spec tipici delle schede: CCT «4000 K», CRI
 * «>80», grado «IP66», «IK10», ottica «90°»), scartando le stopword.
 */
function contentWords(s: string): string[] {
  // ≥3 lettere, OPPURE numeri ≥2 cifre, OPPURE numeri romani i/ii/iii/iv
  // (distinguono «classe I» da «classe II», «Tipo 1+2»…).
  return normQuery(s).split(/[^a-z0-9]+/)
    .filter(w => (w.length >= 3 || /^\d{2,}$/.test(w) || /^(i{1,3}|iv)$/.test(w)) && !STOP.has(w))
}

/** Vero se `w` compare come PAROLA a sé nel testo (confini, non sottostringa):
 *  evita che «30» matchi dentro «3000» o «simmetrica» dentro «asimmetrica». */
function hasWord(text: string, w: string): boolean {
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)').test(text)
}

/**
 * Riconosce TUTTE le famiglie del thesaurus citate nel testo (solo quelle con un
 * FRASARIO: come `suggerisciFamiglia`, ma non-esclusivo). Ogni famiglia con
 * `richiede` deve avere almeno un token di contesto, altrimenti è un falso amico
 * e viene scartata. Ordina per punteggio decrescente.
 */
export function matchFamiglie(testo: unknown): FamigliaMatch[] {
  // la punteggiatura è confine di parola: «PROIETTORE.» deve valere «proiettore»
  const t = ' ' + normQuery(testo).replace(/[.,;:!?()[\]{}"']/g, ' ').replace(/\s+/g, ' ') + ' '
  if (t.trim() === '') return []
  const out: FamigliaMatch[] = []
  for (const f of FAMIGLIE) {
    const fr = frasarioFor(f.id)
    if (!fr || fr.facilePrezzario) continue // cavi/condotti: già a listino, non si compongono
    const seen = new Set<string>()
    const evidenze: string[] = []
    let score = 0
    for (const s of [...f.sinonimi, ...f.alias]) {
      const n = normQuery(s)
      if (!n || seen.has(n)) continue
      if (t.includes(' ' + n + ' ')) {
        seen.add(n)
        score += n.length // frasi più lunghe/specifiche pesano di più
        evidenze.push(s)
      }
    }
    if (score === 0) continue
    // guardia falsi amici: nessun token di contesto ⇒ fuori famiglia
    if (f.richiede?.length && !f.richiede.some(r => t.includes(normQuery(r)))) continue
    out.push({ famiglia: f, score, evidenze })
  }

  // Secondo passaggio: indizi da scheda tecnica (gergo costruttore). Aggiungono o
  // rinforzano famiglie che i sinonimi-prezzario non pescano (es. plafoniere LED
  // descritte come «apparecchio + flusso luminoso + lm/W + CCT»).
  for (const ind of INDIZI_SCHEDA) {
    const fr = frasarioFor(ind.famigliaId)
    if (!fr || fr.facilePrezzario) continue
    const hit = ind.termini.filter(term => { const n = normQuery(term); return n !== '' && t.includes(n) })
    if (hit.length < ind.minHit) continue
    const score = hit.reduce((s, term) => s + normQuery(term).trim().length, 0)
    const esistente = out.find(o => o.famiglia.id === ind.famigliaId)
    if (esistente) {
      esistente.score += score
      for (const h of hit) if (!esistente.evidenze.includes(h)) esistente.evidenze.push(h)
    } else {
      const fam = FAMIGLIE.find(f => f.id === ind.famigliaId)
      if (fam) out.push({ famiglia: fam, score, evidenze: hit })
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

/**
 * Nucleo «numero+unità» di un valore-misura: dalla prima cifra in poi, scartando
 * i prefissi (es. «LED 60 W» → «60 w», «⌀ 63 mm» → «63 mm», «200×60 mm» →
 * «200x60 mm»). Serve a richiedere l'UNITÀ adiacente al numero, così un «60» che
 * viene da «50/60Hz» non fa passare «LED 60 W».
 */
function misuraCore(v: string): string | null {
  const m = normQuery(v).match(/\d.*$/)
  return m ? m[0].trim() : null
}

/** Miglior valore di uno slot MISURA: il nucleo numero+unità compare nel testo. */
function bestMisura(text: string, valori: string[]): string | undefined {
  const compact = text.replace(/\s+/g, '')
  let best: { v: string; len: number } | undefined
  for (const v of valori) {
    const core = misuraCore(v)
    if (!core) continue
    // match diretto oppure senza spazi (schede che scrivono «63mm» / «60w»)
    if ((text.includes(core) || compact.includes(core.replace(/\s+/g, ''))) &&
        (!best || core.length > best.len)) best = { v, len: core.length }
  }
  return best?.v
}

/** Miglior valore di uno slot testuale (materiale/posa): overlap di parole ≥ soglia. */
function bestFrase(text: string, valori: string[], soglia: number): string | undefined {
  let best: { v: string; s: number } | undefined
  for (const v of valori) {
    const words = contentWords(v)
    if (!words.length) continue
    const hit = words.filter(w => hasWord(text, w)).length
    const s = hit / words.length
    if (s >= soglia && (!best || s > best.s)) best = { v, s }
  }
  return best?.v
}

/** Tutte le opzioni (multi) le cui parole di contenuto compaiono nel testo. */
function opzioniMatch(text: string, valori: string[], soglia: number): string[] {
  return valori.filter(v => {
    const words = contentWords(v)
    return words.length > 0 && words.filter(w => hasWord(text, w)).length / words.length >= soglia
  })
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }

/** Settore impiantistico di una famiglia: liste esplicite dei profili, poi
 *  fallback sulla macro del FRASARIO. */
export function settorePerFamiglia(famigliaId: string): SettoreScheda {
  const esplicito = settoreEsplicito(famigliaId)
  if (esplicito) return esplicito
  const fr = frasarioFor(famigliaId)
  if (fr?.macro.includes('ILLUMINAZIONE')) return 'illuminazione'
  if (fr?.macro.includes('IMPIANTI MECCANICI')) return 'idronica'
  return 'elettrico'
}

/**
 * Famiglie GENERICHE di RIPIEGO: scartate quando tra i match c'è una famiglia
 * più specifica dello stesso comparto (gli indizi-scheda generici le farebbero
 * vincere sul match giusto). Generalizza la storica regola corpo-illuminante.
 */
const GENERICI_RIPIEGO: Record<string, (altri: FamigliaMatch[]) => boolean> = {
  // la specifica deve essere FORTE (sopra la soglia minima di rilevanza 8):
  // altrimenti scartare il generico lascia solo match che poi la soglia elimina
  // → zero proposte (verificato su scheda Thorn HiPak reale, «highbay» debole)
  'corpo-illuminante': altri => altri.some(m =>
    m.famiglia.id !== 'corpo-illuminante' && m.score >= 8 &&
    !!frasarioFor(m.famiglia.id)?.macro.includes('ILLUMINAZIONE')),
}

/**
 * Coppie di famiglie AMBIGUE le cui schede citano spesso entrambi i gerghi (un
 * chiller reversibile «in pompa di calore», una videocitofonia ONVIF, un
 * modulare venduto accanto a uno scatolato nello stesso catalogo). Restano
 * ENTRAMBE candidate (sceglie l'utente), ma il punteggio spinge quella il cui
 * gergo domina la scheda. Tabella dichiarativa: generalizza la storica
 * `tieBreakFrigoPdc` invece di una funzione ad-hoc per ogni coppia.
 */
const TIE_BREAK: { a: string; b: string; versoA: string[]; versoB: string[] }[] = [
  {
    a: 'gruppo-frigo', b: 'pompa-di-calore',
    versoA: ['eer', 'eseer', 'potenza frigorifera', 'capacita frigorifera', 'chiller'],
    versoB: ['cop', 'scop', 'monoblocco', 'split', 'unita esterna'],
  },
  {
    // NSX/scatolato vs modulare/curva B-C-D: le schede citano l'uno per
    // distinguersi dall'altro (es. tabella di selezione modulare↔scatolato)
    a: 'interruttore-magnetotermico', b: 'interruttore-scatolato',
    versoA: ['modulare', 'curva b', 'curva c', 'curva d', 'din'],
    versoB: ['nsx', 'scatolato', 'estraibile', 'plug-in', 'micrologic'],
  },
  {
    // ONVIF/PoE compaiono in entrambe le schede (telecamera IP e videocitofono
    // IP): il gergo SIP/apriporta è inequivocabile per il videocitofono
    a: 'telecamera-tvcc', b: 'videocitofono',
    versoA: ['dome', 'bullet', 'varifocal', 'wdr', 'day/night'],
    versoB: ['sip', 'apriporta', 'targa esterna', 'posto esterno'],
  },
]

function applicaTieBreak(matches: FamigliaMatch[], t: string): void {
  for (const tb of TIE_BREAK) {
    const ma = matches.find(m => m.famiglia.id === tb.a)
    const mb = matches.find(m => m.famiglia.id === tb.b)
    if (!ma || !mb) continue
    const versoA = tb.versoA.filter(k => t.includes(' ' + k)).length
    const versoB = tb.versoB.filter(k => t.includes(' ' + k)).length
    if (versoA > versoB) ma.score += 10
    else if (versoB > versoA) mb.score += 10
  }
}

/** Costruisce la voce proposta per una famiglia riconosciuta (o null se il FRASARIO manca). */
function proponiPerFamiglia(text: string, m: FamigliaMatch): VoceProposta | null {
  const fr: FrasarioFamiglia | undefined = frasarioFor(m.famiglia.id)
  if (!fr) return null

  const misura = fr.misura ? bestMisura(text, fr.misura.valori) : undefined
  const materiale = fr.materiale ? bestFrase(text, fr.materiale, 0.5) : undefined
  const posa = fr.posa ? bestFrase(text, fr.posa, 0.5) : undefined
  const opzioni = fr.opzioni ? opzioniMatch(text, fr.opzioni, 0.6) : []

  const slotsFilled = [misura, materiale, posa].filter(Boolean).length + (opzioni.length ? 1 : 0)
  const confidenza = clamp01(0.4 + 0.15 * slotsFilled + Math.min(0.3, m.score / 40))

  const evidenze = [
    `famiglia: ${m.evidenze.slice(0, 3).join(', ')}`,
    ...[misura, materiale, posa].filter(Boolean).map(v => `→ ${v}`),
    ...opzioni.map(o => `→ ${o}`),
  ]

  return {
    famigliaId: fr.famigliaId,
    famNome: fr.nome,
    misura,
    materiale,
    posa,
    opzioni: opzioni.length ? opzioni : undefined,
    um: fr.umTipiche[0] ?? 'cad',
    confidenza,
    evidenze,
  }
}

/**
 * Estrae le voci di computo candidate dal testo di una scheda tecnica. Ritorna
 * `[]` se il testo è vuoto (es. PDF scansionato senza layer testo) o se nessuna
 * famiglia è riconosciuta. Le famiglie molto meno rilevanti della migliore
 * vengono scartate per non affogare l'utente di rumore.
 */
export function estraiVociDaScheda(testo: unknown, opts?: { titolo?: string }): VoceProposta[] {
  const text = ' ' + normQuery(testo) + ' '
  let matches = matchFamiglie(testo)
  if (!matches.length) return []

  // Identità prodotto (best-effort): prima la knowledge base marchi (settore
  // del match migliore per disambiguare i brand multi-comparto), poi il nome
  // legale; modello/codice dal titolo (se assente, dai primi ~120 caratteri).
  const settoreTop = settorePerFamiglia(matches[0].famiglia.id)
  // tutto il testo: il brand spesso compare solo nel footer della scheda
  // (verificato su Riello SDU reale); i fuori-settore li filtra rilevaMarchio
  const daKb = rilevaMarchio(testo, settoreTop)
  const marca = daKb?.marca ?? estraiMarca(testo)
  const marcaNota = !!daKb
  const { modello, codice, ean } = estraiRiferimento(opts?.titolo || String(testo ?? '').slice(0, 120))

  // famiglie generiche di ripiego: fuori se c'è la specifica dello stesso comparto
  for (const [genId, haSpecifica] of Object.entries(GENERICI_RIPIEGO)) {
    if (matches.some(m => m.famiglia.id === genId) && haSpecifica(matches)) {
      matches = matches.filter(m => m.famiglia.id !== genId)
    }
  }
  applicaTieBreak(matches, text)
  matches.sort((a, b) => b.score - a.score)

  const top = matches[0].score
  const proposte = matches
    .filter(m => m.score >= Math.max(top * 0.5, 8)) // rilevanti: metà del top o soglia minima
    .slice(0, 5)
    .map(m => proponiPerFamiglia(text, m))
    .filter((v): v is VoceProposta => v !== null)
    .map(v => {
      // voce già composta dai VALORI REALI (così non si riscrive nulla); i chip
      // (misura/materiale/…) restano per la rifinitura nel compositore. Le
      // caratteristiche si estraggono PER PROPOSTA col profilo del suo settore:
      // un chiller non riporta un «flusso luminoso» pescato da un lm spurio.
      const fr = frasarioFor(v.famigliaId)!
      const settore = settorePerFamiglia(v.famigliaId)
      const caratteristiche = estraiCaratteristiche(testo, settore)
      const d = voceDaScheda(fr, caratteristiche, { marca, modello: modello ?? daKb?.serie, codice }, settore)
      const confidenza = clamp01(v.confidenza + (marcaNota ? 0.05 : 0))
      return {
        ...v, confidenza, marca, marcaNota: marcaNota || undefined,
        modello: modello ?? daKb?.serie, codice, ean, settore, caratteristiche,
        descBreve: d.breve, descEstesa: d.estesa,
      }
    })

  return proposte.sort((a, b) => b.confidenza - a.confidenza)
}
