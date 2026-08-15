/* hub — tema UNICO di suite (modo + palette) e sua iniezione nei frame,
   accento per-tool, pannello Impostazioni. */
import { DEFAULT_PALETTE, PALETTES } from '../../shared/bus'
import { migrateSuiteTheme, resolveStartupMode } from '../../shared/theme'
import { APP_REGISTRY } from '../data/registry'
import { suiteFont, suiteMotion, suiteShadow, suiteTextSize, suiteUiScale } from './aspetto.js'
import { currentId, loadedFrames } from './frames.js'
import { LOGO_MAP } from './shell.js'

/* ══════════════════════════════════════════════
   THEME — UNICO PER TUTTA LA SUITE (persistito)
   ──────────────────────────────────────────────
   Il tema è una scelta dell'INTERA suite, non del singolo tool: l'hub lo applica
   alla propria chrome e lo spinge a TUTTI i frame (al caricamento e ai cambi),
   così navigare tra i tool non "sbatte" più da scuro a chiaro. La scelta è
   ricordata tra le sessioni in localStorage('hub:theme'). `contextTool` resta solo
   per l'ACCENTO per-tool (colore della barra), non per il tema.
   ══════════════════════════════════════════════ */
/* Palette note della suite: dimensione ORTOGONALE al modo light/dark.
   Single source of truth in src/shared/bus.ts (PALETTES) e src/shared/ui/tokens.css.
   La migrazione dello stato persistito vive in src/shared/theme.ts (pura, testata). */
export const SUITE_PALETTES = PALETTES;

export let suiteTheme = { palette: DEFAULT_PALETTE, mode: 'dark' };
try {
  suiteTheme = migrateSuiteTheme(localStorage.getItem('hub:theme'));
} catch(e) {}
export let contextTool = 'hub';        // contesto corrente (per l'accento), home = 'hub'

/* Il MODO (light/dark) è UNICO per tutta la suite e, finché l'utente non
   sceglie esplicitamente, SEGUE IL SISTEMA operativo (prefers-color-scheme).
   `themePinned` = l'utente ha imposto un modo a mano (hub o tool) → smette di
   seguire il sistema. Persistito separatamente da `hub:theme` (che resta {palette,mode}). */
export let themePinned = false;
try { themePinned = localStorage.getItem('hub:theme-pinned') === '1'; } catch(e) {}
export const themeMQ = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export function systemMode() { return themeMQ && themeMQ.matches ? 'dark' : 'light'; }
/* All'avvio: se l'utente non ha "pinnato", parti dal modo di sistema. */
suiteTheme.mode = resolveStartupMode(suiteTheme.mode, themePinned, systemMode());

/* La chrome dell'hub usa SEMPRE il modo unico di suite (niente più default per-tool). */
export function hubChromeTheme() { return suiteTheme.mode; }

export function toolKeyOf(id) {
  const app = APP_REGISTRY.find(a => a.id === id);
  return (LOGO_MAP[(app || {}).logoType] || {}).tool || 'hub';
}
/* Modo effettivo (light/dark): UNICO per la suite. Il parametro è ignorato —
   mantenuto per compatibilità con i call-site esistenti (load/cambio frame). */
export function effectiveTheme() { return suiteTheme.mode; }
export function effectivePalette() { return suiteTheme.palette; }
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || suiteTheme.mode;
}
/* PUSH ESPLICITO del tema dal picker dell'hub a TUTTI i frame caricati: serve ad
   "aggiornare" il light/dark interno delle app. Il tema resta per-tool (override
   locale nel tool); l'hub non lo forza all'avvio, solo qui su azione utente. */
export function broadcastTheme(mode, exceptWindow) {
  Object.values(loadedFrames).forEach(f => {
    if (exceptWindow && f.contentWindow === exceptWindow) return;   // chi l'ha originato l'ha già applicato
    try { f.contentWindow.postMessage({ type:'hub:set-theme', theme:mode }, '*'); } catch(e) {}
  });
}
/* La PALETTE è di suite e ORTOGONALE al tema: si propaga SEMPRE a tutti i frame
   (caricati e, via srcdoc, ai nuovi al lancio) senza toccare il loro light/dark. */
export function broadcastPalette(palette) {
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type:'hub:set-palette', palette }, '*'); } catch(e) {}
  });
}
/* Persiste lo stato {palette,mode} di suite (oggetto JSON; migrabile in lettura). */
export function persistSuiteTheme() {
  try { localStorage.setItem('hub:theme', JSON.stringify(suiteTheme)); } catch(e) {}
}
/* Anti-flash srcdoc: inietta sull'<html> del tool sia la data-palette sia il
   data-theme di SUITE. Il modo è UNICO per tutta la suite: ogni tool parte
   col modo corrente dell'hub, non più col proprio default — niente sbalzo light/dark. */
export function injectAttr(html, attr, value) {
  const re = new RegExp(`(<html\\b[^>]*\\b${attr}=)("|')[^"']*\\2`, 'i');
  if (re.test(html)) return html.replace(re, `$1$2${value}$2`);
  return html.replace(/<html\b/i, `<html ${attr}="${value}"`);
}
/* Inietta una custom-property INLINE su <html> (vince su qualsiasi regola :root del
   tool). Usato per --ui-scale continuo: così OGNI tool parte
   al valore esatto dello slider, anche quelli senza handler live (μ/α), non solo al
   preset discreto approssimato di data-text-scale. */
export function injectStyleVar(html, name, value) {
  const decl = `${name}:${value}`;
  const re = /(<html\b[^>]*\bstyle=)("|')([^"']*)\2/i;
  if (re.test(html)) {
    return html.replace(re, (_m, p1, q, cur) => {
      const cleaned = cur.replace(new RegExp(`${name}\\s*:[^;]*;?`, 'i'), '').trim();
      const sep = cleaned && !cleaned.endsWith(';') ? ';' : '';
      return `${p1}${q}${cleaned}${sep}${decl}${q}`;
    });
  }
  return html.replace(/<html\b/i, `<html style="${decl}"`);
}
export function injectSuiteThemeIntoHtml(html) {
  let out = injectAttr(html, 'data-palette', suiteTheme.palette);
  out = injectAttr(out, 'data-theme', suiteTheme.mode);
  out = injectAttr(out, 'data-font', suiteFont);
  out = injectAttr(out, 'data-text-scale', suiteTextSize);
  out = injectStyleVar(out, '--ui-scale', String(suiteUiScale));
  out = injectAttr(out, 'data-motion', suiteMotion);
  out = injectAttr(out, 'data-shadow', suiteShadow);
  return out;
}
/* Transizione morbida del cambio tema (la classe è gestita da tokens.css). */
export function animateThemeSwitch() {
  const root = document.documentElement;
  root.classList.add('theme-anim');
  setTimeout(() => root.classList.remove('theme-anim'), 320);
}
/* Applica tema+palette alla chrome dell'HUB; al frame attivo propaga SOLO la
   palette (il tema del tool è suo, non lo forziamo navigando). */
export function applyContextTheme() {
  // La chrome dell'hub segue il tema del tool attivo (home: tema proprio dell'hub).
  document.documentElement.setAttribute('data-theme', hubChromeTheme());
  document.documentElement.setAttribute('data-palette', suiteTheme.palette);
  const f = currentId && loadedFrames[currentId];
  if (f) { try { f.contentWindow.postMessage({ type:'hub:set-palette', palette:suiteTheme.palette }, '*'); } catch(e) {} }
  if (f) { try { f.contentWindow.postMessage({ type:'hub:set-font', font:suiteFont }, '*'); } catch(e) {} }
  if (f) { try { f.contentWindow.postMessage({ type:'hub:set-text-size', size:suiteTextSize, scale:suiteUiScale }, '*'); } catch(e) {} }
  if (f) { try { f.contentWindow.postMessage({ type:'hub:set-motion', motion:suiteMotion }, '*'); } catch(e) {} }
  if (f) { try { f.contentWindow.postMessage({ type:'hub:set-shadow', shadow:suiteShadow }, '*'); } catch(e) {} }
  syncThemeToggle();
}
export function toggleTheme() {
  setTheme(suiteTheme.mode === 'dark' ? 'light' : 'dark');
}
/* Imposta il MODO (light/dark) dell'INTERA suite: persiste, applica alla chrome e lo
   spinge a TUTTI i frame caricati, con transizione morbida. `opts.user` (default true):
   una scelta esplicita dell'utente "pinna" il modo e smette di seguire il sistema.
   `opts.exceptWindow`: frame da NON ri-notificare (chi ha originato il cambio). */
export function setTheme(next, opts) {
  if (next !== 'light' && next !== 'dark') return;
  const o = opts || {};
  if (o.user !== false) {
    themePinned = true;
    try { localStorage.setItem('hub:theme-pinned', '1'); } catch(e) {}
  }
  if (suiteTheme.mode === next) { applyContextTheme(); return; }   // già nel modo: solo riallinea
  suiteTheme = { ...suiteTheme, mode: next };
  persistSuiteTheme();
  animateThemeSwitch();
  broadcastTheme(suiteTheme.mode, o.exceptWindow);   // push a tutti i tool aperti (escluso l'originante)
  applyContextTheme();
}
/* La suite segue prefers-color-scheme finché l'utente non sceglie a mano: quando il
   sistema cambia (e non è "pinnato") aggiorna il modo unico senza "pinnare". */
if (themeMQ) {
  const onSys = () => { if (!themePinned) setTheme(systemMode(), { user: false }); };
  if (themeMQ.addEventListener) themeMQ.addEventListener('change', onSys);
  else if (themeMQ.addListener) themeMQ.addListener(onSys);   // Safari < 14
}
/* Imposta la PALETTE dell'INTERA suite: persiste, applica e propaga. */
export function setPalette(name) {
  if (!SUITE_PALETTES.includes(name)) return;
  suiteTheme = { ...suiteTheme, palette: name };
  persistSuiteTheme();
  animateThemeSwitch();
  document.documentElement.setAttribute('data-palette', suiteTheme.palette);
  broadcastPalette(suiteTheme.palette);   // la palette si propaga sempre (ortogonale al tema)
  syncThemeToggle();
  closePaletteMenu();   // scelta fatta → chiudi la tendina
}
/* Apre/chiude la tendina <details> della palette nel pannello Impostazioni. */
export function closePaletteMenu() {
  const d = document.getElementById('paletteDisclosure');
  if (d) d.open = false;
}
/* Idem per il font: raggruppati in <details> per non occupare tutto il pannello. */
export function closeFontMenu() {
  const d = document.getElementById('fontDisclosure');
  if (d) d.open = false;
}

/* ── Pannello IMPOSTAZIONI (fondo sidebar): palette + densità ──────── */
export function setSettingsOpen(open) {
  const panel = document.getElementById('settingsPanel');
  const trigger = document.getElementById('settingsTrigger');
  if (!panel || !trigger) return;
  panel.hidden = !open;
  panel.classList.toggle('open', open);
  trigger.setAttribute('aria-expanded', String(open));
  trigger.classList.toggle('active', open);
}
export function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  setSettingsOpen(!(panel && panel.classList.contains('open')));
}
export function closeSettings() { setSettingsOpen(false); }
export function syncThemeToggle() {
  const curMode = currentTheme();
  const curPalette = suiteTheme.palette;
  document.querySelectorAll('.wlc-theme-opt[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === curMode);
  });
  document.querySelectorAll('.wlc-theme-opt[data-palette-opt]').forEach(b => {
    b.classList.toggle('active', b.dataset.paletteOpt === curPalette);
  });
  // Trigger del menu: riflette la palette corrente (swatch + etichetta).
  const sw = document.getElementById('paletteTriggerSwatch');
  if (sw) sw.className = 'wlc-swatch wlc-swatch--' + curPalette;
  const lbl = document.getElementById('paletteTriggerLabel');
  if (lbl) lbl.textContent = curPalette.charAt(0).toUpperCase() + curPalette.slice(1);
}

/* Il contesto (accento per-tool) lo cambiano frames.js entrando/uscendo da un tool
   e il barrel all'avvio: da fuori serve un setter. */
export function setContextTool(v) { contextTool = v }

