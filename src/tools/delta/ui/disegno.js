/* δ Pages — la tela: disegno della copertina, aree sensibili, selezione,
   spostamento, ridimensionamento, tracciamento di un campo e a-capo del testo. */
import { LINE_HEIGHT_FRAC, fieldBoxWidthFrac, firstBaselineOffset } from '../engine'
import { redrawEditor, removeField, renderCampi, renderFieldList, renderFieldProps, updateField } from './campi.js'
import { SVG_NS, clamp01, toast, uid } from './shell.js'
import { S, sel, setSel } from './stato.js'

/* ── Canvas SVG condiviso (editor + anteprima) ──
   Il template è l'<image> di sfondo; ogni campo è un <text> in coordinate del
   raster (viewBox 0 0 w h). In modalità editable i campi si trascinano coi
   Pointer Events e la posizione si salva come frazione 0–1 (scala-invariante,
   così l'editor e il PDF stampato coincidono). */
export function drawCover(host, page, editable) {
  host.replaceChildren()
  if (!page) return
  const { w, h } = page.bg
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.classList.add('d-svg')
  const img = document.createElementNS(SVG_NS, 'image')
  img.setAttribute('href', page.bg.dataUrl)
  img.setAttribute('x', '0'); img.setAttribute('y', '0')
  img.setAttribute('width', String(w)); img.setAttribute('height', String(h))
  svg.appendChild(img)

  const texts = []
  page.fields.forEach((rf, i) => {
    const f = S.fields[i]
    const t = document.createElementNS(SVG_NS, 'text')
    t.setAttribute('x', String(rf.x * w))
    t.setAttribute('y', String(rf.y * h))
    t.setAttribute('font-size', String(rf.fontFrac * h))
    t.setAttribute('text-anchor', rf.anchor[1] === 'l' ? 'start' : rf.anchor[1] === 'r' ? 'end' : 'middle')
    t.setAttribute('font-weight', rf.bold ? '700' : '400')
    t.setAttribute('font-family', 'Helvetica, Arial, sans-serif')
    t.classList.add('d-fld-text')
    if (editable && f && f.id === sel) t.classList.add('is-sel')
    if (editable && f && !rf.text) t.classList.add('is-empty')
    t.textContent = rf.text || (editable && f ? `‹${f.label}›` : '')
    if (editable && f) {
      t.style.cursor = 'move'
      t.addEventListener('pointerdown', e => startDrag(e, f, svg, t, w, h))
    }
    svg.appendChild(t)
    texts.push({ el: t, rf, f })
  })
  if (editable) svg.addEventListener('pointerdown', e => onDrawStart(e, svg, w, h))
  host.appendChild(svg)
  layoutTexts(texts, w, h)
  if (editable) { addHitAreas(svg, texts, w, h); decorateSelected(svg, texts, w, h) }
}

/* ── Area di presa dei campi ──────────────────────────────────────────────
   Su SVG un <text> si aggancia SOLO sui tratti dei glifi: con le celle piccole
   dei cartigli reali (font-size ~1,3% dell'altezza) diventa quasi impossibile
   afferrare un campo col mouse. Si mette quindi un rettangolo trasparente
   dietro ogni campo, con padding e una dimensione MINIMA cliccabile, e si
   avvia da lì il trascinamento. Il testo resta sopra (solo estetica). */
export function addHitAreas(svg, texts, w, h) {
  const unit = Math.max(w, h)
  const minSide = unit * 0.022   // lato minimo afferrabile, anche per campi vuoti
  const pad = unit * 0.006
  for (const it of texts) {
    if (!it.f) continue
    let b; try { b = it.el.getBBox() } catch { continue }
    if (!b) continue
    const bw = Math.max(b.width, minSide), bh = Math.max(b.height, minSide)
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2
    const r = svgEl('rect', {
      x: cx - bw / 2 - pad, y: cy - bh / 2 - pad,
      width: bw + 2 * pad, height: bh + 2 * pad,
      class: 'd-fld-hit',
    })
    r.style.cursor = 'move'
    // In modalità «Disegna campo» il click deve arrivare al canvas per tracciare
    // il rettangolo, anche sopra un campo esistente: si spegne la presa.
    if (_drawMode) r.style.pointerEvents = 'none'
    r.addEventListener('pointerdown', e => startDrag(e, it.f, svg, it.el, w, h))
    svg.insertBefore(r, it.el)   // dietro al testo
  }
}

/* ── Maniglie a video sul campo selezionato: elimina (×) e allarga la casella
   di testo (↔, mai il corpo — sono due proprietà indipendenti) ── Rendono
   l'editing intuitivo "a schermo", oltre al pannello proprietà. */
export function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}
/** Geometria della CASELLA di testo del campo selezionato (px del viewBox).
 *  Di default (nessuna `maxWidthFrac` impostata) la casella è larga quanto il
 *  testo dell'etichetta/valore corrente (`naturalWidthPx`, il bbox già misurato
 *  in editor) — NON «fino al bordo pagina»: quel fallback esiste in
 *  `fieldBoxWidthFrac` per il wrap reale quando serve più spazio, ma come
 *  riquadro di default in editor sarebbe enorme e fuorviante per un'etichetta
 *  corta. Se l'utente ha impostato la casella (`maxWidthFrac`), quella prevale
 *  SEMPRE — anche più stretta del testo: il testo va a capo (e col fit-in-box
 *  verticale si riduce), la casella non è mai bloccata dalla lunghezza. */
export function selectedBoxRect(f, w, naturalWidthPx) {
  const explicitWpx = (f.maxWidthFrac && f.maxWidthFrac > 0) ? f.maxWidthFrac * w : 0
  const boxWpx = explicitWpx > 0 ? explicitWpx : naturalWidthPx
  const anchorXpx = f.x * w
  const hAnchor = f.anchor[1]
  const x = hAnchor === 'l' ? anchorXpx : hAnchor === 'r' ? anchorXpx - boxWpx : anchorXpx - boxWpx / 2
  return { x, width: boxWpx, anchorXpx, hAnchor }
}
/** Bordi verticali della casella: con `maxHeightFrac` l'altezza è quella
 *  dichiarata, agganciata al punto secondo l'ancora verticale (t/m/b);
 *  altrimenti segue il bbox del testo renderizzato. */
export function selectedBoxVert(f, h, bbox, pad) {
  const explicitHpx = (f.maxHeightFrac && f.maxHeightFrac > 0) ? f.maxHeightFrac * h : 0
  if (!explicitHpx) return { y: bbox.y - pad, height: bbox.height + 2 * pad, anchorYpx: f.y * h, vAnchor: f.anchor[0] }
  const anchorYpx = f.y * h
  const v = f.anchor[0]
  const y = v === 't' ? anchorYpx : v === 'b' ? anchorYpx - explicitHpx : anchorYpx - explicitHpx / 2
  return { y, height: explicitHpx, anchorYpx, vAnchor: v }
}
export function decorateSelected(svg, texts, w, h) {
  const it = texts.find(t => t.f && t.f.id === sel)
  if (!it) return
  let b; try { b = it.el.getBBox() } catch { return }
  if (!b || !b.width) return
  const f = it.f
  const pad = Math.max(w, h) * 0.006
  const hs = Math.max(8, Math.max(w, h) * 0.011) // raggio maniglia (min. afferrabile, discreto)
  // Riquadro della casella (area di testo): SEPARATO dalla dimensione del
  // testo — trascinarne l'angolo cambia solo l'area (wrap + fit verticale),
  // mai il corpo (quello si imposta a parte, nel pannello «Dimensione testo»).
  const box = selectedBoxRect(f, w, b.width)
  const vert = selectedBoxVert(f, h, b, pad)
  const boxRect = svgEl('rect', { x: box.x, y: vert.y, width: box.width, height: vert.height, class: 'd-sel-box' })
  boxRect.addEventListener('pointerdown', e => startDrag(e, f, svg, it.el, w, h, boxRect))
  boxRect.addEventListener('dblclick', e => {
    e.stopPropagation(); e.preventDefault()
    updateField(f.id, { maxWidthFrac: undefined, maxHeightFrac: undefined })
    renderFieldProps(); redrawEditor()
  })
  svg.appendChild(boxRect)
  // Elimina (×) in alto a destra della casella
  const delG = svgEl('g', { class: 'd-handle d-handle--del' })
  delG.appendChild(svgEl('circle', { cx: box.x + box.width + pad, cy: vert.y, r: hs }))
  const delX = svgEl('text', { x: box.x + box.width + pad, y: vert.y, class: 'd-handle-glyph', 'font-size': hs * 1.4 }); delX.textContent = '×'
  delG.appendChild(delX)
  delG.style.cursor = 'pointer'
  delG.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); removeField(sel) })
  svg.appendChild(delG)
  // Ridimensiona (⤡): angolo in BASSO sul bordo verso cui il testo cresce
  // (destra per l/c, sinistra per r) — trascinarlo cambia SOLO l'area della
  // casella (`maxWidthFrac` + `maxHeightFrac`): il testo va a capo entro la
  // larghezza e, se non ci sta in altezza, il corpo si riduce per starci.
  const botY = vert.y + vert.height
  const handleX = box.hAnchor === 'r' ? box.x : box.x + box.width
  const rzG = svgEl('g', { class: 'd-handle d-handle--resize' })
  rzG.appendChild(svgEl('circle', { cx: handleX, cy: botY, r: hs }))
  const rzGl = svgEl('text', { x: handleX, y: botY, class: 'd-handle-glyph', 'font-size': hs * 1.2 })
  rzGl.textContent = box.hAnchor === 'r' ? '⤢' : '⤡'
  rzG.appendChild(rzGl)
  rzG.style.cursor = box.hAnchor === 'r' ? 'nesw-resize' : 'nwse-resize'
  rzG.addEventListener('pointerdown', e => onResizeStart(e, f, svg, w, h, boxRect))
  svg.appendChild(rzG)
}
export let _resizing = null
export function onResizeStart(e, f, svg, w, h, boxRectEl) {
  e.stopPropagation(); e.preventDefault()
  _resizing = { f, svg, w, h, anchorXpx: f.x * w, anchorYpx: f.y * h, hAnchor: f.anchor[1], vAnchor: f.anchor[0], boxRectEl }
  try { svg.setPointerCapture(e.pointerId) } catch { /* no capture */ }
  svg.addEventListener('pointermove', onResizeMove)
  svg.addEventListener('pointerup', onResizeEnd)
}
export function onResizeMove(e) {
  if (!_resizing) return
  const { f, svg, w, h, anchorXpx, anchorYpx, hAnchor, vAnchor, boxRectEl } = _resizing
  const p = clientToSvg(svg, e.clientX, e.clientY)
  let widthPx = hAnchor === 'l' ? p.x - anchorXpx : hAnchor === 'r' ? anchorXpx - p.x : 2 * Math.abs(p.x - anchorXpx)
  let heightPx = vAnchor === 't' ? p.y - anchorYpx : vAnchor === 'b' ? anchorYpx - p.y : 2 * Math.abs(p.y - anchorYpx)
  // La casella può diventare anche PIÙ STRETTA del testo: il testo va a capo
  // (e col fit verticale si riduce). Minimi solo per restare afferrabile.
  widthPx = Math.max(w * 0.02, widthPx)
  heightPx = Math.max(h * 0.01, heightPx)
  const frac = Math.min(1, widthPx / w)
  const fracH = Math.min(1, heightPx / h)
  updateField(f.id, { maxWidthFrac: frac, maxHeightFrac: fracH })
  syncWrapInput(frac, fracH)
  // riscontro visivo immediato del bordo della casella, senza ridisegnare tutto
  // il canvas (il wrap del testo si applica al rilascio, come per il drag posizione)
  if (boxRectEl) {
    const boxX = hAnchor === 'l' ? anchorXpx : hAnchor === 'r' ? anchorXpx - widthPx : anchorXpx - widthPx / 2
    const boxY = vAnchor === 't' ? anchorYpx : vAnchor === 'b' ? anchorYpx - heightPx : anchorYpx - heightPx / 2
    boxRectEl.setAttribute('x', String(boxX))
    boxRectEl.setAttribute('width', String(widthPx))
    boxRectEl.setAttribute('y', String(boxY))
    boxRectEl.setAttribute('height', String(heightPx))
  }
}
export function onResizeEnd(e) {
  if (!_resizing) return
  const r = _resizing; _resizing = null
  r.svg.removeEventListener('pointermove', onResizeMove)
  r.svg.removeEventListener('pointerup', onResizeEnd)
  try { r.svg.releasePointerCapture(e.pointerId) } catch { /* no capture */ }
  renderFieldProps(); redrawEditor()
}
/** Aggiorna gli input «Larghezza/Altezza casella (%)» senza ridisegnare tutto il pannello (perderebbe il focus). */
export function syncWrapInput(frac, fracH) {
  const iw = document.getElementById('dPropWrap')
  if (iw) iw.value = (frac * 100).toFixed(0)
  const ih = document.getElementById('dPropWrapH')
  if (ih && fracH !== undefined) ih.value = (fracH * 100).toFixed(0)
}

/* ── Disegna campo: traccia un rettangolo sul template → nuovo campo ──
   In modalità "Disegna campo" un pointerdown sul canvas avvia una selezione
   rubber-band; al rilascio nasce un campo posizionato nel box disegnato
   (larghezza = wrap, altezza ≈ dimensione testo), da assegnare a fisso o
   variabile nel pannello proprietà. */
export let _drawMode = false
export let _drawing = null
export function toggleDrawField() {
  _drawMode = !_drawMode
  const btn = document.getElementById('dBtnDraw')
  if (btn) btn.classList.toggle('is-active', _drawMode)
  const canvas = document.getElementById('dEditorCanvas')
  if (canvas) canvas.style.cursor = _drawMode ? 'crosshair' : ''
  toast(_drawMode ? 'Disegna un rettangolo sul template per creare un campo.' : 'Modalità disegno disattivata.')
}
export function onDrawStart(e, svg, w, h) {
  if (!_drawMode) return
  e.preventDefault(); e.stopPropagation()
  const p = clientToSvg(svg, e.clientX, e.clientY)
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('class', 'd-draw-rect')
  rect.setAttribute('x', String(p.x)); rect.setAttribute('y', String(p.y))
  rect.setAttribute('width', '0'); rect.setAttribute('height', '0')
  svg.appendChild(rect)
  _drawing = { svg, w, h, x0: p.x, y0: p.y, rect }
  try { svg.setPointerCapture(e.pointerId) } catch { /* no capture */ }
  svg.addEventListener('pointermove', onDrawMove)
  svg.addEventListener('pointerup', onDrawEnd)
}
export function onDrawMove(e) {
  if (!_drawing) return
  const p = clientToSvg(_drawing.svg, e.clientX, e.clientY)
  const x = Math.min(p.x, _drawing.x0), y = Math.min(p.y, _drawing.y0)
  const w = Math.abs(p.x - _drawing.x0), h = Math.abs(p.y - _drawing.y0)
  _drawing.rect.setAttribute('x', String(x)); _drawing.rect.setAttribute('y', String(y))
  _drawing.rect.setAttribute('width', String(w)); _drawing.rect.setAttribute('height', String(h))
  _drawing.last = { x, y, w, h }
}
export function onDrawEnd(e) {
  if (!_drawing) return
  const d = _drawing; _drawing = null
  d.svg.removeEventListener('pointermove', onDrawMove)
  d.svg.removeEventListener('pointerup', onDrawEnd)
  try { d.svg.releasePointerCapture(e.pointerId) } catch { /* no capture */ }
  const box = d.last
  d.rect.remove()
  if (!box || box.w < d.w * 0.01 || box.h < d.h * 0.005) { toast('Rettangolo troppo piccolo: riprova.'); return }
  const fx = clamp01(box.x / d.w), fy = clamp01(box.y / d.h)
  const maxWidthFrac = clamp01(box.w / d.w)
  // Il box disegnato definisce TUTTA l'area: larghezza di wrap + altezza di
  // fit (il testo si riduce se non ci sta) + corpo di partenza dall'altezza.
  const maxHeightFrac = clamp01(box.h / d.h)
  const fontFrac = Math.max(0.012, Math.min(0.1, (box.h / d.h) * 0.8))
  const f = {
    id: uid(), kind: 'fixed', label: 'Campo disegnato',
    x: fx, y: fy, anchor: 'tl', align: 'left', fontFrac, bold: false,
    value: '', maxWidthFrac, maxHeightFrac,
  }
  S.fields.push(f)
  setSel(f.id)
  toggleDrawField() // esce dalla modalità disegno dopo un campo
  renderCampi()
}

/* Impaginazione dei testi: rispecchia in anteprima quel che fa il PDF export
   (layoutField in pdf-export.ts). OGNI campo è una casella di testo che manda a
   capo entro la propria larghezza (`fieldBoxWidthFrac`: quella dichiarata, o lo
   spazio fino al bordo pagina) e CONSERVA il corpo impostato.
   La misura richiede l'elemento già nel DOM: si esegue dopo l'append. */
export const D_MARGIN_FRAC = 0.015
export function layoutTexts(texts, w, h) {
  for (const { el, rf } of texts) {
    const maxW = fieldBoxWidthFrac(rf.anchor, rf.x, rf.maxWidthFrac, D_MARGIN_FRAC) * w
    const maxH = (rf.maxHeightFrac || 0) * h
    const nLines = maxW > 0 ? wrapTextEl(el, rf, maxW, maxH) : 1
    // La y del <text> è la BASELINE della prima riga: stessa convenzione (misurata
    // sulle maiuscole) del PDF export, così anteprima e stampa coincidono.
    const size = parseFloat(el.getAttribute('font-size')) || 0
    el.setAttribute('y', String(rf.y * h + firstBaselineOffset(rf.anchor, size, nLines)))
  }
}

/** Manda a capo il testo di un campo in più righe (tspan) entro `maxW` px del
 *  viewBox, come `wrapLines` nel PDF export. Riduzioni del corpo identiche a
 *  `layoutField` (anteprima e stampa coincidono): parola singola più larga
 *  della casella, e blocco più alto di `maxH` (fit-in-box verticale). */
export function wrapTextEl(el, rf, maxW, maxH = 0) {
  const full = el.textContent
  if (!full) return 1
  let fs = parseFloat(el.getAttribute('font-size')) || 0
  const x = el.getAttribute('x')
  const words = full.split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  const measure = (t) => { el.textContent = t; try { return el.getComputedTextLength() } catch { return 0 } }
  const wrap = () => {
    const out = []
    let cur = words[0]
    let widest = measure(cur)
    for (let i = 1; i < words.length; i++) {
      const test = `${cur} ${words[i]}`
      const len = measure(test)
      if (len <= maxW) { cur = test; widest = Math.max(widest, len) }
      else { out.push(cur); cur = words[i]; widest = Math.max(widest, measure(cur)) }
    }
    out.push(cur)
    return { out, widest }
  }
  let { out: lines, widest } = wrap()
  if (widest > maxW) {
    // Una parola singola più larga della casella: il corpo si riduce.
    fs = Math.max(1, fs * (maxW / widest))
    el.setAttribute('font-size', String(fs))
    lines = wrap().out
  }
  // Fit-in-box verticale (come layoutField): col corpo più piccolo il wrap può
  // produrre meno righe, quindi si itera (guardia a 6, converge prima).
  for (let i = 0; maxH > 0 && fs > 1 && lines.length * fs * LINE_HEIGHT_FRAC > maxH && i < 6; i++) {
    fs = Math.max(1, fs * (maxH / (lines.length * fs * LINE_HEIGHT_FRAC)))
    el.setAttribute('font-size', String(fs))
    lines = wrap().out
  }
  el.textContent = ''
  const lineH = fs * LINE_HEIGHT_FRAC
  lines.forEach((ln, i) => {
    const ts = document.createElementNS(SVG_NS, 'tspan')
    ts.setAttribute('x', x)
    ts.setAttribute('dy', i === 0 ? '0' : String(lineH))
    ts.textContent = ln
    el.appendChild(ts)
  })
  return lines.length
}

export let _drag = null
export function clientToSvg(svg, cx, cy) {
  const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy
  const m = svg.getScreenCTM()
  if (!m) return { x: 0, y: 0 }
  return pt.matrixTransform(m.inverse())
}
export function startDrag(e, field, svg, textEl, w, h, boxRectEl) {
  // In modalità disegno l'evento deve proseguire fino al canvas (onDrawStart):
  // si può così tracciare un campo anche sopra a uno esistente.
  if (_drawMode) return
  e.preventDefault(); e.stopPropagation()
  if (sel !== field.id) { setSel(field.id); renderFieldList(); renderFieldProps() }
  // Il drag può partire dal testo O dalla sua area di presa: si cattura il
  // puntatore sull'elemento che ha ricevuto l'evento, altrimenti i pointermove
  // finirebbero a un elemento che non li ascolta.
  const capEl = (e.currentTarget && e.currentTarget.setPointerCapture) ? e.currentTarget : textEl
  // Se il campo selezionato ha già la sua casella (d-sel-box) disegnata, la
  // seguiamo durante il drag (stessa traslazione del testo): altrimenti
  // resterebbe ferma finché il canvas non si ridisegna a fine trascinamento.
  const box = boxRectEl ? {
    el: boxRectEl,
    startX: parseFloat(boxRectEl.getAttribute('x')) || 0,
    startY: parseFloat(boxRectEl.getAttribute('y')) || 0,
  } : null
  _drag = { id: field.id, svg, textEl, w, h, capEl, box, startXpx: field.x * w, startYpx: field.y * h }
  try { capEl.setPointerCapture(e.pointerId) } catch { /* no capture */ }
  capEl.addEventListener('pointermove', onDrag)
  capEl.addEventListener('pointerup', endDrag)
}
export function onDrag(e) {
  if (!_drag) return
  const p = clientToSvg(_drag.svg, e.clientX, e.clientY)
  const fx = clamp01(p.x / _drag.w), fy = clamp01(p.y / _drag.h)
  const xPx = fx * _drag.w, yPx = fy * _drag.h
  _drag.textEl.setAttribute('x', String(xPx))
  _drag.textEl.setAttribute('y', String(yPx))
  // Il testo può essere spezzato in più <tspan> (wrapTextEl, anche su una sola
  // riga): ognuno porta la propria x ASSOLUTA fissata all'ultimo redraw, che
  // altrimenti sovrascrive quella del <text> padre — il campo si sposterebbe
  // visivamente solo in verticale, pur avendo la x aggiornata nello stato.
  for (const ts of _drag.textEl.childNodes) { if (ts.setAttribute) ts.setAttribute('x', String(xPx)) }
  if (_drag.box) {
    const dx = xPx - _drag.startXpx, dy = yPx - _drag.startYpx
    _drag.box.el.setAttribute('x', String(_drag.box.startX + dx))
    _drag.box.el.setAttribute('y', String(_drag.box.startY + dy))
  }
  updateField(_drag.id, { x: fx, y: fy })
  syncPositionInputs(fx, fy)
}
/** Aggiorna gli input numerici X/Y senza ridisegnare tutto il pannello (perderebbe il focus). */
export function syncPositionInputs(fx, fy) {
  const ix = document.getElementById('dPropX'), iy = document.getElementById('dPropY')
  if (ix) ix.value = (fx * 100).toFixed(1)
  if (iy) iy.value = (fy * 100).toFixed(1)
}
export function endDrag(e) {
  if (!_drag) return
  const el = _drag.capEl || _drag.textEl
  el.removeEventListener('pointermove', onDrag)
  el.removeEventListener('pointerup', endDrag)
  try { el.releasePointerCapture(e.pointerId) } catch { /* no capture */ }
  _drag = null
  renderFieldProps()
  redrawEditor()
}
