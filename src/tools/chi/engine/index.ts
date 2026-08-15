/* χ Refs — barrel del motore. Il grosso della logica sta in src/shared/xref e
   src/shared/dxf-import: qui resta solo ciò che è specifico del tool. */
export * from './piano'
export { analizzaDxf, AnalizzatoreDxf, appiattisci, deduciScala } from '../../../shared/dxf-import/analizza'
export type { AnalisiDxf, EsitoScala, LayerTrovato } from '../../../shared/dxf-import/analizza'
export { RiscrittoreDxf, riscriviDxf } from '../../../shared/dxf-import/riscrivi'
export type { EsitoRiscrittura, LayerStudio, PianoRiscrittura } from '../../../shared/dxf-import/riscrivi'
export { LAYER_STANDARD, MANTIENI, NOMI_STANDARD, SPEGNI, voceStandard } from '../../../shared/xref/standard'
export type { VoceStandard } from '../../../shared/xref/standard'
export { chiaveLayer, fascia, suggerisci, suggerisciTutti } from '../../../shared/xref/suggerisci'
export type { Fascia, RigaMappatura, Suggerimento } from '../../../shared/xref/suggerisci'
