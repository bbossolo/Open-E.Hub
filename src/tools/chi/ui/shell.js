/* χ Refs — la cornice: viste, tema, scheda del file, guida. */
import { applyTheme as applySharedTheme } from '../../../shared/theme'
import { closeGuide as chiudiGuidaCondivisa, toggleGuide } from '../../../shared/ui/components'
import { renderProfilo } from './profilo.js'
import { renderTrasferimento } from './trasferimento.js'
import { renderScala } from './scala.js'
import { S, setS } from './stato.js'
import { esc, mb } from './util.js'

export function mostraVista(quale) {
  setS('vista', quale)
  for (const v of ['apri', 'fondi']) {
    const el = document.getElementById(`view-${v}`)
    if (el) el.hidden = v !== quale
  }
  document.querySelectorAll('.ehb-rail-step').forEach(s => {
    s.classList.toggle('active', s.dataset.step === quale)
  })
  if (quale === 'fondi') { renderScheda(); renderProfilo(); renderScala(); renderTrasferimento() }
}

/** La scheda del file: cosa abbiamo capito, detto in italiano e non in group code. */
export function renderScheda() {
  const el = document.getElementById('cScheda')
  if (!el || !S.analisi) return
  const a = S.analisi
  const s = S.scala
  const conEntita = a.layer.filter(l => !l.vuoto).length

  el.innerHTML = `
    <div class="c-scheda__riga">
      <span class="c-scheda__file" title="${esc(S.nomeFile)}">${esc(S.nomeFile)}</span>
      <span class="c-scheda__dato">${mb(S.byte)}</span>
      <span class="c-scheda__dato">${conEntita} layer con disegno <span class="c-fioco">(${a.layer.length} in tutto)</span></span>
      <span class="c-scheda__dato">${a.nEntita.toLocaleString('it-IT')} entità</span>
      <span class="c-scheda__dato c-fioco">${esc(a.acadver || '—')}</span>
    </div>
    <div class="c-scheda__riga c-scheda__scala">
      <span class="c-scheda__et">Scala</span>
      <span class="${s && !s.dichiaratoAttendibile ? 'c-attenzione' : ''}">${esc(s ? s.nota : '—')}</span>
      ${s && s.diagonaleM ? `<span class="c-fioco">ingombro ≈ ${s.diagonaleM.toFixed(1)} m</span>` : ''}
    </div>
    ${notaLayerZero()}
    ${S.avvisi.map(a2 => `<p class="c-avviso">${esc(a2)}</p>`).join('')}`
}

/**
 * Il layer 0 passa intatto, e conviene dirlo prima che qualcuno lo cerchi nell'elenco.
 * È quello su cui vivono i blocchi: rinominarlo o spegnerlo fa sparire i simboli del disegno.
 */
function notaLayerZero() {
  const zero = (S.analisi ? S.analisi.layer : []).filter(l => /^_?0$/.test(l.nome) && !l.vuoto)
  if (!zero.length) return ''
  const ent = zero.reduce((n, l) => n + l.nEntita, 0)
  const blk = zero.reduce((n, l) => n + l.nInsert, 0)
  return `<p class="c-nota">Il <b>layer 0</b> si importa così com'è — ${ent.toLocaleString('it-IT')} entità${
    blk ? `, ${blk.toLocaleString('it-IT')} riferimenti a blocchi` : ''}. È il layer su cui vivono i blocchi: rinominarlo o spegnerlo farebbe sparire i simboli.</p>`
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  applyTheme(cur)
}

export function applyTheme(t) {
  applySharedTheme(t)
  const b = document.getElementById('btnTheme')
  if (b) b.textContent = t === 'dark' ? '☀' : '☾'
}

export function openGuide() { toggleGuide('chi') }
export function closeGuide() { chiudiGuidaCondivisa() }
