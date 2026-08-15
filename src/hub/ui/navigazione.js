/* hub — lista dei tool, card di benvenuto, ricerca e scorciatoie da tastiera. */
import { nameWithGlyph, toolGlyphSvgById } from '../../shared/ui/glyphs'
import { groupByCategory } from '../data/registry'
import { filterApps } from '../engine/index'
import { enabledApps } from './auth.js'
import { closeSession, currentId, folder, goHome, launchApp, loadedFrames, reloadApp } from './frames.js'
import { closeAppearance, closeCredits, closeGuide, closeLegal } from './guida.js'
import { LOGO_MAP, logoHTML, toggleSidebar } from './shell.js'
import { toggleTheme } from './tema.js'
export let focusIndex   = -1;
export let visibleIds   = [];

/* ══════════════════════════════════════════════
   RENDER LIST
   ══════════════════════════════════════════════ */
export function renderList(apps) {
  const list  = document.getElementById('app-list');
  const empty = document.getElementById('list-empty');
  visibleIds  = apps.map(a => a.id);
  document.getElementById('nav-count').textContent = apps.length;
  if (!apps.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  // Tool raggruppati per TEMATICA con intestazione di sezione.
  list.innerHTML = groupByCategory(apps).map(g => `
    <div class="nav-group-title">${g.label}</div>
    ${g.apps.map(navItemHTML).join('')}`).join('');
}

/* Markup di una voce nav (estratto per il raggruppamento). */
export function navItemHTML(app) {
  return `
    <div class="nav-item${loadedFrames[app.id] ? ' live' : ''}${app.id === currentId ? ' active' : ''}" id="nav-${app.id}"
         data-tool="${(LOGO_MAP[app.logoType] || {}).tool || 'hub'}"
         onclick="launchApp('${app.id}')" role="button" tabindex="0" title="${app.name}"
         onkeydown="if(event.key==='Enter')launchApp('${app.id}')">
      ${logoHTML(app, 'nav-logo')}
      <div class="nav-meta">
        <div class="nav-name">${nameWithGlyph(app.name)}</div>
        <div class="nav-tagline">${app.tagline || ''}</div>
      </div>
      <div class="nav-right">
        ${app.resolvedFile === null && folder
          ? '<span class="nav-badge wip" title="File non trovato in cartella">missing</span>'
          : app.status === 'stable'
            ? ''
            : '<span class="nav-badge beta">beta</span>'}
      </div>
    </div>`;
}

// Coppie di tematiche AFFIANCATE, vicine per contesto d'uso ma separate per
// chiarezza: numeri/documenti (prima un unico gruppo eterogeneo, computo-
// documenti) e progettazione/strumenti-dxf (χ prepara i DXF che girano
// intorno al disegno, non lo disegna — satellite di progettazione, non
// dentro). L'algoritmo sotto affianca solo coppie ADIACENTI in CATEGORY_ORDER:
// l'ordine lì decide anche quali categorie finiscono vicine.
const SIDE_BY_SIDE_CATEGORIES = ['calcolo-prezzi', 'documenti-commessa', 'progettazione', 'strumenti-dxf'];

export function renderWelcomeCards() {
  const wrap = document.getElementById('welcome-cards');
  if (!wrap) return;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  const sectionHTML = (g) => `
    <section class="wlc-group">
      <div class="wlc-group-title">${g.label}</div>
      <div class="wlc-group-cards">${g.apps.map(app => welcomeCardHTML(app, arrow)).join('')}</div>
    </section>`;
  // Card raggruppate per TEMATICA in sezioni affiancate (flex proporzionale al n. card).
  const groups = groupByCategory(enabledApps());
  let html = '';
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const next = groups[i + 1];
    if (SIDE_BY_SIDE_CATEGORIES.includes(g.key) && next && SIDE_BY_SIDE_CATEGORIES.includes(next.key)) {
      html += `<div class="wlc-row">${sectionHTML(g)}${sectionHTML(next)}</div>`;
      i++; // il gruppo successivo è già stato reso, saltalo
    } else {
      html += sectionHTML(g);
    }
  }
  wrap.innerHTML = html;
}

/* Markup di una welcome-card (estratto per il raggruppamento). */
export function welcomeCardHTML(app, arrow) {
    const hasFolder = !!folder;
    const missing   = hasFolder && !app.resolvedFile;
    const active    = !!loadedFrames[app.id];
    let cls = 'wlc-card';
    if (missing)         cls += ' missing';
    else if (!hasFolder) cls += ' preview';
    if (active)          cls += ' active-session';
    let pill;
    if (missing)                   pill = '<span class="wlc-status missing">non trovato</span>';
    else if (app.status === 'beta')pill = '<span class="wlc-status beta"><span class="d"></span>beta</span>';
    else                           pill = '';   // gli stabili non mostrano chip (solo beta/missing)
    const live = active ? '<span class="wlc-live"><span class="pulse"></span>attiva</span>' : '';
    // Glifo dell'integrazione: il tool BERSAGLIO (col suo accento). β←μ…
    const NOTE_GLYPH = { miu: ['μ', 'miu'], delta: ['δ', 'delta'] };
    // Anche il glifo d'integrazione è vettoriale (coerente col logo card).
    // Card ridotte (redesign hub-welcome-orizzontale): l'integrazione è un micro-glifo
    // del tool bersaglio accanto al nome; il testo completo resta nel tooltip.
    // Una card può avere più integrazioni: un glifo per ciascuna.
    const note = (app.notes || []).map(n => {
      const ng = NOTE_GLYPH[n.icon];
      if (!ng) return '';
      return `<span class="wlc-feat-glyph" data-tool="${ng[1]}" title="${n.text}">${toolGlyphSvgById(n.icon) || ng[0]}</span>`;
    }).join('');
    const tool = (LOGO_MAP[app.logoType] || {}).tool || 'hub';
    const closeSess = active
      ? `<button class="wlc-close-sess" title="Chiudi la sessione di ${app.name}" aria-label="Chiudi sessione" onclick="event.stopPropagation();closeSession('${app.id}',event)">✕</button>`
      : '';
    return `
    <div class="${cls}" data-tool="${tool}" role="button" tabindex="0" title="${app.name}"
         onclick="launchApp('${app.id}')"
         onkeydown="if(event.key==='Enter')launchApp('${app.id}')">
      ${closeSess}
      <span class="wlc-go">${arrow}</span>
      <div class="wlc-card-top">
        ${logoHTML(app, 'wlc-logo')}
      </div>
      <div class="wlc-card-body">
        <div class="wlc-card-name">${nameWithGlyph(app.name)}${note}</div>
        <div class="wlc-card-tag">${app.tagline || ''}</div>
      </div>
      <div class="wlc-card-foot">${pill}${live}</div>
    </div>`;
}

export function filterList() {
  renderList(filterApps(enabledApps(), document.getElementById('search').value));
}

/* ══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Modale guida aperta: Esc chiude, gli altri tasti non agiscono sotto
  const guideOv = document.getElementById('guide-overlay');
  if (guideOv && guideOv.classList.contains('open')) {
    if (e.key === 'Escape') closeGuide();
    return;
  }
  const legalOv = document.getElementById('legal-overlay');
  if (legalOv && legalOv.classList.contains('open')) {
    if (e.key === 'Escape') closeLegal();
    return;
  }
  const creditsOv = document.getElementById('credits-overlay');
  if (creditsOv && creditsOv.classList.contains('open')) {
    if (e.key === 'Escape') closeCredits();
    return;
  }
  const appearanceOv = document.getElementById('appearance-overlay');
  if (appearanceOv && appearanceOv.classList.contains('open')) {
    if (e.key === 'Escape') closeAppearance();
    return;
  }
  if (e.target === document.getElementById('search')) {
    if (e.key === 'Escape') { e.target.value = ''; filterList(); e.target.blur(); }
    return;
  }
  // Qualsiasi altro campo di input (es. login) non deve subire le scorciatoie
  // globali (T/B/R): stesso guard di bindThemeShortcut in shared/theme.ts.
  const activeEl = e.target;
  if (activeEl && (/input|select|textarea/i.test(activeEl.tagName) || activeEl.isContentEditable)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    focusIndex = Math.max(0, Math.min(visibleIds.length - 1, focusIndex + (e.key === 'ArrowDown' ? 1 : -1)));
    const el = document.getElementById('nav-' + visibleIds[focusIndex]);
    if (el) { el.focus(); el.scrollIntoView({ block:'nearest' }); }
  }
  else if (e.key === 'Enter' && focusIndex >= 0) launchApp(visibleIds[focusIndex]);
  else if (e.key === '/') { e.preventDefault(); document.getElementById('search').focus(); }
  else if (e.key.toLowerCase() === 't') toggleTheme();
  else if (e.key.toLowerCase() === 'b') toggleSidebar();
  else if (e.key.toLowerCase() === 'r') { e.preventDefault(); reloadApp(); }
  else if (e.key === 'Escape' && currentId) goHome();
});

/* L'indice della voce a fuoco si azzera anche tornando alla home (frames.js). */
export function setFocusIndex(v) { focusIndex = v }

