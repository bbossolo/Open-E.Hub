/** δ Pages — barrel dell'engine puro (import unico da main.js). */
export * from './types'
export { emptyState, parseState } from './state'
export { resolveCover, buildCoverDoc, fieldText, anchorTranslate, fieldBoxWidthFrac, firstBaselineOffset, CAP_HEIGHT_FRAC, LINE_HEIGHT_FRAC } from './cover-model'
export { coverDocHTML } from './cover-html'
export { parseElenco, normalizeHeaders, mergeSheets, mergeElencos, parseProjectMeta } from './csv-map'
export {
  STANDARD_ELENCO_COLUMNS, STANDARD_FIELD_SET, normalizeHeaderText,
  detectHeaderRow, elencoConfidence, scoreHeaderRow, matchColumn, suggestFieldColumn,
  transposeGrid, detectOrientation,
  CARTIGLIO_LABELS, matchCartiglioLabel,
} from './columns'
export type { CartiglioCell, TableOrientation, OrientationGuess } from './columns'
export { resolveExpr, exprTokens, simpleExprParts } from './expr'
export { detectFieldsFromLabels } from './detect'
export type { LabelItem } from './detect'
export { buildCoverPdfBytes, buildAllCoverPdfs, sanitizeFilename, layoutField } from './pdf-export'
export type { PdfLibModule, GeneratedPdf } from './pdf-export'
export { buildCoverDxf, buildAllCoverDxf, DELTA_DXF_LAYERS } from './dxf-export'
export type { GeneratedDxf } from './dxf-export'
export { extractEmbeddedFonts, pickRegularFont, pickBoldFont } from './template-font'
export type { ExtractedFont, PdfLibLowLevel } from './template-font'
