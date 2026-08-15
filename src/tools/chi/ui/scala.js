/* χ Refs — il comando della scala.

   Due modi, e il default è quello che non rischia niente:

   - «solo dichiarazione»: si scrive $INSUNITS nell'header e non si tocca una coordinata. È
     reversibile, e nella maggior parte dei casi è tutto quello che serve — il disegno è già in
     millimetri, manca solo che il file lo dica.
   - «riscala davvero»: si moltiplicano le lunghezze. Serve quando il collaboratore disegna in
     metri e la tavola va portata a 1:1. È l'opzione invasiva, quindi si chiede a voce alta e si
     mostra il risultato in chiaro prima di eseguirlo. */
import { renderTrasferimento } from './trasferimento.js'
import { S } from './stato.js'
import { esc } from './util.js'

const FATTORI = [
  { v: 1000, et: 'metri → millimetri (×1000)' },
  { v: 100, et: 'centimetri → millimetri (×100)' },
  { v: 10, et: 'decimetri → millimetri (×10)' },
  { v: 0.001, et: 'millimetri → metri (÷1000)' },
]

export function renderScala() {
  const el = document.getElementById('cScala')
  if (!el) return
  const s = S.scala
  const f = S.opzioni.fattoreScala

  // Se la scala è deducibile e non è già 1:1, si propone il fattore giusto invece di far
  // cercare all'utente quale sia.
  const suggerito = s && s.fattoreVersoMm && s.fattoreVersoMm !== 1 ? s.fattoreVersoMm : null

  el.innerHTML = `
    <label class="c-check" title="Scrive le unità nell’header senza toccare la geometria">
      <input type="radio" name="cModoScala" ${!f ? 'checked' : ''} onchange="impostaScala(null)">
      dichiara le unità
    </label>
    <label class="c-check" title="Moltiplica davvero le lunghezze del disegno">
      <input type="radio" name="cModoScala" ${f ? 'checked' : ''} onchange="impostaScala(${suggerito || 1000})">
      riscala
    </label>
    <select class="ehb-select c-scala__sel" ${f ? '' : 'disabled'} onchange="impostaScala(Number(this.value))">
      ${FATTORI.map(x => `<option value="${x.v}" ${f === x.v ? 'selected' : ''}>${esc(x.et)}</option>`).join('')}
      ${f && !FATTORI.some(x => x.v === f) ? `<option value="${f}" selected>×${f}</option>` : ''}
    </select>
    ${suggerito && !f ? `<button class="ehb-btn ehb-btn--ghost" onclick="impostaScala(${suggerito})">usa ×${suggerito}</button>` : ''}
    <span class="c-scala__esito">${esc(descriviEsito(f))}</span>`
}

/** Cosa diventerà il disegno, detto in metri prima di premere il pulsante. */
function descriviEsito(fattore) {
  const s = S.scala
  if (!fattore) return s && !s.unitaPerMetro ? 'la scala non è deducibile: se il disegno arriva sbagliato, riscala a mano' : ''
  if (!s || !s.diagonaleM) return `tutte le lunghezze ×${fattore}`
  return `l’ingombro passa a ≈ ${(s.diagonaleM * fattore / (s.unitaPerMetro || 1)).toFixed(0)} unità`
}

export function impostaScala(fattore) {
  S.opzioni.fattoreScala = fattore || null
  renderScala()
  renderTrasferimento()
}
