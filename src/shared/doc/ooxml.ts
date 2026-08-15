/**
 * Primitive OOXML (.docx) condivise — paragrafi/tabelle/stili/pacchetto ZIP.
 * Condivise perché β (Contabilità) ne ha bisogno per documenti a forma flat
 * (niente indice/DocModel a sezioni annidate). Il motore resta lo stesso: ogni
 * tool costruisce il proprio document.xml e lo passa a `buildDocxPackage`.
 */
import { escHtml as xesc } from './index'
import type { SimpleDoc } from './simple-doc'

export const run = (t: string, opts: { b?: boolean; i?: boolean } = {}): string => {
  const rPr = (opts.b ? '<w:b/>' : '') + (opts.i ? '<w:i/>' : '')
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`
}
export const para = (t: string, opts: { style?: string; b?: boolean; i?: boolean; just?: boolean } = {}): string => {
  const pPr = (opts.style ? `<w:pStyle w:val="${opts.style}"/>` : '') + (opts.just ? '<w:jc w:val="both"/>' : '')
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${run(t, opts)}</w:p>`
}
export const emptyPara = (): string => '<w:p/>'
export const pageBreak = (): string => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

// Bordi singoli per le tabelle (riusati in ogni cella via tblBorders).
const TBL_BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') +
  '</w:tblBorders>'

export function tableXml(rows: string[][], hasHeader: boolean): string {
  const cell = (text: string, bold: boolean): string =>
    `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(text, { b: bold })}</w:p></w:tc>`
  const tr = (r: string[], bold: boolean): string => `<w:tr>${r.map(c => cell(c, bold)).join('')}</w:tr>`
  const body = rows.map((r, i) => tr(r, hasHeader && i === 0)).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TBL_BORDERS}<w:tblLook w:val="04A0"/></w:tblPr>${body}</w:tbl>` + emptyPara()
}

const isSepRow = (r: string[]): boolean => r.every(c => /^:?-{2,}:?$/.test(c) || c === '')

/** Blocchi di testo (vuota = nuovo blocco) → OOXML: paragrafi, elenchi, tabelle. */
export function blocksToXml(text: string): string {
  return String(text || '').split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return ''
    if (lines.length >= 2 && lines.every(l => l.includes('|'))) {
      const rows = lines.map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()))
      let header = false, body = rows
      if (rows.length >= 2 && isSepRow(rows[1])) { header = true; body = [rows[0], ...rows.slice(2)] }
      return tableXml(body.filter(r => !isSepRow(r)), header)
    }
    if (lines.every(l => l.startsWith('- '))) {
      return lines.map(l => para('•  ' + l.slice(2), { style: 'ListParagraph' })).join('')
    }
    return para(lines.join(' '), { just: true })
  }).join('')
}

export const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="40"/><w:ind w:left="360"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Riferimenti"><w:name w:val="Riferimenti"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Pacchetto .docx (path → contenuto) dato il body XML di `word/document.xml`
 * (già comprensivo di `<w:body>…</w:body>`? NO: qui passa solo il contenuto
 * interno, questa funzione aggiunge l'involucro `<w:document>`). La UI zippa
 * con JSZip: `for (const [p,c] of Object.entries(pkg)) zip.file(p,c)`.
 */
export function buildDocxPackage(bodyInnerXml: string): Record<string, string> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyInnerXml}</w:body></w:document>`
  return {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': RELS,
    'word/_rels/document.xml.rels': DOC_RELS,
    'word/styles.xml': STYLES_XML,
    'word/document.xml': documentXml,
  }
}

/** Pacchetto .docx per un `SimpleDoc` FLAT (titolo + meta + sezioni), niente indice/cover complessa. */
export function buildSimpleDocxParts(doc: SimpleDoc): Record<string, string> {
  const cover: string[] = [para(doc.titolo, { style: 'Title' })]
  if (doc.sottotitolo) cover.push(para(doc.sottotitolo, { i: true }))
  if (doc.meta && doc.meta.length) cover.push(tableXml(doc.meta.map(([k, v]) => [k, v]), false))
  const body = doc.sezioni.map(s => (s.titolo ? para(s.titolo, { style: 'Heading1' }) : '') + blocksToXml(s.testo)).join('')
  return buildDocxPackage(cover.join('') + body)
}
