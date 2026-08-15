/* χ Refs — minuterie condivise fra i moduli della UI. */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function toast(msg) {
  let t = document.getElementById('cToast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'cToast'
    t.className = 'ehb-toast'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('is-on')
  clearTimeout(t._t)
  t._t = setTimeout(() => t.classList.remove('is-on'), 5200)
}

/** Barra di avanzamento: `frazione === null` la toglie. */
export function avanzamento(frazione, testo) {
  let b = document.getElementById('cProg')
  if (frazione === null) { if (b) b.remove(); return }
  if (!b) {
    b = document.createElement('div')
    b.id = 'cProg'
    b.className = 'c-prog'
    b.innerHTML = '<span class="c-prog__txt"></span><span class="c-prog__bar"><i></i></span>'
    document.body.appendChild(b)
  }
  b.querySelector('.c-prog__txt').textContent = testo || 'Attendi…'
  b.querySelector('.c-prog__bar i').style.width = `${Math.round((frazione || 0) * 100)}%`
}

export const mb = (byte) => `${(byte / 1048576).toFixed(1)} MB`
