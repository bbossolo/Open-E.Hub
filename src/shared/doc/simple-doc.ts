/**
 * Modello FLAT per l'export editabile (.docx/.odt) di documenti che non hanno
 * un DocModel a sezioni annidate — es. gli atti istituzionali di β Contabilità,
 * resi come pagina HTML unica da `renderDocPage`.
 * Popolato da `html-to-blocks.ts` (walker DOM), consumato da `ooxml.ts` e
 * `odt.ts` per generare i due pacchetti.
 */
export interface SimpleDocSection {
  /** Intestazione di paragrafo (h2/h3 dell'HTML sorgente); assente per la prima sezione "senza titolo". */
  titolo?: string
  /** Blocchi separati da riga vuota: paragrafi, elenchi "- …", tabelle "|a|b|". */
  testo: string
}

export interface SimpleDoc {
  titolo: string
  sottotitolo?: string
  /** Coppie campo/valore di testata (es. Atto, Data, Oggetto) rese come tabella. */
  meta?: Array<[string, string]>
  sezioni: SimpleDocSection[]
}
