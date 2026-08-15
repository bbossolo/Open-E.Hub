/**
 * La memoria dello studio: quello che Open E.Hub ha imparato, in un file solo.
 * Motore puro — nessun DOM. Finché non c'è il server aziendale è ciò che rende trasferibile
 * il capitale dello studio; quando il server ci sarà, sarà il payload che sincronizzerà
 * (stesso schema, stesse parti, stessa regola di unione).
 */
export {
  PARTI,
  parteDi,
  chiaveDi,
  conta,
  inventario,
  esporta,
  valida,
  anteprima,
  importa,
  catalogoCsv,
} from './memoria'
export type { MemoriaStudio, ParteMemoria, Store, Fusione } from './memoria'
