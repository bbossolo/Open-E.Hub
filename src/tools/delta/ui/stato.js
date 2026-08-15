/* δ Pages — stato del tool: progetto (RAM + .ehub, mai localStorage),
   selezione, vista corrente, zoom dei due canvas. */
import { emptyState } from '../engine'
/** Stato di progetto (RAM + .ehub, mai localStorage — come tutta la suite). */
export let S = emptyState()
export let sel = null          // id del campo selezionato nell'editor
export let view = 'template'
export let previewIndex = 0    // riga dell'elenco mostrata nell'anteprima
// Verifica import elenco: {fileName, sheets:[{name,grid,orientation,headerIndex,confidence,picked}], focus}
// — SEMPRE mostrata (anche a foglio singolo), null quando non c'è un import in corso.
export let elencoVerify = null
// Dizionario sinonimi per-sessione (alias normalizzato → chiave STANDARD_ELENCO_COLUMNS),
// insegnato dall'utente durante la verifica import (vedi teachSinonimo in ui/elenco.js).
export let _elencoSinonimi = {}

/* Riassegnazioni da altri moduli: in ESM un import non è un binding assegnabile. */
export function setS(v) { S = v }
export function setSel(v) { sel = v }
export function setView(v) { view = v }
export function setPreviewIndex(v) { previewIndex = v }
export function setElencoVerify(v) { elencoVerify = v }

