/* ═══════════════════════════════════════════════════════
   HUB — punto d'ingresso.

   APP_REGISTRY e la logica pura (parseVersionFromFilename, resolveFiles,
   filterApps) vivono in src/hub/{data,engine}/, coperti dai test (tests/hub/):
   single source of truth. Lo strato DOM/iframe/bus/tema, un tempo tutto qui,
   è ora in ui/ — un modulo per tema. Questo file resta il BARREL: import,
   registrazione delle guide, wiring di avvio e, in coda, l'esposizione su
   window degli handler richiamati dagli attributi inline di index.html.

   Gli import fra moduli ui/ sono CIRCOLARI e va bene: i nomi si usano solo
   dentro i corpi funzione, mai al top-level, quindi i live-binding ESM sono già
   risolti quando parte il primo handler.
   ═══════════════════════════════════════════════════════ */
import { initAnalytics } from '../shared/analytics'
import { UNSIGNED_NOTICE } from '../shared/edition'
import { bindGuideShortcut } from '../shared/ui/components/index'
import { registerGuide } from '../shared/ui/guide'
import { BETA_GUIDE } from '../tools/beta/data/guida'
import { CHI_GUIDE } from '../tools/chi/data/guida'
import { DELTA_GUIDE } from '../tools/delta/data/guida'
import { MIU_GUIDE } from '../tools/miu/data/guida'
import { HUB_GUIDE } from './data/guida'
import { applyDensity, applyFont, applyMotion, applyShadow, applyTextSize, nudgeUiScale, setDensity, setFont, setMotion, setShadow, setTextSize, setUiScale, setUiScalePct } from './ui/aspetto.js'
import { enabledApps, initAuth } from './ui/auth.js'
import { backupEsporta, backupEsportaCsv, backupImporta, closeBackup, openBackup } from './ui/backup.js'
import { syncProjectGate } from './ui/bus.js'
import { closeSession, goHome, initFolder, launchApp, reloadApp } from './ui/frames.js'
import { closeAppearance, closeCredits, closeGuide, closeLegal, initHubExtras, openAppearance, openCredits, openGuide, openLegal, startHubTour } from './ui/guida.js'
import { filterList, renderList, renderWelcomeCards } from './ui/navigazione.js'
import { newEhubProject, onEhubFile, openEhubProject, saveEhubProject, saveEhubProjectAs } from './ui/progetto.js'
import { hubToast, toggleSidebar } from './ui/shell.js'
import { applyContextTheme, closeFontMenu, closePaletteMenu, closeSettings, setContextTool, setPalette, setTheme, toggleSettings, toggleTheme } from './ui/tema.js'
initAnalytics()

/* Manuale unico: l'hub aggrega la propria sezione + quelle di TUTTI i tool,
   così la home mostra la guida completa organizzata per tool (indice a capitoli). */
registerGuide({ ...HUB_GUIDE, onTour: () => startHubTour() });
[MIU_GUIDE, BETA_GUIDE, DELTA_GUIDE, CHI_GUIDE].forEach((g) => registerGuide(g));
bindGuideShortcut('hub');

document.addEventListener('DOMContentLoaded', () => {
  // Tema: UNICO per la suite. Finché l'utente non sceglie a mano segue il
  // sistema (prefers-color-scheme); poi vale la sua scelta, ricordata in
  // localStorage('hub:theme'). Vale per hub e per tutti i tool: niente più
  // sbalzo scuro↔chiaro navigando tra le app.
  setContextTool('hub');
  applyContextTheme();
  // Sidebar
  // Sidebar sempre chiusa all'avvio (le tiles fanno da launcher).
  // L'utente può aprirla con B durante la sessione.
  document.getElementById('sidebar').classList.add('collapsed');

  // Render iniziale (prima della risoluzione file)
  renderList(enabledApps());
  renderWelcomeCards();
  document.getElementById('stat-n').textContent = enabledApps().length;
  initHubExtras();   // include il footer edizione via refreshProfileUI()
  // .exe desktop NON firmato (solo Electron): avviso minimal d'uso all'avvio.
  // Nella web build servita sulla VM il bridge non c'è → nessun toast.
  if (window.ehubNative) setTimeout(() => hubToast(UNSIGNED_NOTICE, { variant: 'bad' }), 700);

  // Risolvi subito i tool: bridge Electron (desktop) o fetch relativo (edizione web).
  initFolder();

  // Densità UI applicata all'avvio + stato attivo dei controlli settings.
  applyDensity();
  // Font di sistema applicato all'avvio + stato attivo del selettore.
  applyFont();
  // Dimensione testo applicata all'avvio + stato attivo del selettore.
  applyTextSize();
  // Riduzione animazioni / intensità ombre: applicati all'avvio + stato attivo dei selettori.
  applyMotion();
  applyShadow();

  // Login aziendale (gate all'avvio, bypassabile) + profilo locale.
  initAuth();
  // Project gate: dopo il login (edizione server) o subito (edizione desktop),
  // mostra la scelta obbligata Nuovo/Apri progetto se non c'è un progetto attivo.
  syncProjectGate();

  // Clic su un punto "morto" della sidebar (non su nav/pulsanti/input/
  // settings) espande/collassa. Gli elementi interattivi restano intatti.
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) sidebarEl.addEventListener('click', e => {
    if (e.target.closest('a, button, input, select, textarea, [role="button"], [onclick], #settingsPanel, .nav-item')) return;
    toggleSidebar();
  });

  // Tendine palette/font e pannello Impostazioni: chiusura su click fuori o Esc.
  document.addEventListener('click', e => {
    const settings = document.getElementById('side-settings');
    if (settings && !settings.contains(e.target)) { closeSettings(); closePaletteMenu(); closeFontMenu(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePaletteMenu(); closeFontMenu(); closeSettings(); } });
});

// ── STEP 5 — esposizione su window delle funzioni richiamate dagli handler
// inline (onclick/onkeydown/oninput nel markup e nei template di renderList/
// renderWelcomeCards). Necessaria ora che questo script è un modulo ES (le
// funzioni top-level non sono globali). Comportamento invariato.
Object.assign(window, {
  openBackup, closeBackup, backupEsporta, backupEsportaCsv, backupImporta,
  launchApp, filterList, goHome, reloadApp, closeSession,
  setTheme, setPalette, toggleTheme, toggleSidebar,
  toggleSettings, closeSettings, setDensity, setFont, setTextSize, setUiScale, setUiScalePct, nudgeUiScale, setMotion, setShadow,
  openGuide, closeGuide, startHubTour, openLegal, closeLegal, openCredits, closeCredits,
  openAppearance, closeAppearance,
  saveEhubProject, saveEhubProjectAs, openEhubProject, onEhubFile, newEhubProject,
});

