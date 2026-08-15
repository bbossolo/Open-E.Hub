/**
 * Lo standard layer dello studio per le basi architettoniche.
 *
 * È un punto di partenza generico, non una tabella immutabile: una piattaforma bianca su cui lo
 * studio innesta la propria convenzione di nomi, colori ACI, tipi linea e spessori. Va editato
 * liberamente per rispecchiare le tavole reali dello studio che lo adotta.
 *
 * Le incoerenze che si accumulano negli anni tra chi disegna vanno sanate una volta per tutte
 * nella tabella `ALIAS_STORICI` qui sotto: un refuso ricorrente (es. `MURATURE` invece di
 * `MURATURA`, o `Estrerni` invece di `ESTERNI`) viene ricondotto alla voce buona invece di essere
 * trattato come layer estraneo.
 *
 * I colori NON sono un dettaglio estetico: sono il modo in cui si legge una tavola. Per questo
 * ogni voce porta con sé ACI, tipo linea e spessore, e le entità che ci finiscono sopra vengono
 * riportate a BYLAYER — altrimenti la geometria del collaboratore continuerebbe a disegnarsi
 * col colore suo e la fusione dei layer non servirebbe a niente.
 */
import type { LayerStudio } from '../dxf-import/riscrivi'

export interface VoceStandard extends LayerStudio {
  /** Cosa ci va sopra, detto all'utente. */
  cosa: string
}

/** La base architettonica che ci consegna il collaboratore. */
export const LAYER_STANDARD: VoceStandard[] = [
  { nome: 'MURATURA', aci: 252, linetype: 'Continuous', lineweight: 9, cosa: 'Muri, tramezze, pilastri, portanti' },
  { nome: 'ARREDI', aci: 51, linetype: 'Continuous', cosa: 'Arredi e attrezzature' },
  { nome: 'SANITARI', aci: 51, linetype: 'Continuous', cosa: 'Apparecchi sanitari' },
  { nome: 'TESTI', aci: 8, linetype: 'Continuous', lineweight: 15, cosa: 'Scritte, etichette, nomi dei locali' },
  { nome: 'QUOTE', aci: 8, linetype: 'Continuous', spento: true, cosa: 'Quote del collaboratore (spente: usiamo le nostre)' },
  { nome: 'RETINI accesi', aci: 9, linetype: 'Continuous', cosa: 'Campiture visibili' },
  { nome: 'RETINI spenti', aci: 9, linetype: 'Continuous', spento: true, cosa: 'Campiture da non mostrare' },
  { nome: 'LINEA SEZIONE', aci: 6, linetype: 'ACAD_ISO04W100', cosa: 'Linee di sezione' },
  { nome: 'TRAVI', aci: 253, linetype: 'HIDDEN', cosa: 'Travi e orditure in proiezione' },
  { nome: 'SIMBOLI', aci: 251, linetype: 'Continuous', lineweight: 15, cosa: 'Simboli, nord, riferimenti' },
  { nome: 'CONDIZIONAMENTO', aci: 4, linetype: 'Continuous', cosa: 'Climatizzazione sulla base architettonica' },
  { nome: 'ESTERNI', aci: 252, linetype: 'Continuous', cosa: 'Sistemazioni esterne, verde, recinzioni' },
  { nome: 'SUDDIVISIONE COMP', aci: 6, linetype: 'Continuous', cosa: 'Suddivisioni per il computo' },
]

/*
 * Destinazioni speciali. Il carattere `*` è VIETATO da AutoCAD nei nomi di layer, quindi non può
 * mai collidere con un layer vero — ed è la ragione per cui va bene qui.
 *
 * Prima erano prefissate con un NUL (`\u0000`), che sembrava ancora più sicuro e invece era un
 * bug: passando per un attributo HTML il NUL diventa U+FFFD, il confronto al rilascio falliva e
 * trascinare un layer sul cassetto «Spenti» non faceva **niente, in silenzio**. Una sentinella
 * deve sopravvivere al DOM, non solo essere improbabile.
 */
export const SPEGNI = '*SPEGNI*'
export const MANTIENI = '*MANTIENI*'

export const NOMI_STANDARD: string[] = LAYER_STANDARD.map(v => v.nome)

export function voceStandard(nome: string): VoceStandard | undefined {
  return LAYER_STANDARD.find(v => v.nome === nome)
}

/**
 * I doppioni storici: nomi che nelle tavole vecchie esistono e che vanno ricondotti alla voce
 * buona invece di essere trattati come layer estranei.
 */
export const ALIAS_STORICI: Record<string, string> = {
  'MURATURE': 'MURATURA',
  'Estrerni': 'ESTERNI',
  'RETINI': 'RETINI accesi',
}
