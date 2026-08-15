/* δ Pages — editor dei campi (canvas + lista + pannello proprietà), integrato
   nella vista Template unificata. */
import { exprTokens, resolveCover, simpleExprParts } from '../engine'
import { drawCover, syncPositionInputs } from './disegno.js'
import { alignFromAnchor, clamp01, esc, insertAtCursor, uid, updateRailProgress } from './shell.js'
import { S, sel, setSel, view } from './stato.js'

/* Formati pronti: al posto dei filtri `|fn` scritti a mano, l'utente
   sceglie da pulsanti. `fn: undefined` = «Come nel file» (nessun filtro). */
/* Nomi di colonna reali (CSV/Excel) possono contenere caratteri della sintassi
   dei token ({ } |) o iniziare per @ (metadato). Componendoli dentro `{col}` /
   `{col|fn}` senza controllo, resolveExpr li interpreta male (es. una colonna
   "Tavola N. | Rev." produce `{Tavola N. | Rev.}`, letto come colonna
   "Tavola N." con filtro " Rev." → testo vuoto, corruzione silenziosa). Per
   queste colonne si resta sulla modalità "colonna semplice" (f.column), che
   non passa da resolveExpr/sintassi. */
const hasSyntaxChars = col => /[{}|]/.test(col) || col.startsWith('@')

const FORMAT_OPTIONS = [
  { fn: undefined, label: 'Come nel file' },
  { fn: 'upper', label: 'MAIUSCOLO' },
  { fn: 'tail', label: "Solo l'ultima parte" },
  { fn: 'head', label: 'Solo la prima parte' },
  { fn: 'meseanno', label: 'Mese e anno' },
  { fn: 'stato', label: 'Stato per esteso' },
]

/* ════════════ Editor dei campi — workbench dentro la vista Template ════════════ */
export function renderCampi() {
  updateRailProgress()
  const hint = document.getElementById('dCanvasEmptyHint')
  if (hint) hint.hidden = !!S.template
  renderFieldList()
  renderFieldProps()
  drawCover(document.getElementById('dEditorCanvas'), resolveCover(S, -1), true)
}

export function addField(kind) {
  const n = S.fields.filter(f => f.kind === kind).length + 1
  const f = {
    id: uid(), kind,
    label: kind === 'fixed' ? `Campo fisso ${n}` : `Campo variabile ${n}`,
    x: 0.5, y: 0.2 + Math.min(0.6, S.fields.length * 0.06),
    anchor: 'mc', align: 'center', fontFrac: 0.03, bold: false,
    value: kind === 'fixed' ? '' : undefined,
    column: kind === 'variable' ? undefined : undefined,
  }
  S.fields.push(f)
  setSel(f.id)
  renderCampi()
}
export function removeField(id) {
  S.fields = S.fields.filter(f => f.id !== id)
  if (sel === id) setSel(null)
  renderCampi()
}
export function selectField(id) {
  setSel(id)
  renderFieldList(); renderFieldProps()
  drawCover(document.getElementById('dEditorCanvas'), resolveCover(S, -1), true)
}
export function updateField(id, patch) {
  const f = S.fields.find(x => x.id === id); if (!f) return
  Object.assign(f, patch)
  if ('anchor' in patch) f.align = alignFromAnchor(f.anchor)
}
export function duplicateField(id) {
  const f = S.fields.find(x => x.id === id); if (!f) return
  const copy = { ...f, id: uid(), label: f.label + ' (copia)', x: clamp01(f.x + 0.02), y: clamp01(f.y + 0.02) }
  const idx = S.fields.indexOf(f)
  S.fields.splice(idx + 1, 0, copy)
  setSel(copy.id)
  renderCampi()
}

export function renderFieldList() {
  const host = document.getElementById('dFieldList')
  host.replaceChildren()
  if (!S.fields.length) {
    const p = document.createElement('p'); p.className = 'd-hint'; p.textContent = 'Nessun campo. Aggiungine uno.'
    host.appendChild(p); return
  }
  for (const f of S.fields) {
    const row = document.createElement('div')
    row.className = 'd-field-row' + (f.id === sel ? ' is-sel' : '')
    row.onclick = () => selectField(f.id)
    const tag = document.createElement('span')
    tag.className = 'd-field-tag d-field-tag--' + f.kind
    tag.textContent = f.kind === 'fixed' ? 'FISSO' : 'VAR'
    const lab = document.createElement('span')
    lab.className = 'd-field-name'; lab.textContent = f.label
    // Campo orfano: colonna referenziata (via f.column semplice o via token
    // dentro f.expr) che non esiste (più) nell'elenco importato. Riusa lo
    // stesso criterio di ui/elenco.js (exprTokens) così l'avviso si accende
    // anche per i campi con un formato applicato (che compongono f.expr).
    const missingCols = S.elenco
      ? (typeof f.expr === 'string'
        ? exprTokens(f.expr).filter(t => !t.startsWith('@') && !S.elenco.headers.includes(t))
        : (f.column && !S.elenco.headers.includes(f.column) ? [f.column] : []))
      : []
    const orphan = f.kind === 'variable' && missingCols.length > 0
    if (orphan) {
      const warn = document.createElement('span')
      warn.className = 'd-field-warn'; warn.textContent = '⚠'; warn.title = `Colonna «${missingCols.join(', ')}» non trovata nell'elenco importato`
      lab.appendChild(warn)
    }
    const dup = document.createElement('button')
    dup.className = 'ehb-icon-btn'; dup.textContent = '⧉'; dup.title = 'Duplica campo'
    dup.onclick = e => { e.stopPropagation(); duplicateField(f.id) }
    const del = document.createElement('button')
    del.className = 'ehb-icon-btn'; del.textContent = '✕'; del.title = 'Elimina campo'
    del.onclick = e => { e.stopPropagation(); removeField(f.id) }
    row.append(tag, lab, dup, del)
    host.appendChild(row)
  }
}

export function renderFieldProps() {
  const box = document.getElementById('dFieldProps')
  const empty = document.getElementById('dFieldPropsEmpty')
  const f = S.fields.find(x => x.id === sel)
  if (!f) { box.hidden = true; empty.hidden = false; return }
  box.hidden = false; empty.hidden = true
  const cols = S.elenco ? S.elenco.headers : []
  const anchorGrid = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']
    .map(a => `<button type="button" class="d-anchor${f.anchor === a ? ' is-sel' : ''}" data-anchor="${a}" title="${a}"></button>`).join('')
  // Sorgente/Formato SENZA sintassi: l'utente sceglie colonna+formato
  // da menu/pulsanti; internamente si compone f.expr = "{Colonna}" oppure
  // "{Colonna|filtro}" (mai mostrato come testo). Un'espressione esistente che
  // il motore non riconosce come "semplice" (composizione, testo letterale,
  // argomento custom) resta intatta in un pannello Avanzate, così i cartigli
  // già in corso non perdono dati.
  // Colonne il cui nome contiene sintassi di espressione ({ } |) o inizia per @
  // non possono essere incapsulate in un token senza ambiguità (v. composeExpr
  // più sotto): restano in f.column "semplice" anche quando è attivo un formato
  // nell'interfaccia, quindi qui vanno riconosciute a parte per non farle apparire
  // come "Avanzate".
  const currentExpr = typeof f.expr === 'string' ? f.expr : (f.column ? `{${f.column}}` : '')
  const simple = (f.column && !f.expr && hasSyntaxChars(f.column))
    ? { col: f.column, fn: undefined }
    : (currentExpr ? simpleExprParts(currentExpr) : { col: '', fn: undefined })
  const isAdvanced = !!currentExpr && !simple
  const selectedCol = simple ? simple.col : ''
  const selectedFn = simple ? simple.fn : undefined
  const orphanTokens = currentExpr && S.elenco
    ? exprTokens(currentExpr).filter(t => !t.startsWith('@') && !S.elenco.headers.includes(t))
    : []
  const colChips = cols.length
    ? `<div class="d-chip-row">${cols.map(c => `<button type="button" class="d-chip" data-token="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
    : ''
  let sourceHTML
  if (f.kind === 'fixed') {
    sourceHTML = `<label class="d-prop"><span>Testo</span><textarea id="dPropValue" rows="2" placeholder="Testo fisso">${esc(f.value || '')}</textarea></label>`
  } else {
    const colOptions = cols.slice()
    if (selectedCol && !colOptions.includes(selectedCol)) colOptions.push(selectedCol)
    const sourceSelect = `<label class="d-prop"><span>Sorgente</span><select id="dPropSource">
         <option value="">— nessuna —</option>
         ${colOptions.map(c => `<option value="${esc(c)}"${selectedCol === c ? ' selected' : ''}>${esc(c)}${c === selectedCol && !cols.includes(c) ? ' (mancante)' : ''}</option>`).join('')}
       </select>${cols.length ? '' : '<small class="d-hint">Importa un elenco (passo 2) per scegliere la colonna.</small>'}</label>`
    const formatChips = `<div class="d-prop"><span>Formato</span><div class="d-chip-row">
        ${FORMAT_OPTIONS.map(o => `<button type="button" class="d-chip${selectedFn === o.fn ? ' is-sel' : ''}" data-fmt="${o.fn || ''}">${esc(o.label)}</button>`).join('')}
      </div></div>`
    const advancedBody = `<details class="d-advanced">
       <summary>Avanzate${isAdvanced ? ' — espressione personalizzata' : ''}</summary>
       <div class="d-prop"><span>Espressione</span>
         <textarea id="dPropExpr" rows="2" placeholder="{CODICE ELABORATO|tail}  oppure  {FASE PROGETTO}-{Disciplina}">${esc(currentExpr)}</textarea>
         ${colChips}
         <small class="d-hint">Token: <code>{Colonna}</code>, <code>{@Committente}</code>. Funzioni: <code>|tail</code> (coda dopo «_»), <code>|head</code>, <code>|meseanno</code>, <code>|stato</code> (E→ESECUTIVO), <code>|upper</code>.</small>
       </div>
     </details>`
    sourceHTML = sourceSelect + formatChips +
      (orphanTokens.length ? `<small class="d-field-warn-line">⚠ colonne non nell'elenco: ${orphanTokens.map(esc).join(', ')}</small>` : '') +
      advancedBody
  }
  const wrapPct = f.maxWidthFrac ? (f.maxWidthFrac * 100).toFixed(0) : ''
  const wrapHPct = f.maxHeightFrac ? (f.maxHeightFrac * 100).toFixed(0) : ''
  // Tipo di campo: SEMPRE convertibile, non solo alla creazione — posizione,
  // ancoraggio, dimensione e larghezza casella restano invariati, cambia solo
  // da dove il testo prende il suo valore (fisso vs sorgente dell'elenco).
  const kindToggle = `<div class="d-prop"><span>Tipo di campo</span><div class="d-seg">
      <button type="button" class="d-seg-btn${f.kind === 'fixed' ? ' is-sel' : ''}" data-kind="fixed">Fisso</button>
      <button type="button" class="d-seg-btn${f.kind === 'variable' ? ' is-sel' : ''}" data-kind="variable">Variabile</button>
    </div></div>`
  box.innerHTML = `
    <div class="d-panel-hd"><h3 class="d-h3">${f.kind === 'fixed' ? 'Campo fisso' : 'Campo variabile'}</h3></div>
    ${kindToggle}
    <label class="d-prop"><span>Etichetta</span><input id="dPropLabel" type="text" value="${esc(f.label)}"></label>
    ${sourceHTML}
    <div class="d-prop">
      <span>Posizione (%)</span>
      <div class="d-xy-row">
        <input id="dPropX" type="number" min="0" max="100" step="0.1" value="${(f.x * 100).toFixed(1)}" title="Posizione orizzontale">
        <input id="dPropY" type="number" min="0" max="100" step="0.1" value="${(f.y * 100).toFixed(1)}" title="Posizione verticale">
      </div>
      <small class="d-hint">Oppure trascina sul template — frecce per spostamenti fini (Shift = passo largo).</small>
    </div>
    <label class="d-prop"><span>Dimensione testo</span><input id="dPropFont" type="range" min="1" max="12" step="0.5" value="${(f.fontFrac * 100).toFixed(1)}"><small class="d-hint" id="dPropFontVal">${(f.fontFrac * 100).toFixed(1)}% dell'altezza</small></label>
    <div class="d-prop">
      <span>Casella (%)</span>
      <div class="d-xy-row">
        <input id="dPropWrap" type="number" min="0" max="100" step="1" value="${wrapPct}" placeholder="auto" title="Larghezza della CASELLA di testo (% pagina): decide dove il testo va a capo — anche più stretta del testo. Vuoto o 0 = automatica (dal campo al bordo pagina).">
        <input id="dPropWrapH" type="number" min="0" max="100" step="1" value="${wrapHPct}" placeholder="auto" title="Altezza della CASELLA (% pagina): se il testo non ci sta, il corpo si riduce automaticamente per starci. Vuoto o 0 = altezza libera.">
      </div>
      <small class="d-hint">Larghezza × altezza dell'area di testo: il testo va a capo entro la larghezza e si riduce se sfora l'altezza. Trascina l'angolo ⤡ della casella sul template; doppio clic sulla casella = torna automatica.</small>
    </div>
    <label class="d-prop d-prop--row"><input id="dPropBold" type="checkbox"${f.bold ? ' checked' : ''}> <span>Grassetto</span></label>
    <div class="d-prop"><span>Ancoraggio</span><div class="d-anchor-grid">${anchorGrid}</div></div>
  `
  box.querySelectorAll('.d-panel-hd + .d-prop .d-seg-btn').forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.kind
    if (kind === f.kind) return
    const patch = { kind }
    if (kind === 'fixed' && f.value === undefined) patch.value = ''
    updateField(f.id, patch)
    renderFieldList(); renderFieldProps(); redrawEditor()
  }))
  box.querySelector('#dPropLabel').addEventListener('input', e => { updateField(f.id, { label: e.target.value }); renderFieldList(); redrawEditor() })
  box.querySelector('#dPropX').addEventListener('input', e => { updateField(f.id, { x: clamp01(Number(e.target.value) / 100) }); redrawEditor() })
  box.querySelector('#dPropY').addEventListener('input', e => { updateField(f.id, { y: clamp01(Number(e.target.value) / 100) }); redrawEditor() })
  box.querySelector('#dPropWrap').addEventListener('input', e => {
    const pct = Number(e.target.value)
    updateField(f.id, { maxWidthFrac: pct > 0 ? clamp01(pct / 100) : undefined })
    redrawEditor()
  })
  box.querySelector('#dPropWrapH').addEventListener('input', e => {
    const pct = Number(e.target.value)
    updateField(f.id, { maxHeightFrac: pct > 0 ? clamp01(pct / 100) : undefined })
    redrawEditor()
  })
  if (f.kind === 'fixed') {
    box.querySelector('#dPropValue').addEventListener('input', e => { updateField(f.id, { value: e.target.value }); redrawEditor() })
  } else {
    // Compone f.expr da colonna+formato scelti dai controlli — mai testo libero.
    // Colonne con sintassi di espressione nel nome: niente token, si resta su
    // f.column semplice (il formato scelto viene ignorato in quel caso).
    const composeExpr = (col, fn) => (col ? (fn ? `{${col}|${fn}}` : `{${col}}`) : undefined)
    const applySource = (col, fn) => (col && hasSyntaxChars(col))
      ? { expr: undefined, column: col }
      : { expr: composeExpr(col, fn), column: undefined }
    const srcSel = box.querySelector('#dPropSource')
    if (srcSel) srcSel.addEventListener('change', e => {
      updateField(f.id, applySource(e.target.value, selectedFn))
      renderFieldProps(); redrawEditor()
    })
    box.querySelectorAll('.d-chip[data-fmt]').forEach(chip => chip.addEventListener('click', () => {
      const fn = chip.dataset.fmt || undefined
      updateField(f.id, applySource(selectedCol, fn))
      renderFieldProps(); redrawEditor()
    }))
    const exprTa = box.querySelector('#dPropExpr')
    if (exprTa) {
      exprTa.addEventListener('input', e => { updateField(f.id, { expr: e.target.value, column: undefined }); redrawEditor() })
      box.querySelectorAll('.d-chip[data-token]').forEach(chip => chip.addEventListener('click', () => {
        insertAtCursor(exprTa, `{${chip.dataset.token}}`)
        updateField(f.id, { expr: exprTa.value, column: undefined }); redrawEditor()
      }))
    }
  }
  box.querySelector('#dPropFont').addEventListener('input', e => {
    const frac = Number(e.target.value) / 100
    updateField(f.id, { fontFrac: frac })
    box.querySelector('#dPropFontVal').textContent = `${(frac * 100).toFixed(1)}% dell'altezza`
    redrawEditor()
  })
  box.querySelector('#dPropBold').addEventListener('change', e => { updateField(f.id, { bold: e.target.checked }); redrawEditor() })
  box.querySelectorAll('.d-anchor').forEach(btn => btn.addEventListener('click', () => {
    updateField(f.id, { anchor: btn.dataset.anchor })
    renderFieldProps(); redrawEditor()
  }))
}

export function redrawEditor() {
  drawCover(document.getElementById('dEditorCanvas'), resolveCover(S, -1), true)
}

/** Nudge da tastiera del campo selezionato (frecce = passo fine, Shift+freccia
 *  = passo largo) — utile per allineamenti precisi su celle piccole del
 *  cartiglio, dove il drag col mouse da solo è impreciso. Ignora l'input se
 *  il focus è su un campo di testo (label/valore/select), per non rubare le
 *  frecce alla digitazione. */
export function onCampiKeydown(e) {
  if (view !== 'template' || !sel) return
  const tag = (e.target && e.target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  // Canc/Backspace elimina il campo selezionato.
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeField(sel); return }
  const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const d = deltas[e.key]
  if (!d) return
  e.preventDefault()
  const step = e.shiftKey ? 0.01 : 0.002
  const f = S.fields.find(x => x.id === sel); if (!f) return
  const fx = clamp01(f.x + d[0] * step), fy = clamp01(f.y + d[1] * step)
  updateField(sel, { x: fx, y: fy })
  syncPositionInputs(fx, fy)
  redrawEditor()
}
document.addEventListener('keydown', onCampiKeydown)
