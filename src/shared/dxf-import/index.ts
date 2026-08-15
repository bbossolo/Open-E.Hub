/**
 * Lettore DXF condiviso, a passaggio singolo e layer-aware.
 *
 * Un import solo, invece di più tokenizzazioni dello stesso file: la geometria esce
 * già divisa per layer, coi testi e gli INSERT al loro posto.
 */
export { CodificatoreCp1252, leggiStreamConFallback } from './codifica'
export type { CodificaDxf } from './codifica'
export { leggiDxf, LettoreDxf } from './read'
export type { DxfEnt, DxfBlockDef, DxfLettura } from './read'
export { dxfToScene, scenaDaLettura } from './scene'
export { DXF_LAYER_PESANTE, DXF_MAX_DEPTH, DXF_MAX_SEGMENTI } from './types'
export type {
  DxfLayerGeom,
  DxfParseOptions,
  DxfPt,
  DxfScene,
  DxfSceneInsert,
  DxfSceneStats,
  DxfSceneText,
} from './types'
