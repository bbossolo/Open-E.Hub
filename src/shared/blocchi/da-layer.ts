/**
 * MOTORE DI RICONOSCIMENTO GUIDATO DAL LAYER.
 *
 * La lezione, imparata sui progetti veri e non da un manuale: **il nome del blocco non è
 * un'informazione affidabile, il layer sì.**
 *
 * - Su una tavola dello studio i simboli si chiamano `PL_SOFFITTO`, `AL_ALLACCIAMENTO_MOTORE`:
 *   nomi parlanti, ma sono solo il 35% del disegno. Il resto sono blocchi dei costruttori —
 *   `ZS55_SCHUKO`, `FRAME_2MOD`, `Z35` — che nessun catalogo indovinerà mai.
 * - Su una tavola di un collaboratore esterno va anche peggio: i blocchi si chiamano `CY17`,
 *   `CG8`, `FA12`, `QUAD14`. Codici interni. Riconoscimento per nome: **zero su 1017**.
 *
 * Ma in ENTRAMBI i progetti il layer dice tutto: `IE-ILLUMINAZIONE`, `IE-FM`, `IE-PLACCHE`,
 * `ELE-RILEVAZIONE_FUMO`. Disegnando per layer, lo studio ha già classificato ogni pezzo —
 * semplicemente non nei nomi. Questo modulo legge quella classificazione.
 *
 * Le famiglie di arrivo sono quelle del thesaurus condiviso (`src/shared/compositore`), le
 * stesse che μ usa per cercare nel prezzario: il ponte fra il disegno e il computo.
 */
import { FAMIGLIE } from '../compositore/thesaurus'
import type { FamigliaBlocco } from './types'

/**
 * Regole LAYER → famiglia del thesaurus. Ordinate: la prima che matcha vince, quindi le
 * più specifiche stanno prima (`ILLUMINAZIONE_EMERGENZA` prima di `ILLUMINAZIONE`).
 *
 * Si matcha sul CAPITOLO del layer (il pezzo dopo il prefisso di dominio), quindi le regole
 * valgono tanto per `ELE-` quanto per `IE-` o qualunque altro prefisso lo studio userà.
 */
const REGOLE_LAYER: Array<[RegExp, string, FamigliaBlocco]> = [
  // ── illuminazione (il più specifico per primo) ──
  [/EMERGENZ|SICUREZZA|PITTOGRAMM/i, 'lampada-emergenza', 'illuminazione'],
  [/ILLUMINAZIONE|LUCE|LAMPAD|PLAFON|APPARECCHI_ILLUM/i, 'punto-luce', 'illuminazione'],

  // ── prese e forza motrice ──
  [/PLACCHE|FRUTTI|PORTAFRUTT/i, 'punto-presa', 'prese'],
  [/\bFM\b|FORZA[\s-]?MOTRICE|PRESE?\b|SCHUKO/i, 'punto-presa', 'prese'],
  [/COMANDI|INTERRUTT|DEVIAT|PULSANT(?!.*ALLARME)/i, 'punto-comando', 'comandi'],

  // ── impianti speciali ──
  [/RILEVAZIONE[\s-]?FUMO|RIVELAZIONE|ANTINCENDIO|IRAI/i, 'rivelatore-incendio', 'allacciamenti'],
  [/ALLARM|ANTINTRUS|SICUREZZA_ATT/i, 'avvisatore-ottico-acustico', 'allacciamenti'],
  [/DIFF(USIONE)?[\s-]?SONORA|FONO|AUDIO|ALTOPARL|LOUDSPEAK/i, 'allaccio-segnale', 'allacciamenti'],
  [/DATI|RETE|LAN|TELEMATIC|\bTD\b|\bTP\b|\bSP\b/i, 'presa-dati-rj45', 'allacciamenti'],
  [/\bTV\b|TELEVIS|ANTENN|SAT\b/i, 'allaccio-segnale', 'allacciamenti'],
  [/SPECIALI/i, 'allaccio-segnale', 'allacciamenti'],

  // ── quadri, terra, distribuzione ──
  [/QUADR/i, 'centralino', 'quadri'],
  [/TERRA|EQUIPOTENZ/i, 'impianto-di-terra', 'terra'],
  [/DISTRIBUZIONE|DORSAL|MONTANT/i, 'allaccio-utenza-elettrica', 'allacciamenti'],
  [/SCATOL|DERIVAZ/i, 'scatola-derivazione', 'scatole-tubi'],
  [/TUBAZION|CANALI|CANALIN|PASSERELL|CAVIDOTT/i, 'cavidotto', 'scatole-tubi'],

  // ── altri impianti ──
  [/FANCOIL|VENTILCONV|CLIMA|CONDIZ/i, 'ventilconvettore', 'allacciamenti'],
  [/FOTOVOLT|\bFTV\b/i, 'allaccio-utenza-elettrica', 'allacciamenti'],
]

/** Esito del riconoscimento di un blocco: da dove viene la famiglia e quanto ci si fida. */
export interface EsitoFamiglia {
  /** Famiglia del thesaurus (`src/shared/compositore`), o null se nemmeno il layer aiuta. */
  famigliaId: string | null
  /** Famiglia grossolana (per il colore del marker e la palette). */
  famiglia: FamigliaBlocco
  /**
   * Come ci siamo arrivati:
   * - `dizionario` — lo studio l'ha già deciso per questo blocco (certo);
   * - `nome` — il nome del blocco è parlante e sta nel catalogo (affidabile);
   * - `layer` — dedotto dal layer (buono, ma va confermato una volta);
   * - `ignoto` — nessuna delle tre: serve una risposta umana.
   */
  fonte: 'dizionario' | 'nome' | 'layer' | 'ignoto'
}

/** Il capitolo del layer, cioè la parte che porta il significato (senza il dominio).
 *  Gli underscore diventano spazi: nel DXF sono separatori di parola, ma per una regex
 *  sono caratteri di parola — e `\bFM\b` non matcherebbe `FM_NORMALE`, che è proprio il
 *  layer di forza motrice più popolato di tutta la tavola. */
function capitoloGrezzo(layer: string): string {
  const pulito = layer.replace(/_TESTO$/i, '').trim()
  const m = pulito.match(/^[A-Z]+[.\d]*-(.+)$/i)
  return (m ? m[1] : pulito).replace(/_/g, ' ')
}

/**
 * Secondo tentativo: il layer confrontato DIRETTAMENTE col thesaurus del compositore.
 *
 * È ciò che rende il motore auto-alimentante: le regole curate sopra coprono i casi
 * idiomatici (dove il gergo dello studio non coincide col nome della famiglia — un layer
 * «ILLUMINAZIONE» in computo è un *punto luce*, non un «corpo illuminante»), ma per tutto il
 * resto basta che una famiglia esista nel thesaurus perché venga riconosciuta. Aggiungi
 * domani `colonnina-ricarica` e un layer `ELE-COLONNINE_RICARICA` la trova da solo, senza
 * che nessuno tocchi questo file.
 *
 * Si richiede il match dell'INTERO alias/sinonimo dentro il capitolo del layer (non una
 * parola sparsa): meglio dire «non lo so» che appiccicare una famiglia a caso.
 */
function famigliaDalThesaurus(cap: string): string | null {
  const testo = ` ${cap.toLowerCase().replace(/[-.]/g, ' ')} `
  let miglior: { id: string; len: number } | null = null
  for (const f of FAMIGLIE) {
    for (const termine of [...f.alias, ...f.sinonimi]) {
      const t = termine.toLowerCase().trim()
      if (t.length < 4) continue // termini troppo corti: troppi falsi positivi
      if (!testo.includes(` ${t} `) && !testo.includes(` ${t}`) && !testo.includes(`${t} `)) continue
      // il termine più LUNGO vince: è il più specifico
      if (!miglior || t.length > miglior.len) miglior = { id: f.id, len: t.length }
    }
  }
  return miglior ? miglior.id : null
}

/** Famiglia grossolana (colore/palette) da una famigliaId del thesaurus. */
function famigliaGrossolana(famigliaId: string): FamigliaBlocco {
  if (/luce|illumin|lampad|plafon|faretto|proiettore|downlight|led|armatura/.test(famigliaId)) return 'illuminazione'
  if (/presa|frutto/.test(famigliaId)) return 'prese'
  if (/comando|interrutt|pulsante/.test(famigliaId)) return 'comandi'
  if (/quadro|centralino|magnetotermico|scatolato/.test(famigliaId)) return 'quadri'
  if (/terra|equipotenz/.test(famigliaId)) return 'terra'
  if (/scatola|tubo|canal|passerella|cavidotto/.test(famigliaId)) return 'scatole-tubi'
  return 'allacciamenti'
}

/**
 * Famiglia dedotta dal LAYER. È la rete di sicurezza che tiene su i progetti dove i blocchi
 * si chiamano `CY17`: non è un'ipotesi campata in aria, è la classificazione che il
 * progettista ha già fatto disegnando.
 *
 * Due passi: prima le regole curate (il gergo di cantiere), poi il thesaurus stesso — così
 * il motore cresce insieme al thesaurus invece di restare indietro.
 */
export function famigliaDaLayer(layer: string): { famigliaId: string; famiglia: FamigliaBlocco } | null {
  const cap = capitoloGrezzo(layer)
  for (const [re, famigliaId, famiglia] of REGOLE_LAYER) {
    if (re.test(cap)) return { famigliaId, famiglia }
  }
  const dalThes = famigliaDalThesaurus(cap)
  if (dalThes) return { famigliaId: dalThes, famiglia: famigliaGrossolana(dalThes) }
  return null
}

/** Chiave del dizionario dello studio: un blocco è identificato da NOME + LAYER. */
export function chiaveDizionario(nomeBlocco: string, layer: string): string {
  return `${nomeBlocco}@${layer}`
}

/** Il dizionario dello studio: `NOME@LAYER` → famigliaId del thesaurus. */
export type DizionarioStudio = Record<string, string>

/**
 * Decide la famiglia di un blocco, nell'ordine giusto: prima quello che lo studio ha già
 * deciso, poi il nome (se parlante), infine il layer. Se non basta nemmeno il layer, lo dice
 * — e sarà il pannello «Blocchi da riconoscere» a chiederlo all'utente, una volta sola.
 */
export function risolviFamiglia(
  nomeBlocco: string,
  layer: string,
  opts: {
    dizionario?: DizionarioStudio
    /** Famiglia dal catalogo per NOME (`famigliaPerBlocco`), se il nome è parlante. */
    daNome?: string | null
    /** Famiglia grossolana dal catalogo (`PREFISSO_FAMIGLIA`), se nota. */
    famigliaCatalogo?: FamigliaBlocco | null
  } = {},
): EsitoFamiglia {
  const { dizionario, daNome, famigliaCatalogo } = opts

  const deciso = dizionario?.[chiaveDizionario(nomeBlocco, layer)]
  if (deciso) {
    const dl = famigliaDaLayer(layer)
    return { famigliaId: deciso, famiglia: famigliaCatalogo || dl?.famiglia || 'varie', fonte: 'dizionario' }
  }
  if (daNome) {
    return { famigliaId: daNome, famiglia: famigliaCatalogo || 'varie', fonte: 'nome' }
  }
  const dl = famigliaDaLayer(layer)
  if (dl) return { famigliaId: dl.famigliaId, famiglia: dl.famiglia, fonte: 'layer' }

  return { famigliaId: null, famiglia: famigliaCatalogo || 'varie', fonte: 'ignoto' }
}

/** Una famiglia del thesaurus, come la mostra il menù di scelta del pannello. */
export interface VoceFamiglia { id: string; nome: string }

/**
 * Le famiglie del thesaurus, in ordine alfabetico, per il menù «cos'è questo blocco?».
 * Il nome mostrato è il primo alias (come la chiama l'utente), non l'id tecnico.
 */
export function famiglieDisponibili(): VoceFamiglia[] {
  return FAMIGLIE
    .map(f => ({ id: f.id, nome: (f.alias[0] || f.id).replace(/^./, c => c.toUpperCase()) }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
