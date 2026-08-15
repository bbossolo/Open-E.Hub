/* hub — cornice: logo dei tool, sidebar, toast, escape HTML. */
import { toolGlyphSvgById } from '../../shared/ui/glyphs'
export const LOGO_MAP = {
  miu: { tool: 'miu', glyph: 'μ', mod: '' },
  alfa: { tool: 'alfa', glyph: 'α', mod: '' },
  beta: { tool: 'beta', glyph: 'β', mod: '' },
  delta: { tool: 'delta', glyph: 'δ', mod: '' },
  chi: { tool: 'chi', glyph: 'χ', mod: '' },
};
export function logoHTML(app, cls) {
  // Fallback per tool non registrati: glifo geometrico neutro (coerente con la
  // famiglia di lettere greche ε/μ/β/δ/χ, niente emoji fuori stile).
  const m = LOGO_MAP[app.logoType] || { tool: 'hub', glyph: '◇', mod: '' };
  // Glifo VETTORIALE (golden set JetBrains Mono) → coerente ovunque, μ
  // incluso; fallback al carattere solo per tool non mappati (es. hub ◇).
  const inner = toolGlyphSvgById(m.tool) || m.glyph;
  return `<div class="ehb-logo ${cls} ${m.mod}" data-tool="${m.tool}"><span class="ehb-logo__glyph">${inner}</span></div>`;
}

/* ══════════════════════════════════════════════
   SIDEBAR
   ══════════════════════════════════════════════ */
export function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  localStorage.setItem('hub:sidebar',
    document.getElementById('sidebar').classList.contains('collapsed') ? '1' : '0');
}
export function escHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

/* Toast minimale dell'hub: sparisce al primo clic ovunque (per non interrompere
   il workflow), con un timeout di sicurezza come fallback. */
export let _hubToastT = null;
export function hubToast(msg, opts = {}) {
  const { ms = 8000, variant = '' } = opts;
  const el = document.getElementById('hub-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('bad', variant === 'bad');
  el.classList.add('show');
  const dismiss = () => {
    el.classList.remove('show');
    clearTimeout(_hubToastT);
    document.removeEventListener('pointerdown', dismiss, true);
  };
  clearTimeout(_hubToastT);
  _hubToastT = setTimeout(dismiss, ms);
  // ritardo: evita che il click che ha aperto l'app lo chiuda all'istante
  setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 60);
}
