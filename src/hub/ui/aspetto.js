/* hub — impostazioni estetiche di suite: densità, font, scala del testo,
   animazioni, ombre. Ognuna si applica alla chrome e si trasmette
   a tutti i frame aperti. */
import { DEFAULT_FONT, DEFAULT_MOTION, DEFAULT_SHADOW, DEFAULT_TEXT_SIZE, FONTS, MOTION_MODES, SHADOW_INTENSITIES, TEXT_SIZES } from '../../shared/bus'
import { authProfile } from './auth.js'
import { loadedFrames } from './frames.js'
import { closeFontMenu } from './tema.js'

/* Densità UI: comfortable | compact. Persiste e applica su <html>.
   Per ora scoped all'hub; propagazione ai tool = follow-up. */
export const DENSITIES = ['comfortable', 'compact'];
export let uiDensity = 'comfortable';
try {
  const saved = localStorage.getItem('hub:density');
  if (saved && DENSITIES.includes(saved)) uiDensity = saved;
} catch (e) {}
export function applyDensity() {
  document.documentElement.setAttribute('data-density', uiDensity);
  document.querySelectorAll('.set-seg__opt[data-density-opt]').forEach(b => {
    b.classList.toggle('active', b.dataset.densityOpt === uiDensity);
  });
}
export function setDensity(mode) {
  if (!DENSITIES.includes(mode)) return;
  uiDensity = mode;
  try { localStorage.setItem('hub:density', mode); } catch (e) {}
  applyDensity();
}

/* Font di sistema: ORTOGONALE a tema/palette/densità, come la
   palette si propaga SEMPRE a tutti i tool aperti (via bus) e ai nuovi al lancio
   (via injectSuiteThemeIntoHtml). JetBrains Mono resta il default. */
export const SUITE_FONTS = FONTS;
/* Etichette leggibili (usate nel bottone della tendina, oltre che nei pulsanti). */
export const FONT_LABELS = {
  'jetbrains-mono': 'JetBrains Mono', 'cormorant': 'Cormorant', 'sistema': 'Sistema',
  'pixelify': 'Pixelify Sans', 'fredoka': 'Fredoka',
};
/* Il font di sistema ha un DEFAULT che dipende dal profilo (richiesta utente):
   ogni profilo AZIENDALE parte dal font di sistema (più neutro per il
   cliente); il profilo personale/admin resta su JetBrains Mono. La scelta
   ESPLICITA dell'utente (setFont) vince e viene ricordata PER profilo — quello
   personale usa la chiave storica 'hub:font', le aziende una chiave dedicata. */
export function fontKeyFor(profile) {
  return (profile && profile.companyId)
    ? `hub:font:${profile.companyId}:${profile.utente || ''}`
    : 'hub:font';
}
export function defaultFontFor(profile) {
  return (profile && profile.companyId) ? 'sistema' : DEFAULT_FONT;
}
/* Ricalcola il font attivo per il profilo corrente: scelta salvata se valida,
   altrimenti il default del profilo. Da chiamare a ogni cambio di profilo. */
export function resolveFont() {
  let font = defaultFontFor(authProfile);
  try {
    const saved = localStorage.getItem(fontKeyFor(authProfile));
    if (saved && SUITE_FONTS.includes(saved)) font = saved;
  } catch (e) {}
  suiteFont = font;
}
export let suiteFont = DEFAULT_FONT;
export function effectiveFont() { return suiteFont; }
export function broadcastFont(font) {
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type: 'hub:set-font', font }, '*'); } catch (e) {}
  });
}
export function applyFont() {
  document.documentElement.setAttribute('data-font', suiteFont);
  document.querySelectorAll('.set-font-opt[data-font-opt]').forEach(b => {
    b.classList.toggle('active', b.dataset.fontOpt === suiteFont);
  });
  // Bottone della tendina: riflette il font corrente, scritto nel font stesso.
  const lbl = document.getElementById('fontTriggerLabel');
  if (lbl) {
    const name = FONT_LABELS[suiteFont] || suiteFont;
    lbl.textContent = name;
    lbl.style.fontFamily = `'${name}'`;
  }
}
export function setFont(name) {
  if (!SUITE_FONTS.includes(name)) return;
  suiteFont = name;
  try { localStorage.setItem(fontKeyFor(authProfile), name); } catch (e) {}
  applyFont();
  broadcastFont(suiteFont);
  closeFontMenu();   // scelta fatta → chiudi la tendina
}

/* Dimensione testo: ORTOGONALE alle altre dimensioni, stesso
   pattern del font (sync via bus a tutti i tool, persistita). "md" = 100%. */
export const SUITE_TEXT_SIZES = TEXT_SIZES;
/* La dimensione testo è ora un valore CONTINUO (--ui-scale)
   pilotato da uno slider, non più i 4 preset. Manteniamo però `suiteTextSize` (il
   preset più vicino) per: back-compat del messaggio bus e anti-flash srcdoc
   (data-text-scale iniettato). Lo ZOOM di pagina resta il meccanismo (tokens.css). */
export const SCALE_BY_SIZE = { sm: 0.9, md: 1, lg: 1.15, xl: 1.3 };
export const UI_SCALE_MIN = 0.8, UI_SCALE_MAX = 1.4;
export function nearestTextSize(scale) {
  let best = DEFAULT_TEXT_SIZE, bd = Infinity;
  for (const [size, v] of Object.entries(SCALE_BY_SIZE)) {
    const d = Math.abs(v - scale); if (d < bd) { bd = d; best = size; }
  }
  return best;
}
export let suiteUiScale = 1;
try {
  const savedScale = parseFloat(localStorage.getItem('hub:ui-scale'));
  if (Number.isFinite(savedScale)) suiteUiScale = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, savedScale));
  else {
    // Migrazione dal vecchio preset S/M/L/XL, se presente.
    const savedSize = localStorage.getItem('hub:text-size');
    if (savedSize && SCALE_BY_SIZE[savedSize] != null) suiteUiScale = SCALE_BY_SIZE[savedSize];
  }
} catch (e) {}
export let suiteTextSize = nearestTextSize(suiteUiScale);
export function effectiveTextSize() { return suiteTextSize; }
export function broadcastTextSize(size, scale) {
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type: 'hub:set-text-size', size, scale }, '*'); } catch (e) {}
  });
}
export function applyTextSize() {
  // Valore continuo inline (vince sulle regole [data-text-scale] di tokens.css);
  // l'attributo resta come approssimazione per l'anti-flash dei tool lanciati dopo.
  document.documentElement.style.setProperty('--ui-scale', String(suiteUiScale));
  document.documentElement.setAttribute('data-text-scale', suiteTextSize);
  const range = document.getElementById('ui-scale-range');
  if (range && range.valueAsNumber !== suiteUiScale) range.value = String(suiteUiScale);
  const pct = Math.round(suiteUiScale * 100);
  const num = document.getElementById('ui-scale-num');
  // Non sovrascrivere mentre l'utente sta digitando nella casella.
  if (num && document.activeElement !== num && num.valueAsNumber !== pct) num.value = String(pct);
  const val = document.getElementById('ui-scale-val');
  if (val) val.textContent = `${pct}%`;
}
export function setUiScale(scale) {
  const v = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(scale)));
  if (!Number.isFinite(v)) return;
  suiteUiScale = Math.round(v * 100) / 100;
  suiteTextSize = nearestTextSize(suiteUiScale);
  try { localStorage.setItem('hub:ui-scale', String(suiteUiScale)); } catch (e) {}
  applyTextSize();
  broadcastTextSize(suiteTextSize, suiteUiScale);
}
export function nudgeUiScale(delta) { setUiScale(suiteUiScale + delta); }
/* Casella numerica: valore in % (80–140). Valori fuori range/non numerici
   vengono clampati da setUiScale e la casella si riallinea in applyTextSize. */
export function setUiScalePct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) { applyTextSize(); return; }
  setUiScale(n / 100);
}
/* Back-compat: qualcuno potrebbe ancora chiamare setTextSize('lg') — mappa al valore. */
export function setTextSize(size) { if (SCALE_BY_SIZE[size] != null) setUiScale(SCALE_BY_SIZE[size]); }

/* Riduci animazioni: ORTOGONALE alle altre, stesso pattern.
   Copertura reale parziale (vedi nota in tokens.css) — riduce la maggioranza
   del movimento, non letteralmente tutte le transizioni della suite. */
export const SUITE_MOTIONS = MOTION_MODES;
export let suiteMotion = DEFAULT_MOTION;
try {
  const savedMotion = localStorage.getItem('hub:motion');
  if (savedMotion && SUITE_MOTIONS.includes(savedMotion)) suiteMotion = savedMotion;
} catch (e) {}
export function effectiveMotion() { return suiteMotion; }
export function broadcastMotion(motion) {
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type: 'hub:set-motion', motion }, '*'); } catch (e) {}
  });
}
export function applyMotion() {
  document.documentElement.setAttribute('data-motion', suiteMotion);
  document.querySelectorAll('.set-seg__opt[data-motion-opt]').forEach(b => {
    b.classList.toggle('active', b.dataset.motionOpt === suiteMotion);
  });
}
export function setMotion(mode) {
  if (!SUITE_MOTIONS.includes(mode)) return;
  suiteMotion = mode;
  try { localStorage.setItem('hub:motion', mode); } catch (e) {}
  applyMotion();
  broadcastMotion(suiteMotion);
}

/* Intensità ombre: ORTOGONALE alle altre, stesso pattern.
   Copertura reale parziale (vedi nota in tokens.css). */
export const SUITE_SHADOWS = SHADOW_INTENSITIES;
export let suiteShadow = DEFAULT_SHADOW;
try {
  const savedShadow = localStorage.getItem('hub:shadow');
  if (savedShadow && SUITE_SHADOWS.includes(savedShadow)) suiteShadow = savedShadow;
} catch (e) {}
export function effectiveShadow() { return suiteShadow; }
export function broadcastShadow(shadow) {
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type: 'hub:set-shadow', shadow }, '*'); } catch (e) {}
  });
}
export function applyShadow() {
  document.documentElement.setAttribute('data-shadow', suiteShadow);
  document.querySelectorAll('.set-seg__opt[data-shadow-opt]').forEach(b => {
    b.classList.toggle('active', b.dataset.shadowOpt === suiteShadow);
  });
}

export function setShadow(level) {
  if (!SUITE_SHADOWS.includes(level)) return;
  suiteShadow = level;
  try { localStorage.setItem('hub:shadow', level); } catch (e) {}
  applyShadow();
  broadcastShadow(suiteShadow);
}
