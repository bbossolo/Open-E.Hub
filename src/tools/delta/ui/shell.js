/* δ Pages — cornice: tema, toast, utility, navigazione fra le tre viste
   (Template · Elenco · Genera — Template include l'editor dei campi)
   e binario di avanzamento. */
import { sendToHub } from '../../../shared'
import { closeGuide as closeGuideShared, toggleGuide, viewEnter } from '../../../shared/ui/components'
import { startTour } from '../../../shared/ui/components/tour'
import { DELTA_TOUR } from '../data/tour'
import { redrawEditor, renderCampi, renderFieldList } from './campi.js'
import { renderElenco } from './elenco.js'
import { renderGenera } from './genera.js'
import { S, setView, view } from './stato.js'
import { renderTemplate, renderTemplatePreview } from './template.js'

/* ── Tema (default LIGHT, con override locale per-tool) ── */
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  const b = document.getElementById('btnTheme')
  if (b) b.textContent = (t === 'dark') ? '☀' : '☾'
}
export function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  sendToHub({ type: 'app:theme', theme: next })
}

/* ── Helper ── */
export let _toastT
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast'); if (!el) return
  el.textContent = msg; el.hidden = false
  clearTimeout(_toastT); _toastT = setTimeout(() => { el.hidden = true }, ms)
}
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const uid = () => 'f' + Math.random().toString(36).slice(2, 9)
export const clamp01 = n => Math.max(0, Math.min(1, Number(n) || 0))
export const SVG_NS = 'http://www.w3.org/2000/svg'
/** Inserisce `text` alla posizione del cursore in una textarea/input (o in coda). */
export function insertAtCursor(el, text) {
  const s = el.selectionStart ?? el.value.length
  const e = el.selectionEnd ?? el.value.length
  el.value = el.value.slice(0, s) + text + el.value.slice(e)
  const pos = s + text.length
  el.focus(); try { el.setSelectionRange(pos, pos) } catch { /* no-op */ }
}
/** align derivato dall'ancoraggio orizzontale (MVP: testo single-line). */
export const alignFromAnchor = a => (a[1] === 'l' ? 'left' : a[1] === 'r' ? 'right' : 'center')

/* ── Viste ── */
export function showView(name) {
  setView(name)
  let shown = null
  for (const v of ['template', 'elenco', 'genera']) {
    const cap = v[0].toUpperCase() + v.slice(1)
    const section = document.getElementById('view' + cap)
    section.hidden = v !== name
    if (v === name) shown = section
    const step = document.getElementById('dTab' + cap)
    if (step) step.classList.toggle('active', v === name)
  }
  if (name === 'template') renderCampi()
  if (name === 'elenco') renderElenco()
  if (name === 'genera') renderGenera()
  updateRailProgress()
  // La vista appena montata entra con una transizione.
  viewEnter(shown)
}

export function renderAll() {
  renderTemplate()
  if (view === 'template') renderCampi()
  if (view === 'elenco') renderElenco()
  if (view === 'genera') renderGenera()
  updateRailProgress()
}

/** Segna nel binario di flusso i passi già completati (spunta ✓ al posto del
 *  numero): guida l'utente mostrando a colpo d'occhio cosa manca, non solo dov'è —
 *  Template appena c'è un template caricato (e almeno un campo), Elenco appena
 *  importato. Genera resta senza spunta: è il traguardo, non un requisito. */
export function updateRailProgress() {
  const tmpl = document.getElementById('dTabTemplate')
  const elenco = document.getElementById('dTabElenco')
  if (tmpl) tmpl.classList.toggle('is-done', !!S.template && S.fields.length > 0)
  if (elenco) elenco.classList.toggle('is-done', !!S.elenco)
}

/** Alterna la vista Template fra Home (scelta/caricamento template + libreria)
 *  ed Editor (canvas + lista campi + proprietà), stesso passo del binario —
 *  i dati sono sempre in S.fields/S.template, qui si cambia solo cosa si vede.
 *  All'apertura ridisegna canvas e lista campi: nulla da sincronizzare, solo
 *  da ridisegnare con lo stato corrente. Le azioni sui campi (Rileva/Fisso/
 *  Variabile/Disegna/Standard) esistono SOLO nell'Editor — creano/modificano
 *  campi, non hanno senso in Home — e vanno quindi nascoste, non solo
 *  disabilitate. «Editor campi»/«Applica e continua» restano invece sempre
 *  nello stesso punto: sono le uniche azioni valide anche in Home. */
export function setTemplateMode(mode) {
  const home = document.getElementById('dTemplateHome')
  const editor = document.getElementById('dTemplateEditorWrap')
  const toggle = document.getElementById('dBtnToggleEditor')
  const fieldActions = document.getElementById('dTemplateBarFields')
  const isEditor = mode === 'editor'
  if (home) home.hidden = isEditor
  if (editor) editor.hidden = !isEditor
  if (fieldActions) fieldActions.hidden = !isEditor
  if (toggle) {
    toggle.disabled = !isEditor && !S.template
    toggle.textContent = isEditor ? '‹ Torna al template' : '✎ Editor campi'
    toggle.title = isEditor
      ? 'Torna alla schermata Template: le modifiche ai campi restano'
      : "Apre l'editor dei campi (canvas, lista campi, proprietà) sul template applicato"
  }
  if (isEditor) { renderFieldList(); redrawEditor() }
  // Tornando alla Home l'anteprima e l'avviso «nessun campo» vanno rispecchiati
  // sui campi appena creati/modificati nell'Editor — restava ferma alla vecchia
  // versione perché nessuno la ridisegnava se non un giro completo di renderTemplate().
  else { renderTemplatePreview() }
}

/** Apre/chiude l'editor dei campi in base allo stato attuale del DOM (nessuno
 *  stato duplicato da tenere sincronizzato: la visibilità di #dTemplateEditorWrap è
 *  già la fonte di verità). */
export function toggleTemplateEditor() {
  const editor = document.getElementById('dTemplateEditorWrap')
  setTemplateMode(editor && !editor.hidden ? 'home' : 'editor')
}

/* ── Guida rapida (visore F1 condiviso) ── */
export function openGuide() { toggleGuide('delta') }
export function closeGuide() { closeGuideShared() }
export function startDeltaTour() { showView('template'); startTour(DELTA_TOUR) }
