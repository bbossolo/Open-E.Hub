/* δ Pages — vista 1: il template di sfondo. Import PDF (via pdf.js) o immagine,
   font e label incorporati, rendering dello sfondo della copertina. */
import { loadPdfLib } from '../../../shared'
import { extractEmbeddedFonts, pickBoldFont, pickRegularFont, resolveCover } from '../engine'
import { renderCampi } from './campi.js'
import { drawCover } from './disegno.js'
import { esc, renderAll, toast } from './shell.js'
import { S, sel } from './stato.js'

/* ════════════════════ VISTA 1 — TEMPLATE ════════════════════ */
export function onTemplateFile(file) {
  if (!file) return
  const lower = (file.name || '').toLowerCase()
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') importTemplatePDF(file)
  else if ((file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|gif|webp|bmp)$/.test(lower)) importTemplateImg(file)
  else toast('Formato non riconosciuto: usa un PDF o un\'immagine (PNG/JPG).')
}

export let _pdfjsLoading = null
export function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  if (_pdfjsLoading) return _pdfjsLoading
  _pdfjsLoading = new Promise((resolve, reject) => {
    const sc = document.createElement('script')
    sc.src = 'vendor/pdf.min.js'
    sc.onload = () => {
      if (window.pdfjsLib) {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js' } catch { /* worker opzionale */ }
        resolve(window.pdfjsLib)
      } else reject(new Error('motore PDF non inizializzato'))
    }
    sc.onerror = () => { _pdfjsLoading = null; reject(new Error('offline')) }
    document.head.appendChild(sc)
  })
  return _pdfjsLoading
}

/** bytes → base64, a blocchi (spread/apply su array enormi supera il limite di argomenti del motore JS). */
export function bytesToBase64(bytes) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

export let _fontCandidates = []   // font incorporati rilevati nell'ultimo template PDF importato
export let _labelCandidates = []  // etichette (celle) rilevate nello strato-testo dell'ultimo template PDF
export let _templatePdfBytes = null // bytes del PDF template (transiente): servono all'export DXF vettoriale
/** base64 → Uint8Array. */
export function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Font incorporati nel PDF (se presenti): estratti in parallelo alla rasterizzazione,
 *  per usare nell'export il font VERO del cartiglio invece di Helvetica. Fallisce in
 *  silenzio (array vuoto) se pdf-lib non è disponibile o il PDF non ha font incorporati. */
export function extractTemplateFonts(data) {
  return loadPdfLib().then(() => extractEmbeddedFonts(data, window.PDFLib)).catch(() => [])
}

/** Etichette (celle) dello strato-testo del template, in coordinate-frazione 0–1
 *  (origine in alto a sinistra) — servono all'auto-detect dei campi (detect.ts).
 *  `base` = viewport a scala 1 (dimensione in punti). Fallisce in silenzio ([]). */
export async function extractTemplateLabels(page, pdfjsLib, base) {
  try {
    const tc = await page.getTextContent()
    const vw = base.width, vh = base.height
    return tc.items.map(it => {
      const tr = pdfjsLib.Util.transform(base.transform, it.transform)
      const fh = Math.hypot(tr[2], tr[3]) || it.height || 10   // altezza font in punti
      const x = tr[4], baseline = tr[5]                        // origine testo (baseline), y-down
      return { text: String(it.str || ''), x: x / vw, y: (baseline - fh) / vh, w: (it.width || 0) / vw, h: fh / vh }
    }).filter(l => l.text.trim())
  } catch { return [] }
}

export function importTemplatePDF(file) {
  toast('Caricamento PDF…')
  const reader = new FileReader()
  reader.onload = ev => { loadTemplateFromPdfBytes(new Uint8Array(ev.target.result), file.name).catch(err => toast(`Errore elaborazione PDF: ${err.message}`)) }
  reader.onerror = () => toast('Impossibile leggere il file PDF')
  reader.readAsArrayBuffer(file)
}

/** Carica un template da bytes PDF: raster + font incorporati + etichette (auto-detect)
 *  + `_templatePdfBytes` (per l'export DXF). Riusato sia dall'import-file sia
 *  dall'applicazione di un MODELLO della libreria studio. */
export async function loadTemplateFromPdfBytes(bytes, name) {
  const loading = document.getElementById('dTemplateLoading')
  if (loading) loading.hidden = false
  try {
    const pdfjsLib = await loadPdfJs()
    _templatePdfBytes = bytes.slice() // copia: pdf.js può "detach"are il buffer passando al worker
    let ptSize = null
    const [{ canvas, labels }, fonts] = await Promise.all([
      // isEvalSupported:false → niente esecuzione di JS da un PDF ostile (CVE-2024-4367)
      pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise
        .then(pdf => pdf.getPage(1))
        .then(async page => {
          const base = page.getViewport({ scale: 1 })
          ptSize = { w: base.width, h: base.height } // punti PDF: dimensione fisica reale
          const target = 1654 // ~140 dpi su A4
          const scale = Math.min(3, Math.max(1, target / Math.max(base.width, base.height)))
          const vp = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height)
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          const labels = await extractTemplateLabels(page, pdfjsLib, base)
          return { canvas, labels }
        }),
      extractTemplateFonts(bytes),
    ])
    _fontCandidates = fonts
    _labelCandidates = labels
    setTemplate(canvas.toDataURL('image/jpeg', 0.82), canvas.width, canvas.height, 'pdf', name, ptSize)
    applyTemplateFont(pickRegularFont(fonts), pickBoldFont(fonts))
    renderFontPicker()
  } finally {
    if (loading) loading.hidden = true
  }
}

/** Applica un font regolare/bold rilevato (o nessuno) al template corrente. */
export function applyTemplateFont(regular, bold) {
  if (!S.template) return
  if (regular) { S.template.fontName = regular.name; S.template.fontRegularB64 = bytesToBase64(regular.bytes) }
  else { delete S.template.fontName; delete S.template.fontRegularB64 }
  if (bold) S.template.fontBoldB64 = bytesToBase64(bold.bytes)
  else delete S.template.fontBoldB64
}

export function onFontPick(name) {
  const f = _fontCandidates.find(c => c.name === name)
  if (!f) return
  applyTemplateFont(f, pickBoldFont(_fontCandidates))
  renderTemplate()
}

export function renderFontPicker() {
  const box = document.getElementById('dTemplateFontPicker')
  if (!box) return
  const nonBold = _fontCandidates.filter(f => !f.bold)
  if (nonBold.length <= 1) { box.hidden = true; return }
  box.hidden = false
  const sel = document.getElementById('dTemplateFontSelect')
  sel.innerHTML = nonBold.map(f => `<option value="${esc(f.name)}"${S.template && S.template.fontName === f.name ? ' selected' : ''}>${esc(f.name)}</option>`).join('')
  sel.onchange = () => onFontPick(sel.value)
}

export function importTemplateImg(file) {
  _templatePdfBytes = null // template immagine: nessun vettore per il DXF
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => setTemplate(String(ev.target.result), img.width, img.height, 'image', file.name)
    img.onerror = () => toast('Immagine non valida')
    img.src = String(ev.target.result)
  }
  reader.readAsDataURL(file)
}

export function setTemplate(dataUrl, w, h, kind, name, ptSize) {
  S.template = { dataUrl, w, h, kind, name: name || 'template' }
  if (ptSize && ptSize.w > 0 && ptSize.h > 0) { S.template.ptW = ptSize.w; S.template.ptH = ptSize.h }
  toast(`Template caricato (${w}×${h}).`)
  renderAll()
}
export function clearTemplate() {
  S.template = null
  _fontCandidates = []
  _labelCandidates = []
  _templatePdfBytes = null
  renderAll()
}

/** Barra sopra il workbench: modello applicato + apertura editor + «Applica e
 *  continua». L'azione non fa altro che chiudere la fase di preparazione:
 *  le modifiche sono già scritte in tempo reale su S.fields/S.template da updateField(). */
export function renderTemplateBar() {
  const info = document.getElementById('dTemplateBarInfo')
  const cta = document.getElementById('dBtnApplyContinue')
  const toggle = document.getElementById('dBtnToggleEditor')
  const editorWrap = document.getElementById('dTemplateEditorWrap')
  if (!info) return
  if (S.template) info.innerHTML = `Stai preparando: <b>${esc(S.template.name)}</b>`
  else info.textContent = 'Nessun template applicato: caricane uno o scegline uno dalla libreria.'
  if (cta) cta.disabled = !S.template
  // Fuori dall'Editor si può aprirlo solo con un template applicato; una volta
  // dentro resta sempre cliccabile (serve a chiuderlo, non ad aprirlo).
  const isEditor = editorWrap ? !editorWrap.hidden : false
  if (toggle) toggle.disabled = !isEditor && !S.template
}

/** Anteprima di SOLA LETTURA nella Home (stesso motore di disegno dell'Editor,
 *  editable=false): mostra il cartiglio come uscirà, sfondo + campi già
 *  composti — non toccabile da qui, l'editing resta riservato all'Editor.
 *  Separata da renderTemplate() perché va richiamata anche solo per rispecchiare
 *  i campi appena creati/modificati nell'Editor, senza rifare tutto il resto
 *  (libreria, barra, font…): va chiamata quando si TORNA alla Home, non mentre
 *  ci si lavora dentro (l'Editor ha il suo canvas, sempre già aggiornato). */
export function renderTemplatePreview() {
  const previewBlock = document.getElementById('dTemplatePreviewBlock')
  const prev = document.getElementById('dTemplatePreview')
  const fieldsWarn = document.getElementById('dTemplateFieldsWarn')
  if (!S.template) { if (previewBlock) previewBlock.hidden = true; return }
  if (previewBlock) previewBlock.hidden = false
  if (prev) drawCover(prev, resolveCover(S, -1), false)
  if (fieldsWarn) fieldsWarn.hidden = S.fields.length > 0
}

export function renderTemplate() {
  renderTemplateBar()
  renderCampi() // canvas + lista campi + pannello proprietà: si vedono solo a editor aperto
  renderTemplatePreview()
  const info = document.getElementById('dTemplateInfo')
  const introHint = document.getElementById('dTemplateIntroHint')
  const clr = document.getElementById('dBtnTemplateClear')
  const fontPicker = document.getElementById('dTemplateFontPicker')
  if (!S.template) {
    info.hidden = true; clr.hidden = true
    if (fontPicker) fontPicker.hidden = true
    if (introHint) introHint.hidden = false
    return
  }
  const t = S.template
  clr.hidden = false
  info.hidden = false
  const fontLine = t.fontName
    ? ` · font rilevato: <b>${esc(t.fontName)}</b>`
    : (t.kind === 'pdf' ? ' · nessun font incorporato trovato (verrà usato Helvetica)' : '')
  info.innerHTML = `<b>${esc(t.name)}</b> · ${t.kind === 'pdf' ? 'PDF (1ª pagina)' : 'Immagine'} · ${t.w}×${t.h}px${fontLine}`
  // La scelta del template smette di essere protagonista una volta fatta: il
  // testo esplicativo lungo lascia il posto all'anteprima, sopra.
  if (introHint) introHint.hidden = true
  renderFontPicker()
}

/* Riassegnazioni da altri moduli: in ESM un import non è un binding assegnabile. */
export function setTemplatePdfBytes(v) { _templatePdfBytes = v }

