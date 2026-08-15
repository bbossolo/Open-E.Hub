/**
 * Da «come li chiama il collaboratore» a «come li chiamiamo noi».
 *
 * La tesi è la stessa già validata altrove nella suite: **il nome del layer è affidabile**, molto
 * più del nome del blocco. Qui però il dominio è diverso — non l'impianto ma la base
 * architettonica — e i nomi veri, presi dalle tavole in mano allo studio, sono un campionario di
 * tre convenzioni che convivono nello stesso file: `TAV-B-XREF|muri`, `TAV-A-XREF|01_MURI`,
 * `Strutturale - Portante`, `IE-MURATURA`, `PDF3_Testo`.
 *
 * Il suggerimento non decide: propone. Ogni proposta porta con sé una confidenza e il MOTIVO,
 * perché l'utente deve poter capire in un colpo d'occhio perché gli stiamo dicendo che
 * `Strutturale - Portante` è muratura, e smentirci quando sbagliamo.
 */
import { capitoloDiLayer, disciplinaDiLayer, famigliaDaLayer } from '../blocchi'
import type { LayerTrovato } from '../dxf-import/analizza'
import { ALIAS_STORICI, MANTIENI, NOMI_STANDARD, SPEGNI } from './standard'

export interface Suggerimento {
  /** Nome di un layer standard, oppure `SPEGNI` / `MANTIENI`. */
  destinazione: string
  /** 0..1 — vedi `fascia()`. */
  confidenza: number
  /** Frase per l'utente, in chiaro. */
  motivo: string
  /** Id della regola che ha deciso: serve ai test e a capire cosa correggere. */
  regola: string
}

export type Fascia = 'alta' | 'media' | 'bassa'

/**
 * Tre fasce, non un numero: l'utente non deve leggere «0.72», deve sapere se può fidarsi.
 * Alta e media vengono pre-applicate; bassa resta «da decidere», perché una proposta debole
 * accettata in silenzio è peggio di nessuna proposta.
 */
export function fascia(c: number): Fascia {
  return c >= 0.85 ? 'alta' : c >= 0.55 ? 'media' : 'bassa'
}

/** Tabella dedicata all'architettonico: è l'unica parte davvero nuova del riconoscimento. */
const REGOLE: Array<[RegExp, string, number, string]> = [
  [/MURATUR|\bMUR[IO]\b|MURETT|PARET|TRAMEZZ|PILASTR|COLONN|PORTANT|A-?WALL|MASONR|BRICK|\bWALL/i, 'MURATURA', 0.92, 'muratura'],
  [/SANITAR|\bBAGN[OI]\b|\bWC\b|IDROSANIT|PLUMB/i, 'SANITARI', 0.9, 'sanitari'],
  [/ARRED|MOBIL|\bFURN|CASEWORK|MILLWORK/i, 'ARREDI', 0.9, 'arredi'],
  [/QUOT[EA]|DIMENSION|\bDIM[_\s-]|\bDIMS?\b/i, 'QUOTE', 0.9, 'quote'],
  [/TEST[OI]|SCRITT|\bTEXT\b|ETICHET|LEGEND|\bANNO\b/i, 'TESTI', 0.88, 'testi'],
  [/LINEA[\s_-]?SEZ|SEZIONI?\b|SECTION[\s_-]?LINE|TAGLIO/i, 'LINEA SEZIONE', 0.86, 'linea di sezione'],
  [/RETIN|HATCH|CAMPIT|TRATTEGG|PATTERN/i, 'RETINI accesi', 0.8, 'campiture'],
  [/TRAV[EI]\b|\bBEAM|ORDITUR|CORDOL/i, 'TRAVI', 0.86, 'travi'],
  [/CONDIZ|CLIMA|\bHVAC\b|VENTILAZ|FANCOIL|AERAULIC|UNIT[AÀ]\s*(INTERN|ESTERN)/i, 'CONDIZIONAMENTO', 0.86, 'climatizzazione'],
  [/SIMBOL|SYMBOL|\bNORD\b|MARKER/i, 'SIMBOLI', 0.72, 'simboli'],
  [/ESTERN|GIARDIN|VERDE|RECINZ|TERREN|PAESAGG|SITO|ALBER|SIEPE|PAVIMENTAZ/i, 'ESTERNI', 0.8, 'sistemazioni esterne'],
  // Porte, finestre, scale, solai: nel nostro standard non hanno un layer proprio, stanno con
  // la muratura. È una scelta dello studio, non una mancanza.
  [/PORT[EA]\b|PORTON|FINESTR|INFISS|SERRAMENT|^SER\b|SOGLI|\bDOOR|\bWINDOW|GLAZ|APERTUR/i, 'MURATURA', 0.78, 'aperture'],
  [/RIVESTIMENT|CAPPOTTO|INTONAC|FINITUR/i, 'MURATURA', 0.76, 'finiture'],
  // Prefabbricato/industriale: pannelli e struttura portante (colonne, controventi, dettagli in
  // acciaio a terra) stanno con la muratura tanto quanto pilastri e travi ci stanno già.
  [/PANNELL/i, 'MURATURA', 0.76, 'pannelli'],
  [/STRUTTUR|CONTROVENT|\bCOLS?\b/i, 'MURATURA', 0.74, 'struttura portante'],
  [/PIATT[EI].*TERRA|ANGOLAR.*TERRA/i, 'MURATURA', 0.72, 'dettagli in acciaio'],
  [/BAIA|BAIE.*CARIC/i, 'MURATURA', 0.7, 'baie di carico'],
  [/SCAFFAL/i, 'ARREDI', 0.78, 'scaffalature'],
  [/TOMBIN|POZZETT|MARCIAPIED|CORDOLO/i, 'ESTERNI', 0.76, 'opere esterne'],
  [/SCAL[AE]\b|ASCENSOR|MONTACARIC|PARAPETT|\bSTAIR/i, 'MURATURA', 0.72, 'collegamenti verticali'],
  [/CONTROSOFF|SOLAI|COPERTUR|\bTETT[OI]\b|\bSHELL\b/i, 'MURATURA', 0.7, 'orizzontamenti'],
  // Su una base architettonica i muri e gli arredi sono i PROTAGONISTI, non il contorno: ogni
  // voce che resta «non riconosciuta» è lavoro a mano scaricato sull'utente. Queste sono le
  // parole trovate sulle tavole vere che prima cadevano nel mucchio.
  [/PROIEZION|PROSPETT|\bALZAT[OI]\b|\bVISTA\b/i, 'MURATURA', 0.72, 'proiezioni e prospetti'],
  [/INFERRIAT|INFERIAT|RINGHIER|CANCELL|\bGRIGLI/i, 'MURATURA', 0.74, 'chiusure metalliche'],
  [/AUTODOCK|BANCHIN|\bCELLA\b|MAGAZZ|SOPPALC|\bDOCK\b/i, 'MURATURA', 0.7, 'locali e attrezzature fisse'],
  [/SEGNALETIC|\bTARGHE?\b|NUMERAZION/i, 'SIMBOLI', 0.7, 'segnaletica'],
  [/PAVIMENT|MASSETT|BATTISCOP|ZOCCOLIN/i, 'MURATURA', 0.7, 'pavimenti'],
]

/** Roba di servizio: non è disegno, è il contorno del foglio. Si spegne d'ufficio. */
const SERVIZIO = /^DEFPOINTS$|CARTIGLI|SQUADRAT|TABELL|^MPD_|^PDF\d*_|^00_|^_|\bLAYOUT\b|^VP$|NOT[\s_]EXPORTED|^Layer\d+$|_Num_Penna__|^SCHEMA\b/i

/** Il layer `0` e i suoi cloni: ambigui per natura, la decisione non è nostra. Vedi `suggerisci`. */
const LAYER_ZERO = /^_?0$/

/** Il disegno di impianto del collaboratore: a noi serve lo SFONDO, non il suo impianto. */
const IMPIANTO_ALTRUI = /^IE-|^E-IMP|^ELE-|^TES_FD_|^DLX_|^MEP\b|^RAD-|^FRQ-/i

export interface OpzioniSuggerimento {
  /** Decisioni già prese per questo collaboratore: hanno la precedenza su tutto. */
  profilo?: Record<string, string>
}

/**
 * Chiave con cui una decisione vale per tutte le varianti dello stesso layer: senza prefisso
 * xref, senza numerazione iniziale, senza separatori, maiuscola. Così `TAV-A-XREF|01_MURI`,
 * `TAV-B-XREF|muri` e `MURI` sono una decisione sola invece di tre.
 */
export function chiaveLayer(nome: string): string {
  const base = nome.slice(nome.lastIndexOf('|') + 1)
  return base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^\d+[\s_.-]*/, '')
    .replace(/[\s_.-]+/g, '')
    .toUpperCase()
}

/**
 * Il nome su cui far correre le regex.
 *
 * Serve perché `01_MURI` è muratura ma `\bMUR` non ci trova un confine di parola: l'underscore
 * è un carattere di parola, e la numerazione iniziale del collaboratore («01_», «04_») è
 * ordinamento, non significato. Si toglie la numerazione e si aprono i separatori.
 */
function testabile(base: string): string {
  return base.replace(/^\d+[\s_.-]*/, '').replace(/[_.]+/g, ' ').trim()
}

export function suggerisci(l: LayerTrovato, opts: OpzioniSuggerimento = {}): Suggerimento {
  const nome = l.base
  const nomeT = testabile(nome)
  const chiave = chiaveLayer(l.nome)

  // 1 · quello che lo studio ha già deciso per questo collaboratore
  const dalProfilo = opts.profilo?.[chiave]
  if (dalProfilo) {
    return { destinazione: dalProfilo, confidenza: 1, regola: 'profilo',
      motivo: 'Deciso da te la volta scorsa per questo collaboratore.' }
  }

  // 2 · è già un layer nostro (o un suo doppione storico)
  if (NOMI_STANDARD.includes(nome)) {
    return { destinazione: nome, confidenza: 1, regola: 'gia-standard',
      motivo: 'È già un layer dello standard.' }
  }
  const alias = ALIAS_STORICI[nome]
  if (alias) {
    return { destinazione: alias, confidenza: 0.95, regola: 'alias-storico',
      motivo: `Vecchia grafia di ${alias}.` }
  }

  // 3 · il layer `0` NON SI TOCCA. Si importa esattamente com'è.
  //
  // Non è prudenza, è come funziona il CAD: il layer 0 è quello su cui vivono i blocchi. Le
  // entità disegnate sul layer 0 dentro una definizione di blocco ereditano il layer dell'INSERT
  // che le richiama, e i riferimenti a blocchi stessi ci stanno sopra a migliaia — su una tavola
  // dello studio sono 232, su una tavola fornitore 11. Rinominarlo o spegnerlo fa sparire i
  // simboli del disegno,
  // e non c'è nessun vantaggio che valga quel rischio.
  if (LAYER_ZERO.test(nome)) {
    const b = l.nInsert ? `, ${l.nInsert} riferimenti a blocchi` : ''
    return { destinazione: MANTIENI, confidenza: 1, regola: 'layer-zero',
      motivo: `Il layer 0 si importa com’è: è quello su cui vivono i blocchi (${l.nEntita} entità${b}).` }
  }

  // 4 · roba di servizio: contorno del foglio, non disegno
  if (SERVIZIO.test(nome)) {
    return { destinazione: SPEGNI, confidenza: 0.9, regola: 'servizio',
      motivo: 'Non è disegno: cartiglio, squadratura o residuo di import.' }
  }

  // 5 · la tabella dell'architettonico
  for (const [re, dest, conf, che] of REGOLE) {
    if (re.test(nome) || re.test(nomeT)) {
      return { destinazione: dest, confidenza: conf, regola: `arch:${che}`,
        motivo: `Il nome dice ${che}.` }
    }
  }

  // 6 · l'impianto del collaboratore: ci serve la base, non i suoi circuiti
  if (IMPIANTO_ALTRUI.test(nome) || famigliaDaLayer(nome)) {
    return { destinazione: SPEGNI, confidenza: 0.7, regola: 'impianto-altrui',
      motivo: 'È l’impianto del collaboratore: a noi serve la base architettonica.' }
  }

  // 7 · l'ultima rete: la disciplina dedotta dal capitolo del nome
  const disciplina = disciplinaDiLayer(nome)
  if (disciplina === 'Opere edili') {
    return { destinazione: 'MURATURA', confidenza: 0.6, regola: 'disciplina-edile',
      motivo: `Sembra opera edile (${capitoloDiLayer(nome)}).` }
  }

  // 8 · non riconosciuto. Si propone di spegnerlo, ma a bassa confidenza: resta «da decidere»,
  // perché spegnere per sbaglio la muratura è il modo più veloce di rendere il tool inutile.
  return { destinazione: SPEGNI, confidenza: 0.3, regola: 'ignoto',
    motivo: 'Non riconosciuto: controlla tu.' }
}

export interface RigaMappatura {
  layer: LayerTrovato
  suggerimento: Suggerimento
  /** La decisione effettiva: parte dal suggerimento, l'utente la cambia. */
  destinazione: string
  /** true quando l'ha scelta l'utente: solo queste finiscono nel profilo. */
  manuale: boolean
}

/**
 * Prepara la tabella su cui lavora l'utente. Un layer vuoto (presente in tabella ma senza
 * un'entità che lo usi) non merita una decisione: si lascia com'è, spegnerlo non cambia niente
 * e affollerebbe l'elenco. Su una tavola reale sono 97 su 150.
 */
export function suggerisciTutti(layer: LayerTrovato[], opts: OpzioniSuggerimento = {}): RigaMappatura[] {
  return layer.map(l => {
    if (l.vuoto) {
      const s: Suggerimento = { destinazione: MANTIENI, confidenza: 1, regola: 'vuoto',
        motivo: 'Nessuna entità lo usa: non c’è niente da spostare.' }
      return { layer: l, suggerimento: s, destinazione: MANTIENI, manuale: false }
    }
    const s = suggerisci(l, opts)
    // Le proposte deboli non si applicano da sole.
    const dest = fascia(s.confidenza) === 'bassa' ? '' : s.destinazione
    return { layer: l, suggerimento: s, destinazione: dest, manuale: false }
  })
}
