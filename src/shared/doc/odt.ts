/**
 * Export .odt NATIVO (OpenDocument Text) per un `SimpleDoc` FLAT — gemello di
 * `ooxml.ts`/`buildSimpleDocxParts` per chi lavora in LibreOffice/OpenOffice.
 * Stesso principio: paragrafi/tabelle/elenchi in XML, zippato dalla UI con
 * JSZip (già in vendor). Il file `mimetype` va aggiunto SENZA compressione
 * (STORE), come richiesto dallo standard ODF — vedi `ODT_MIME_ENTRY`.
 */
import { escHtml as xesc } from './index'
import type { SimpleDoc, SimpleDocSection } from './simple-doc'

const p = (t: string, style: string, extra = ''): string =>
  `<text:p text:style-name="${style}"${extra}>${xesc(t)}</text:p>`

const isSepRow = (r: string[]): boolean => r.every(c => /^:?-{2,}:?$/.test(c) || c === '')

function tableOdt(rows: string[][], hasHeader: boolean): string {
  const cols = rows[0]?.length || 1
  const cell = (text: string, bold: boolean): string =>
    `<table:table-cell office:value-type="string"><text:p text:style-name="${bold ? 'TableHeader' : 'TableCell'}">${xesc(text)}</text:p></table:table-cell>`
  const tr = (r: string[], bold: boolean): string => `<table:table-row>${r.map(c => cell(c, bold)).join('')}</table:table-row>`
  const colsXml = `<table:table-column table:number-columns-repeated="${cols}"/>`
  const body = rows.map((r, i) => tr(r, hasHeader && i === 0)).join('')
  return `<table:table table:name="t${Math.random().toString(36).slice(2, 8)}">${colsXml}${body}</table:table>`
}

/** Blocchi di testo (vuota = nuovo blocco) → ODF: paragrafi, elenchi, tabelle. Stessa sintassi di `blocksToXml`. */
function blocksToOdt(text: string): string {
  return String(text || '').split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return ''
    if (lines.length >= 2 && lines.every(l => l.includes('|'))) {
      const rows = lines.map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()))
      let header = false, body = rows
      if (rows.length >= 2 && isSepRow(rows[1])) { header = true; body = [rows[0], ...rows.slice(2)] }
      return tableOdt(body.filter(r => !isSepRow(r)), header)
    }
    if (lines.every(l => l.startsWith('- '))) {
      const items = lines.map(l => `<text:list-item>${p(l.slice(2), 'Standard')}</text:list-item>`).join('')
      return `<text:list>${items}</text:list>`
    }
    return p(lines.join(' '), 'Standard')
  }).join('')
}

function sectionOdt(s: SimpleDocSection): string {
  return (s.titolo ? p(s.titolo, 'Heading1') : '') + blocksToOdt(s.testo)
}

const AUTOMATIC_STYLES = `<office:automatic-styles>
  <style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.2in" fo:margin-bottom="0.15in"/><style:text-properties fo:font-size="26pt" fo:font-weight="bold"/></style:style>
  <style:style style:name="Heading1" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.2in" fo:margin-bottom="0.08in"/><style:text-properties fo:font-size="15pt" fo:font-weight="bold"/></style:style>
  <style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.08in" fo:text-align="justify"/><style:text-properties fo:font-size="11pt"/></style:style>
  <style:style style:name="Sub" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.12in"/><style:text-properties fo:font-style="italic" fo:font-size="11pt"/></style:style>
  <style:style style:name="TableHeader" style:family="paragraph"><style:text-properties fo:font-weight="bold" fo:font-size="10pt"/></style:style>
  <style:style style:name="TableCell" style:family="paragraph"><style:text-properties fo:font-size="10pt"/></style:style>
</office:automatic-styles>`

function contentXml(doc: SimpleDoc): string {
  const cover: string[] = [p(doc.titolo, 'Title')]
  if (doc.sottotitolo) cover.push(p(doc.sottotitolo, 'Sub'))
  if (doc.meta && doc.meta.length) cover.push(tableOdt(doc.meta.map(([k, v]) => [k, v]), false))
  const body = cover.join('') + doc.sezioni.map(sectionOdt).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
${AUTOMATIC_STYLES}
<office:body><office:text>${body}</office:text></office:body>
</office:document-content>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2">
  <office:styles/>
</office:document-styles>`

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`

export const ODT_MIME = 'application/vnd.oasis.opendocument.text'
/** Nome della parte "mimetype": va zippata SENZA compressione (STORE), unica eccezione fra le parti. */
export const ODT_MIMETYPE_ENTRY = 'mimetype'

/** Parti del pacchetto .odt (path → contenuto). La UI le zippa con JSZip, `mimetype` in STORE. */
export function buildOdtParts(doc: SimpleDoc): Record<string, string> {
  return {
    [ODT_MIMETYPE_ENTRY]: ODT_MIME,
    'META-INF/manifest.xml': MANIFEST_XML,
    'content.xml': contentXml(doc),
    'styles.xml': STYLES_XML,
  }
}
