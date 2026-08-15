/* δ Pages — vista 4: anteprima, generazione del PDF unico e dell'export DXF. */
import { loadFontkit, loadJSZip, loadPdfLib } from '../../../shared'
import { pageVectors } from '../../../shared/dxf-from-pdf'
import { buildAllCoverDxf, buildAllCoverPdfs, coverDocHTML, matchColumn, resolveCover } from '../engine'
import { drawCover } from './disegno.js'
import { esc, toast } from './shell.js'
import { S, previewIndex, sel, setPreviewIndex } from './stato.js'
import { _templatePdfBytes, loadPdfJs } from './template.js'

/* ════════════════════ VISTA 4 — GENERA ════════════════════ */
export let _generating = false

export function renderGenera() {
  const empty = document.getElementById('dGeneraEmpty')
  const work = document.getElementById('dGeneraWork')
  if (!S.template) { empty.hidden = false; work.hidden = true; return }
  empty.hidden = true; work.hidden = false
  const nav = document.getElementById('dPreviewNav')
  const total = S.elenco ? S.elenco.rows.length : 0
  const summary = document.getElementById('dGeneraSummary')
  const fnBlock = document.getElementById('dFilenameBlock')
  if (total > 0) {
    nav.hidden = false
    setPreviewIndex(Math.max(0, Math.min(previewIndex, total - 1)))
    document.getElementById('dPreviewLabel').textContent = `${previewIndex + 1} / ${total}`
    summary.textContent = `Verranno generati ${total} PDF distinti (uno per elaborato), in uno ZIP.`
    fnBlock.hidden = false
    renderFilenameSelect()
  } else {
    nav.hidden = true
    fnBlock.hidden = true
    summary.textContent = 'Nessun elenco: verrà generato un solo PDF coi campi fissi.'
  }
  drawCover(document.getElementById('dPreviewCanvas'), resolveCover(S, total > 0 ? previewIndex : -1), false)
}

export function renderFilenameSelect() {
  const sel = document.getElementById('dFilenameColumn')
  if (!S.filenameColumn) {
    const guess = matchColumn(S.elenco.headers, 'CODICE_ELABORATO')
    if (guess) S.filenameColumn = guess
  }
  sel.innerHTML = `<option value="">Copertina-1, Copertina-2…</option>` +
    S.elenco.headers.map(h => `<option value="${esc(h)}"${S.filenameColumn === h ? ' selected' : ''}>${esc(h)}</option>`).join('')
  sel.onchange = () => { S.filenameColumn = sel.value || undefined }
}

export function previewStep(d) {
  const total = S.elenco ? S.elenco.rows.length : 0
  if (!total) return
  setPreviewIndex((previewIndex + d + total) % total)
  renderGenera()
}

/** Anteprima rapida: stampa la SOLA copertina corrente (browser print), per un
 *  controllo visivo senza aspettare l'export completo di elenchi grandi. */
export function stampaAnteprimaCorrente() {
  if (!S.template) return
  const total = S.elenco ? S.elenco.rows.length : 0
  const page = resolveCover(S, total > 0 ? previewIndex : -1)
  if (!page) { toast('Niente da stampare.'); return }
  const html = coverDocHTML({ pages: [page] }, 'Copertina')
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) { toast('Consenti i popup per la stampa.'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

export function setGenProgress(done, total) {
  const bar = document.getElementById('dGenProgressBar')
  const lbl = document.getElementById('dGenProgressLabel')
  if (!bar) return
  bar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%'
  lbl.textContent = total ? `${done} / ${total}` : ''
}

export async function generaPDF() {
  if (_generating) return
  if (!S.template) { toast('Carica prima un template.'); return }
  const rowCount = S.elenco ? S.elenco.rows.length : 0
  if (!rowCount && !S.fields.length) { toast('Niente da generare.'); return }
  _generating = true
  const wrap = document.getElementById('dGenProgress')
  const btn = document.getElementById('dBtnGenera')
  wrap.hidden = false; if (btn) btn.disabled = true
  setGenProgress(0, rowCount || 1)
  try {
    const needsFontkit = !!(S.template && (S.template.fontRegularB64 || S.template.fontBoldB64))
    await Promise.all([loadPdfLib(), loadJSZip(), needsFontkit ? loadFontkit() : Promise.resolve()])
    const pdfs = await buildAllCoverPdfs(S, S.filenameColumn, window.PDFLib, (done, total) => {
      setGenProgress(done, total)
    }, window.fontkit)
    if (!pdfs.length) { toast('Niente da generare.'); return }
    const baseName = S.elenco ? (S.elenco.fileName.replace(/\.[^.]+$/, '') || 'Copertine') : 'Copertine'
    if (pdfs.length === 1) {
      downloadBlob(new Blob([pdfs[0].bytes], { type: 'application/pdf' }), pdfs[0].name)
      toast('PDF generato.')
    } else {
      // Compressione ZIP: nessun conteggio reale (JSZip non riporta un progresso
      // per-file affidabile qui) — la clessidra sostituisce la barra per non
      // mentire su un progresso che non abbiamo, restando comunque "in corso".
      const lbl = document.getElementById('dGenProgressLabel')
      const spinner = document.getElementById('dGenSpinner')
      if (lbl) lbl.textContent = `Comprimo ${pdfs.length} copertine in ZIP…`
      if (spinner) spinner.hidden = false
      const zip = new window.JSZip()
      for (const p of pdfs) zip.file(p.name, p.bytes)
      const blob = await zip.generateAsync({ type: 'blob' })
      if (spinner) spinner.hidden = true
      downloadBlob(blob, `${baseName}-copertine.zip`)
      toast(`${pdfs.length} copertine generate in ${baseName}-copertine.zip.`)
    }
  } catch (err) {
    toast(`Errore nella generazione: ${err.message}`)
  } finally {
    _generating = false
    wrap.hidden = true; if (btn) btn.disabled = false
    const spinner = document.getElementById('dGenSpinner')
    if (spinner) spinner.hidden = true
  }
}

/** Export DXF VETTORIALE: un .dxf per elaborato (cornice + testo editabile),
 *  in uno ZIP. Richiede il PDF del template caricato in questa sessione (i vettori
 *  non stanno nel .ehub). Il cartiglio è riprodotto tale e quale, senza brand. */
export async function generaDXF() {
  if (_generating) return
  if (!S.template) { toast('Carica prima un template.'); return }
  if (S.template.kind !== 'pdf' || !_templatePdfBytes) {
    toast('Per l\'export DXF serve un template PDF caricato in questa sessione (ricaricalo nel passo 1).')
    return
  }
  const rowCount = S.elenco ? S.elenco.rows.length : 0
  if (!rowCount && !S.fields.length) { toast('Niente da generare.'); return }
  _generating = true
  const wrap = document.getElementById('dGenProgress')
  const btn = document.getElementById('dBtnGeneraDxf')
  wrap.hidden = false; if (btn) btn.disabled = true
  setGenProgress(0, rowCount || 1)
  try {
    const [pdfjsLib] = await Promise.all([loadPdfJs(), loadJSZip()])
    // Vettori del cartiglio: estratti UNA volta dalla 1ª pagina del PDF template.
    // isEvalSupported:false — un PDF ostile non deve poter eseguire JS nel
    // renderer (CVE-2024-4367): il PDF qui è un file che l'utente ha ricevuto
    // da terzi. Vale per OGNI getDocument della suite.
    const pdf = await pdfjsLib.getDocument({ data: _templatePdfBytes.slice(), isEvalSupported: false }).promise
    const page = await pdf.getPage(1)
    const base = await pageVectors(page, pdfjsLib)
    const files = buildAllCoverDxf(S, base, S.filenameColumn)
    setGenProgress(files.length, files.length)
    if (!files.length) { toast('Niente da generare.'); return }
    const baseName = S.elenco ? (S.elenco.fileName.replace(/\.[^.]+$/, '') || 'Cartigli') : 'Cartigli'
    if (files.length === 1) {
      downloadBlob(new Blob([files[0].dxf], { type: 'application/dxf' }), files[0].name)
      toast('DXF generato.')
    } else {
      const zip = new window.JSZip()
      for (const f of files) zip.file(f.name, f.dxf)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${baseName}-cartigli-dxf.zip`)
      toast(`${files.length} cartigli DXF generati in ${baseName}-cartigli-dxf.zip.`)
    }
  } catch (err) {
    toast(`Errore nell'export DXF: ${err.message}`)
  } finally {
    _generating = false
    wrap.hidden = true; if (btn) btn.disabled = false
  }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
