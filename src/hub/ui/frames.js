/* hub — risoluzione dei file dei tool (bridge Electron o fetch web) e ciclo di
   vita degli iframe: apertura, ricarica, chiusura, ritorno alla home. */
import { nameWithGlyph } from '../../shared/ui/glyphs'
import { APP_REGISTRY } from '../data/registry'
import { resolveFiles } from '../engine/index'
import { effectiveFont, effectiveMotion, effectiveShadow, effectiveTextSize, suiteUiScale } from './aspetto.js'
import { currentCompanyBrand, enabledApps } from './auth.js'
import { pushStateToFrame, syncProjectGate } from './bus.js'
import { filterList, renderWelcomeCards, setFocusIndex } from './navigazione.js'
import { flushPendingRestore, projectDirty } from './progetto.js'
import { LOGO_MAP, logoHTML } from './shell.js'
import { applyContextTheme, effectivePalette, injectSuiteThemeIntoHtml, setContextTool, toolKeyOf } from './tema.js'

/* ══════════════════════════════════════════════
   STATO
   ══════════════════════════════════════════════ */
export let currentId    = null;
export let overlayTimer = null;
export let folder = null;          // adattatore: { name, listHtml():Promise<string[]>, readText(name):Promise<string> }
export const loadedFrames = {};

/* ══════════════════════════════════════════════
   AUTO-RILEVAMENTO FILE DA CARTELLA
   ══════════════════════════════════════════════ */

/* Scansiona la cartella e risolve per ogni app il file HTML più recente che
   inizia con app.prefix. L'estrazione versione e la risoluzione (ordinamento
   lessicografico, l'ultimo match vince) sono in engine/ (resolveFiles), testate. */
export async function scanFolder() {
  if (!folder) return;
  resolveFiles(await folder.listHtml(), APP_REGISTRY);
}

/* ══════════════════════════════════════════════
   RISOLUZIONE TOOL (app Electron unificata)
   ══════════════════════════════════════════════ */
/* La cartella è quella, fissa, delle risorse dell'app, esposta dal bridge sicuro
   `ehubNative` (contextBridge, contextIsolation:true). Nessuna selezione manuale:
   all'avvio si risolvono i tool e si mostra subito la welcome con le card. */
export function makeElectronFolder() {
  return {
    name: window.ehubNative.folderName(),
    listHtml: async () => window.ehubNative.listHtml(),
    readText: async (n) => window.ehubNative.readText(n),
  };
}

/* Edizione web (server): niente bridge Electron, i file sono serviti come
   pagine statiche accanto all'hub (stesso host/cartella, nomi STABILI — vedi
   scripts/build-web-deploy.mjs). listHtml() non "lista una cartella" (impossibile
   via HTTP su un host statico): deve ritornare un elenco.
   DERIVATO DAL REGISTRY, mai scritto a mano: quando era una lista fissa, δ Pages
   è stato registrato ma non elencato qui, e in produzione l'hub mostrava la card
   del tool e all'apertura «Nessun file trovato» — pur essendo il file nel deploy.
   Così ogni tool registrato è risolvibile per costruzione. */
export const WEB_TOOL_FILES = ['EHub.html', ...APP_REGISTRY.map(a => a.file)];
export function makeBrowserFolder() {
  return {
    name: 'Open E.Hub (web)',
    listHtml: async () => WEB_TOOL_FILES,
    readText: async (n) => {
      const res = await fetch(n);
      if (!res.ok) throw new Error(`HTTP ${res.status} su ${n}`);
      return res.text();
    },
  };
}

export async function initFolder() {
  folder = window.ehubNative ? makeElectronFolder() : makeBrowserFolder();
  await scanFolder();                         // resolveFiles() popola resolvedFile/version
  filterList();
  renderWelcomeCards();
  document.getElementById('stat-n').textContent = enabledApps().length;
}

/* ══════════════════════════════════════════════
   LAUNCH APP
   ══════════════════════════════════════════════ */
export async function launchApp(id) {
  const gate = document.getElementById('project-gate');
  if (gate && !gate.hidden) return;   // nessun progetto attivo: il gate blocca l'apertura di tool
  const app = APP_REGISTRY.find(a => a.id === id);
  if (!app) return;

  if (!folder) await initFolder();   // difensivo: l'avvio di norma l'ha già fatto

  currentId = id;
  // Il tema è di suite: entrando in un tool resta quello corrente (la chrome
  // aggiorna solo l'ACCENTO per-tool, sotto). Nessun cambio scuro↔chiaro.
  setContextTool(toolKeyOf(id));
  applyContextTheme();
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + id);
  if (navEl) navEl.classList.add('active');

  document.getElementById('welcome').classList.add('hidden');
  const appBar = document.getElementById('app-bar');
  appBar.classList.add('visible');
  // Accento per-tool: quando si entra in un tool, la barra dell'hub assume il
  // suo colore (es. μ verde, β ambra); fuori dai tool resta il rosso hub.
  appBar.dataset.tool = (LOGO_MAP[app.logoType] || {}).tool || 'hub';
  document.getElementById('frames').classList.add('visible');
  document.getElementById('error-overlay').classList.remove('show');

  // Barra titolo
  document.getElementById('bar-title').innerHTML =
    `${logoHTML(app, 'bt-logo')} ${nameWithGlyph(app.name)} <span class="bt-ver" title="${app.resolvedFile || ''}">Open E.Hub v${(window.EHUB_VERSIONS && window.EHUB_VERSIONS.app.version) || ''}</span>`;

  // Nasconde tutti gli altri frame
  Object.values(loadedFrames).forEach(f => f.classList.remove('active'));

  if (loadedFrames[id]) {
    loadedFrames[id].classList.add('active');
    // Riallinea SOLO la palette del frame già caricato (il tema è del tool).
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-palette', palette: effectivePalette() }, '*'); } catch(e) {}
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-font', font: effectiveFont() }, '*'); } catch(e) {}
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-text-size', size: effectiveTextSize(), scale: suiteUiScale }, '*'); } catch(e) {}
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-motion', motion: effectiveMotion() }, '*'); } catch(e) {}
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-shadow', shadow: effectiveShadow() }, '*'); } catch(e) {}
    try { loadedFrames[id].contentWindow.postMessage({ type:'hub:set-company', company: currentCompanyBrand() }, '*'); } catch(e) {}
    hideOverlay();
    filterList();   // aggiorna dot "sessione attiva" + evidenziazione
    return;
  }

  // Controlla che il file sia stato rilevato
  if (!app.resolvedFile) {
    document.getElementById('error-msg').innerHTML =
      `Nessun file trovato per:<br><strong>${app.name}</strong>`;
    document.getElementById('error-hint').innerHTML =
      `Assicurati che nella cartella <strong>${folder.name}/</strong><br>` +
      `sia presente il file <strong>${app.file}</strong>`;
    document.getElementById('error-overlay').classList.add('show');
    currentId = null;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('app-bar').classList.remove('visible');
    document.getElementById('frames').classList.remove('visible');
    return;
  }

  // Carica il file dalla cartella (via adattatore: browser FS Access o Electron bridge)
  showOverlayBriefly(app.name);
  try {
    const html = await folder.readText(app.resolvedFile);

    const frame = document.createElement('iframe');
    frame.className   = 'app-frame';
    frame.title       = app.name;
    frame.sandbox     = 'allow-scripts allow-forms allow-same-origin allow-downloads allow-modals allow-popups';
    // Anti-flash: l'<html> del tool parte col PROPRIO tema (documentali light,
    // tecniche dark); l'hub inietta solo la data-palette di suite. Niente push del
    // tema al lancio (il tema è del tool); al load propaga solo la palette.
    frame.srcdoc      = injectSuiteThemeIntoHtml(html);
    frame.addEventListener('load', () => {
      try { frame.contentWindow.postMessage({ type:'hub:set-palette', palette: effectivePalette() }, '*'); } catch(e) {}
      try { frame.contentWindow.postMessage({ type:'hub:set-font', font: effectiveFont() }, '*'); } catch(e) {}
      try { frame.contentWindow.postMessage({ type:'hub:set-text-size', size: effectiveTextSize(), scale: suiteUiScale }, '*'); } catch(e) {}
      try { frame.contentWindow.postMessage({ type:'hub:set-motion', motion: effectiveMotion() }, '*'); } catch(e) {}
      try { frame.contentWindow.postMessage({ type:'hub:set-shadow', shadow: effectiveShadow() }, '*'); } catch(e) {}
      try { frame.contentWindow.postMessage({ type:'hub:set-company', company: currentCompanyBrand() }, '*'); } catch(e) {}
      pushStateToFrame(frame);
      flushPendingRestore(id, frame);
    });
    document.getElementById('frames').appendChild(frame);
    loadedFrames[id] = frame;
    requestAnimationFrame(() => frame.classList.add('active'));
    showOverlayBriefly(app.name);
    filterList();   // aggiorna dot "sessione attiva" nella sidebar

  } catch(err) {
    hideOverlay();
    // File non trovato nella cartella
    document.getElementById('error-msg').innerHTML =
      `Errore durante il caricamento di:<br><strong>${app.resolvedFile}</strong>`;
    document.getElementById('error-hint').innerHTML =
      `Il file è stato rilevato ma non è stato possibile leggerlo.<br>` +
      `Cartella: <strong>${folder ? folder.name : 'EHub'}/</strong>`;
    document.getElementById('error-overlay').classList.add('show');
    // Resetta lo stato
    currentId = null;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('app-bar').classList.remove('visible');
    document.getElementById('frames').classList.remove('visible');
  }
}

/* ══════════════════════════════════════════════
   OVERLAY CARICAMENTO
   ══════════════════════════════════════════════ */
export function showOverlayBriefly(name) {
  document.getElementById('loading-name').textContent = name;
  document.getElementById('loading-overlay').classList.add('show');
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(hideOverlay, 700);
}
export function hideOverlay() {
  clearTimeout(overlayTimer);
  document.getElementById('loading-overlay').classList.remove('show');
}

/* ══════════════════════════════════════════════
   RELOAD APP
   ══════════════════════════════════════════════ */
export function reloadApp() {
  if (!currentId) return;
  const f = loadedFrames[currentId];
  if (f) { f.remove(); delete loadedFrames[currentId]; }
  launchApp(currentId);
}

/* Chiude la sessione di un tool dal welcome: scarica il frame (lo stato non
   salvato va perso) previo avviso. Se il progetto Open E.Hub ha modifiche non salvate
   l'avviso è esplicito (offre di annullare per salvare con "Salva progetto"). */
export function closeSession(id, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const f = loadedFrames[id];
  if (!f) return;
  const app = APP_REGISTRY.find(a => a.id === id);
  const name = (app && app.name) || id;
  const msg = projectDirty
    ? `"${name}" ha una sessione attiva e il progetto Open E.Hub ha modifiche non salvate.\n\nChiudendo la sessione lo stato non salvato andrà perso.\nAnnulla per salvarlo prima ("Salva progetto").\n\nChiudere comunque?`
    : `Chiudere la sessione di "${name}"?\nLo stato corrente di questa sessione andrà perso.`;
  if (!window.confirm(msg)) return;
  if (currentId === id) goHome();
  f.remove();
  delete loadedFrames[id];
  filterList();          // aggiorna l'indicatore "attiva" nella lista
  renderWelcomeCards();  // e nelle card del welcome
}

/* ══════════════════════════════════════════════
   GO HOME
   ══════════════════════════════════════════════ */
export function goHome() {
  if (!currentId && !document.getElementById('error-overlay').classList.contains('show')) return;
  currentId = null;
  // Tornati alla home: ripristina il tema del contesto hub.
  setContextTool('hub');
  applyContextTheme();
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('app-bar').classList.remove('visible');
  document.getElementById('frames').classList.remove('visible');
  document.getElementById('welcome').classList.remove('hidden');
  document.getElementById('error-overlay').classList.remove('show');
  renderWelcomeCards();
  setFocusIndex(-1);
  syncProjectGate();
}
