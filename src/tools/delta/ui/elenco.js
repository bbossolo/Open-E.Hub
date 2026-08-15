/* δ Pages — vista 3: import dell'elenco elaborati (CSV/Excel), verifica del
   foglio e dell'intestazione, sinonimi dell'azienda, mappatura campo→colonna. */
import { loadXLSX } from '../../../shared'
import { STANDARD_ELENCO_COLUMNS, STANDARD_FIELD_SET, detectFieldsFromLabels, detectHeaderRow, detectOrientation, exprTokens, mergeElencos, normalizeHeaderText, parseElenco, parseProjectMeta, scoreHeaderRow, suggestFieldColumn, transposeGrid } from '../engine'
import { renderCampi, updateField } from './campi.js'
import { esc, renderAll, toast, uid } from './shell.js'
import { S, _elencoSinonimi, elencoVerify, sel, setElencoVerify, setPreviewIndex, setSel } from './stato.js'
import { _labelCandidates } from './template.js'

/* ════════════════════ VISTA 3 — ELENCO ════════════════════ */
export let _projectMeta = {}   // metadati progetto (Committente/Oggetto/…) dall'ultimo import

/** Vero se il foglio è un frontespizio/metadati (non una tabella di elaborati):
 *  per nome noto o per confidenza tabellare molto bassa. */
export function isMetaSheet(s) {
  return /pagina\s*iniziale|frontespizio|copertina|intestazione/i.test(s.name) || s.confidence < 0.25
}
/** Estrae i metadati progetto dal foglio-frontespizio (il primo che sembra tale). */
export function extractProjectMeta(sheets) {
  const meta = sheets.find(s => /pagina\s*iniziale|frontespizio|copertina/i.test(s.name)) || sheets.find(isMetaSheet)
  return meta ? parseProjectMeta(meta.grid) : {}
}
/** Chiave di dedup robusta: righe-dati normalizzate (celle in coda vuote ignorate,
 *  righe interamente vuote scartate) — così copie identiche con differenze
 *  cosmetiche di colonne vuote vengono comunque riconosciute uguali. */
export function sheetDataKey(grid, headerRow) {
  const rows = []
  for (let i = headerRow + 1; i < grid.length; i++) {
    const cells = (grid[i] || []).map(c => String(c ?? '').trim())
    while (cells.length && cells[cells.length - 1] === '') cells.pop()
    if (cells.some(c => c !== '')) rows.push(cells.join('Open E.Hub'))
  }
  return rows.join('Open-E.Hub')
}
/** Applica i metadati progetto rilevati all'elenco corrente (se non vuoti). */
export function applyProjectMeta() {
  if (S.elenco && _projectMeta && Object.keys(_projectMeta).length) S.elenco.meta = { ..._projectMeta }
}

/* ── Dizionario sinonimi dell'elenco elaborati, per studio (locale) ──
   Insegna alias custom (es. "CMS" → CODICE_COMMESSA) SOLO per le colonne dell'elenco
   elaborati — mai per i campi del cartiglio (quelli restano il dizionario generico
   CARTIGLIO_LABELS). Scrittura riservata al titolare, come i Modelli dello studio. */
export const STANDARD_KEY_LABELS = {
  CODICE_COMMESSA: 'Codice commessa', FASE_PROGETTO: 'Fase progetto', DISCIPLINA: 'Disciplina',
  TIPO_ELABORATO: 'Tipo elaborato', ZONA: 'Edificio/zona/ambito', TIPO_IMPIANTO: 'Tipo impianto',
  PROGRESSIVO: 'Progressivo', REVISIONE: 'Revisione', CODICE_ELABORATO: 'Codice elaborato',
  TITOLO_CARTIGLIO: 'Titolo cartiglio', SCALA: 'Scala', DATA: 'Data', FORMATO: 'Formato', STATO: 'Stato',
}
/** Etichette (celle) della riga/colonna di intestazione che NON corrispondono a
 *  nessuna delle 14 chiavi standard né al dizionario per-studio già caricato —
 *  candidate per l'insegnamento nel pannello di verifica. */
export function unrecognizedHeaders(headerRow) {
  if (!Array.isArray(headerRow)) return []
  const seen = new Set()
  return headerRow.map(c => String(c ?? '').trim()).filter(Boolean).filter(cell => {
    const norm = normalizeHeaderText(cell)
    if (!norm || seen.has(norm)) return false
    seen.add(norm)
    if (_elencoSinonimi[norm]) return false
    return !Object.values(STANDARD_ELENCO_COLUMNS).some(syns => syns.includes(norm))
  })
}
/** Insegna (o disinsegna, standardKey='') un alias, per il resto della sessione. */
export function teachSinonimo(headerText, standardKey) {
  const norm = normalizeHeaderText(headerText)
  if (!norm) return
  if (standardKey) _elencoSinonimi[norm] = standardKey
  else delete _elencoSinonimi[norm]
  renderElencoVerify()
}

/** Griglia "di lavoro" di un foglio in verifica: trasposta se l'utente ha impostato
 *  (o il rilevamento ha scelto) l'orientamento a colonne — da qui in poi tutto (anteprima,
 *  parseElenco) tratta il foglio come se fosse sempre orientato per righe. */
export function workingGrid(sheet) {
  return sheet.orientation === 'columns' ? transposeGrid(sheet.grid) : sheet.grid
}

export function onElencoFile(file) {
  if (!file) return
  loadXLSX().then(() => {
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
        const names = wb.SheetNames
        const sheets = names.map(name => {
          const grid = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false })
          const guess = detectOrientation(grid, _elencoSinonimi)
          return { name, grid, orientation: guess.orientation, headerIndex: guess.headerIndex, confidence: guess.confidence, picked: false }
        })
        // Metadati di progetto dal foglio-frontespizio (PAGINA INIZIALE), se presente:
        // riconosciuto per nome o come primo foglio a bassa confidenza tabellare.
        _projectMeta = extractProjectMeta(sheets)
        // Foglio-metadati escluso dai dati (non è una tabella di elaborati).
        const dataSheets = sheets.filter(s => !isMetaSheet(s))
        const candidates = dataSheets.length ? dataSheets : sheets
        if (candidates.length === 1) {
          candidates[0].picked = true
        } else {
          // più fogli: pre-seleziona solo i fogli "riconosciuti" (confidenza ≥ 0.5) e
          // NON duplicati per contenuto (es. "E.E. ELETTRICO 1-3/2-3/3-3" ripetono la
          // stessa tabella: si preseleziona solo il primo, gli altri restano disponibili
          // ma spuntati fuori di default, per evitare di triplicare le righe).
          const seenContent = new Set()
          for (const s of candidates) {
            if (s.confidence < 0.5) continue
            const key = sheetDataKey(workingGrid(s), s.headerIndex)
            if (seenContent.has(key)) continue
            seenContent.add(key); s.picked = true
          }
        }
        // La verifica è SEMPRE mostrata (anche a foglio singolo): un import silenzioso
        // su un formato non censito può prendere la riga sbagliata come intestazione
        // senza che l'utente se ne accorga (vedi guida, capitolo «Importa l'elenco»).
        setElencoVerify({ fileName: file.name, sheets: candidates, focus: candidates[0] ? candidates[0].name : null })
        setPreviewIndex(0)
        renderAll()
      } catch (err) {
        toast(`Errore lettura elenco: ${err.message}`)
      }
    }
    reader.onerror = () => toast('Impossibile leggere il file')
    reader.readAsArrayBuffer(file)
  }).catch(() => toast('Lettore fogli non disponibile offline — serve xlsx in vendor/'))
}

export function focusVerifySheet(name) {
  if (!elencoVerify) return
  elencoVerify.focus = name
  renderElencoVerify()
}
export function toggleVerifySheetPick(name) {
  if (!elencoVerify) return
  const s = elencoVerify.sheets.find(x => x.name === name)
  if (s) s.picked = !s.picked
  renderElencoVerify()
}
/** Cambia l'orientamento del foglio a fuoco: ricalcola riga/confidenza di default per
 *  il nuovo orientamento (l'utente può comunque poi scegliere un'altra riga a mano). */
export function setVerifyOrientation(orientation) {
  if (!elencoVerify) return
  const s = elencoVerify.sheets.find(x => x.name === elencoVerify.focus)
  if (!s || s.orientation === orientation) return
  s.orientation = orientation
  const wg = workingGrid(s)
  s.headerIndex = detectHeaderRow(wg, _elencoSinonimi)
  s.confidence = scoreHeaderRow(wg[s.headerIndex], _elencoSinonimi)
  renderElencoVerify()
}
/** L'utente clicca direttamente la riga giusta nell'anteprima (più diretto di un select). */
export function setVerifyHeaderIndex(idx) {
  if (!elencoVerify) return
  const s = elencoVerify.sheets.find(x => x.name === elencoVerify.focus)
  if (!s) return
  s.headerIndex = idx
  s.confidence = scoreHeaderRow(workingGrid(s)[idx], _elencoSinonimi)
  renderElencoVerify()
}
export function confirmElencoVerify() {
  if (!elencoVerify) return
  const chosen = elencoVerify.sheets.filter(s => s.picked)
  if (!chosen.length) { toast('Seleziona almeno un foglio.'); return }
  if (chosen.length === 1) {
    const s = chosen[0]
    S.elenco = parseElenco(workingGrid(s), elencoVerify.fileName, s.headerIndex)
  } else {
    const entries = chosen.map(s => ({ name: s.name, elenco: parseElenco(workingGrid(s), elencoVerify.fileName, s.headerIndex) }))
    S.elenco = mergeElencos(entries, elencoVerify.fileName)
  }
  applyProjectMeta()
  if (!S.elenco.rows.length) toast('Elenco vuoto: nessuna riga dati trovata.')
  else toast(`Elenco importato: ${S.elenco.rows.length} elaborati, ${S.elenco.headers.length} colonne.`)
  setElencoVerify(null)
  autoMapFields()
  setPreviewIndex(0)
  renderAll()
}
export function cancelElencoVerify() {
  setElencoVerify(null)
  renderAll()
}

/** Suggerisce (senza mai sovrascrivere) la colonna dei campi variabili non ancora mappati. */
export function autoMapFields() {
  if (!S.elenco) return
  let n = 0
  for (const f of S.fields) {
    if (f.kind !== 'variable' || f.column) continue
    const col = suggestFieldColumn(f.label, S.elenco.headers)
    if (col) { f.column = col; n++ }
  }
  if (n) toast(`${n} campo/i mappato/i automaticamente in base al nome.`)
}

/** Auto-detect: crea un campo per ogni cella riconosciuta dalle etichette del
 *  cartiglio (già posizionato + sorgente pre-assegnata). Se il template non ha
 *  strato-testo (immagine o PDF senza testo), ricade sul set impilato. */
export function detectCampi() {
  if (!S.template) { toast('Carica prima un template.'); return }
  if (!_labelCandidates.length) {
    toast('Nessuna etichetta rilevata nel template (immagine o PDF senza testo): aggiungo i campi standard impilati.')
    addStandardFields()
    return
  }
  const detected = detectFieldsFromLabels(_labelCandidates)
  if (!detected.length) {
    toast('Nessuna cella del cartiglio riconosciuta: uso i campi standard impilati.')
    addStandardFields()
    return
  }
  // Evita doppioni se si preme più volte: rimpiazza i campi con la stessa etichetta.
  const labelsNew = new Set(detected.map(f => f.label))
  S.fields = S.fields.filter(f => !labelsNew.has(f.label)).concat(detected)
  setSel(detected[0].id)
  toast(`${detected.length} campi rilevati dal cartiglio e posizionati. Rifinisci col trascinamento.`)
  renderCampi()
}

export function addStandardFields() {
  if (!S.template) { toast('Carica prima un template.'); return }
  const start = S.fields.length
  STANDARD_FIELD_SET.forEach((label, i) => {
    const column = S.elenco ? suggestFieldColumn(label, S.elenco.headers) : null
    S.fields.push({
      id: uid(), kind: 'variable', label,
      x: 0.08, y: 0.06 + Math.min(0.88, (start + i) * 0.05),
      anchor: 'ml', align: 'left', fontFrac: 0.025, bold: false,
      column: column || undefined,
    })
  })
  setSel(S.fields[start] ? S.fields[start].id : sel)
  toast(`${STANDARD_FIELD_SET.length} campi standard aggiunti: trascinali sopra il cartiglio.`)
  renderCampi()
}

export function clearElenco() {
  S.elenco = null; setPreviewIndex(0); setElencoVerify(null)
  renderAll()
}

export function renderElenco() {
  const verify = document.getElementById('dElencoVerify')
  const info = document.getElementById('dElencoInfo')
  const clr = document.getElementById('dBtnElencoClear')
  const mapBlock = document.getElementById('dMappingBlock')
  const prev = document.getElementById('dElencoPreview')
  if (elencoVerify) {
    verify.hidden = false
    info.hidden = true; clr.hidden = true; mapBlock.hidden = true; prev.hidden = true
    renderElencoVerify()
    return
  }
  verify.hidden = true
  if (!S.elenco) {
    info.hidden = true; clr.hidden = true; mapBlock.hidden = true; prev.hidden = true
    return
  }
  const e = S.elenco
  info.hidden = false; clr.hidden = false
  const src = e.sheetName ? ` · da: ${esc(e.sheetName)}` : ''
  info.innerHTML = `<b>${esc(e.fileName)}</b> · ${e.rows.length} elaborati · ${e.headers.length} colonne${src}`
  renderMapping()
  mapBlock.hidden = false
  // anteprima tabella (prime 8 righe)
  prev.hidden = false
  const head = `<tr>${e.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`
  const body = e.rows.slice(0, 8).map(r => `<tr>${e.headers.map(h => `<td>${esc(r[h] || '')}</td>`).join('')}</tr>`).join('')
  const more = e.rows.length > 8 ? `<p class="d-hint">…e altre ${e.rows.length - 8} righe.</p>` : ''
  prev.innerHTML = `<div class="d-table-scroll"><table class="ehb-table d-table">${head}${body}</table></div>${more}`
}

/** Pannello di verifica import — SEMPRE mostrato (anche a foglio singolo): lista fogli
 *  (solo se >1) + orientamento + anteprima con la riga di intestazione cliccabile. */
export function renderElencoVerify() {
  const listWrap = document.getElementById('dVerifySheetList')
  const title = document.getElementById('dVerifyTitle')
  if (!elencoVerify) return
  const multi = elencoVerify.sheets.length > 1
  title.textContent = multi ? 'Verifica intestazione — quali fogli e da dove' : 'Verifica intestazione'
  listWrap.hidden = !multi
  if (multi) renderVerifySheetList(listWrap)
  const focus = elencoVerify.sheets.find(s => s.name === elencoVerify.focus) || elencoVerify.sheets[0]
  if (!focus) return
  document.querySelectorAll('#dVerifyOrientation .d-seg-btn').forEach(btn => btn.classList.toggle('is-sel', btn.dataset.orientation === focus.orientation))
  const badge = document.getElementById('dVerifyConfidence')
  const ok = focus.confidence >= 0.5
  badge.textContent = ok ? '✓ intestazione riconosciuta' : '⚠ da verificare — clicca la riga giusta qui sotto'
  badge.className = 'd-confidence-badge' + (ok ? ' is-ok' : ' is-warn')
  renderVerifyPreview(focus)
  renderVerifyUnknowns(focus)
}

/** Colonne dell'intestazione a fuoco non riconosciute: propone di assegnarle a una
 *  delle 14 chiavi standard (vale per la sessione corrente). */
export function renderVerifyUnknowns(sheet) {
  const host = document.getElementById('dVerifyUnknowns')
  if (!host) return
  const headerRow = workingGrid(sheet)[sheet.headerIndex]
  const unknowns = unrecognizedHeaders(headerRow)
  if (!unknowns.length) { host.hidden = true; host.replaceChildren(); return }
  host.hidden = false
  host.replaceChildren()
  const cap = document.createElement('p'); cap.className = 'd-hint'
  cap.textContent = `${unknowns.length} colonna/e non riconosciuta/e — assegnale a una delle 14 chiavi standard, se corrispondono (le codifiche specifiche della commessa, es. fase/lotto/comparto, non vanno assegnate: restano mappabili a mano nel passo successivo).`
  host.appendChild(cap)
  for (const header of unknowns) {
    const row = document.createElement('div'); row.className = 'd-map-row'
    const lab = document.createElement('span'); lab.className = 'd-field-name'; lab.textContent = header
    const sel = document.createElement('select')
    sel.innerHTML = '<option value="">— non è nessuna delle 14 —</option>' +
      Object.keys(STANDARD_ELENCO_COLUMNS).map(k => `<option value="${k}">${STANDARD_KEY_LABELS[k] || k}</option>`).join('')
    row.append(lab, sel)
    sel.addEventListener('change', () => teachSinonimo(header, sel.value))
    host.appendChild(row)
  }
}

export function renderVerifySheetList(host) {
  host.replaceChildren()
  for (const s of elencoVerify.sheets) {
    const row = document.createElement('label')
    row.className = 'd-sheet-row' + (s.confidence >= 0.5 ? '' : ' d-sheet-row--low') + (s.name === elencoVerify.focus ? ' is-focus' : '')
    const cb = document.createElement('input')
    cb.type = 'checkbox'; cb.checked = s.picked
    cb.addEventListener('click', e => e.stopPropagation())
    cb.addEventListener('change', () => toggleVerifySheetPick(s.name))
    const name = document.createElement('span'); name.className = 'd-field-name'; name.textContent = s.name
    const meta = document.createElement('span'); meta.className = 'd-hint'
    meta.textContent = s.confidence >= 0.5
      ? `intestazione su ${s.orientation === 'columns' ? 'colonne' : 'righe'}, indice ${s.headerIndex + 1}`
      : 'non riconosciuto — verifica'
    row.append(cb, name, meta)
    row.addEventListener('click', () => focusVerifySheet(s.name))
    host.appendChild(row)
  }
}

/** Anteprima (prime 12 righe di lavoro, prime 10 colonne) con la riga di intestazione
 *  evidenziata e cliccabile per cambiarla — niente select separato, si clicca sui dati. */
export function renderVerifyPreview(sheet) {
  const host = document.getElementById('dVerifyPreview')
  const wg = workingGrid(sheet)
  const rows = wg.slice(0, 12)
  let html = '<table class="ehb-table d-table d-verify-table"><tbody>'
  rows.forEach((row, i) => {
    const isHeader = i === sheet.headerIndex
    html += `<tr class="d-verify-row${isHeader ? ' is-header' : ''}" data-idx="${i}" title="Clicca per usare questa riga come intestazione">`
    html += `<td class="d-verify-idx">${i + 1}</td>`
    ;(Array.isArray(row) ? row.slice(0, 10) : []).forEach(cell => { html += `<td>${esc(String(cell ?? ''))}</td>` })
    html += '</tr>'
  })
  html += '</tbody></table>'
  host.innerHTML = html
  host.querySelectorAll('.d-verify-row').forEach(tr => tr.addEventListener('click', () => setVerifyHeaderIndex(Number(tr.dataset.idx))))
}

export function renderMapping() {
  const host = document.getElementById('dMappingList')
  host.replaceChildren()
  const vars = S.fields.filter(f => f.kind === 'variable')
  if (!vars.length) {
    const p = document.createElement('p'); p.className = 'd-hint'
    p.textContent = 'Nessun campo variabile: aggiungine nel passo 2 per collegarli alle colonne.'
    host.appendChild(p); return
  }
  for (const f of vars) {
    const row = document.createElement('div')
    row.className = 'd-map-row'
    const lab = document.createElement('span'); lab.className = 'd-field-name'; lab.textContent = f.label
    // Campo con espressione: mostra l'espressione (sola lettura qui) — si modifica
    // nel pannello proprietà del passo 2, non c'è una singola colonna da scegliere.
    if (typeof f.expr === 'string') {
      const ex = document.createElement('code'); ex.className = 'd-map-expr'; ex.textContent = f.expr || '—'
      const orphans = exprTokens(f.expr).filter(t => !t.startsWith('@') && !S.elenco.headers.includes(t))
      if (orphans.length) { ex.classList.add('is-orphan'); ex.title = `Colonne non nell'elenco: ${orphans.join(', ')}` }
      row.append(lab, ex)
      host.appendChild(row)
      continue
    }
    const orphan = f.column && !S.elenco.headers.includes(f.column)
    const selEl = document.createElement('select')
    selEl.innerHTML = `<option value="">— nessuna —</option>` +
      S.elenco.headers.map(h => `<option value="${esc(h)}"${f.column === h ? ' selected' : ''}>${esc(h)}</option>`).join('') +
      (orphan ? `<option value="${esc(f.column)}" selected>${esc(f.column)} (mancante)</option>` : '')
    selEl.addEventListener('change', () => { updateField(f.id, { column: selEl.value || undefined }); renderMapping() })
    row.append(lab, selEl)
    if (!f.column) {
      const auto = document.createElement('button')
      auto.type = 'button'; auto.className = 'ehb-icon-btn'; auto.title = 'Suggerisci colonna da nome campo'
      auto.textContent = '✨'
      auto.onclick = () => {
        const col = suggestFieldColumn(f.label, S.elenco.headers)
        if (col) { updateField(f.id, { column: col }); renderMapping() }
        else toast('Nessuna colonna corrispondente trovata per questa etichetta.')
      }
      row.appendChild(auto)
    }
    host.appendChild(row)
  }
}

export const dVerifyOrientationBox = document.getElementById('dVerifyOrientation')
if (dVerifyOrientationBox) {
  dVerifyOrientationBox.querySelectorAll('.d-seg-btn').forEach(btn =>
    btn.addEventListener('click', () => setVerifyOrientation(btn.dataset.orientation)))
}

export function detectColumnsNow() {
  if (!S.elenco) return
  autoMapFields()
  renderMapping()
}
