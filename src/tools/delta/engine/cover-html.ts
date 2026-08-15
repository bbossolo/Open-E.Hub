/**
 * δ Pages — genera l'HTML A4 stampabile del documento copertine (puro, no DOM).
 * La UI si limita ad aprirlo in una finestra e lanciare window.print() → «Salva
 * come PDF» nativo (stesso pattern degli altri report della suite). Niente jsPDF.
 *
 * Coordinate: ogni campo è posizionato in PERCENTUALE del box pagina (left/top),
 * l'ancoraggio è una translate(), il font è una frazione dell'altezza pagina —
 * identico a come l'editor li disegna sull'SVG, così «quel che vedi è quel che
 * stampi».
 */
import type { CoverDoc, CoverPage, ResolvedField } from './types'
import { anchorTranslate, fieldBoxWidthFrac } from './cover-model'

const esc = (s: string): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** Orientamento pagina derivato dall'aspect del template (w>h → landscape). */
function orientation(doc: CoverDoc): 'portrait' | 'landscape' {
  const t = doc.pages[0]?.bg
  return t && t.w > t.h ? 'landscape' : 'portrait'
}

function fieldHTML(f: ResolvedField): string {
  const { tx, ty } = anchorTranslate(f.anchor)
  // Ogni campo è una CASELLA di larghezza nota che manda a capo da sola: la
  // stessa larghezza usata dall'editor e dal PDF export (`fieldBoxWidthFrac`).
  // Con la casella allineata al bordo (l/r) o simmetrica sul punto (c), le
  // traslazioni d'ancoraggio 0/-50%/-100% restano corrette.
  const boxW = Math.max(0, fieldBoxWidthFrac(f.anchor, f.x, f.maxWidthFrac))
  const style = [
    'position:absolute',
    `left:${(f.x * 100).toFixed(3)}%`,
    `top:${(f.y * 100).toFixed(3)}%`,
    `width:${(boxW * 100).toFixed(3)}%`,
    `transform:translate(${tx},${ty})`,
    `text-align:${f.align}`,
    `font-size:calc(${f.fontFrac} * var(--page-h))`,
    f.bold ? 'font-weight:700' : 'font-weight:400',
    // Approssimazione del fit-in-box del PDF: l'HTML statico non può ridurre
    // il corpo, quindi la casella ad altezza fissa almeno CONTIENE (clip).
    ...(f.maxHeightFrac ? [`max-height:calc(${f.maxHeightFrac} * var(--page-h))`, 'overflow:hidden'] : []),
  ].join(';')
  return `<div class="d-fld" style="${style}">${esc(f.text)}</div>`
}

function pageHTML(p: CoverPage): string {
  const bg = `background-image:url("${p.bg.dataUrl}")`
  return `<section class="d-page" style="${bg}">${p.fields.map(fieldHTML).join('')}</section>`
}

/** HTML completo, auto-stampante. `title` compare come nome default del PDF. */
export function coverDocHTML(doc: CoverDoc, title = 'Copertine'): string {
  const ori = orientation(doc)
  // A4: 210×297mm. --page-h = altezza pagina, base della scala del font.
  const pageW = ori === 'landscape' ? '297mm' : '210mm'
  const pageH = ori === 'landscape' ? '210mm' : '297mm'
  const body = doc.pages.length
    ? doc.pages.map(pageHTML).join('\n')
    : '<section class="d-page d-empty"><div>Nessuna copertina: importa un template e (opzionale) un elenco.</div></section>'
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 ${ori}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #525659; }
  :root { --page-w: ${pageW}; --page-h: ${pageH}; }
  .d-page {
    position: relative; width: var(--page-w); height: var(--page-h);
    margin: 8mm auto; background-color: #fff;
    background-size: 100% 100%; background-repeat: no-repeat; background-position: center;
    overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.4);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-family: 'Helvetica Neue', Arial, sans-serif; color: #111;
  }
  .d-fld { white-space: pre-wrap; overflow-wrap: break-word; line-height: 1.2; }
  .d-empty { display: flex; align-items: center; justify-content: center; color: #888; font-size: 14pt; }
  @media print {
    html, body { background: #fff; }
    .d-page { margin: 0; box-shadow: none; page-break-after: always; }
    .d-page:last-child { page-break-after: auto; }
  }
</style></head>
<body onload="window.print()">
${body}
</body></html>`
}
