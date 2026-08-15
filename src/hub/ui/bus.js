/* hub — il bus: stato condiviso fra i tool, planimetria di Progetto,
   ponte appunti verso Electron e listener dei messaggi dai frame. */
import { valida } from '../../shared/memoria-studio'
import { APP_REGISTRY } from '../data/registry'
import { emptyHubProjectState, projectStateMessages, setSharedDxf, setToolProject, sourceForApp, upsertShared } from '../engine/index'
import { loadUsers, refreshToolVisibility } from './auth.js'
import { goHome, hideOverlay, launchApp, loadedFrames } from './frames.js'
import { _collector, markProjectDirty } from './progetto.js'
import { setTheme, suiteTheme } from './tema.js'

/* ══════════════════════════════════════════════
   STATO CONDIVISO TRA APP (single source of truth)
   L'hub fa da bus: riceve lo stato da un'app e lo
   ritrasmette alle altre (es. un computo verso β Contabilità).
   ══════════════════════════════════════════════ */
// UNA istanza di progetto corrente — identità (id/name) + stato per-appId GENERICO
// (niente più phiProject/pricelistComputo/tauComputo hard-coded; inclusi pi/lambda e ogni tool).
export let hubState; // { id, name, tools: { [appId]: project } }
// AVVIO SEMPRE PULITO (richiesta utente: niente residui di altri progetti): l'app
// parte da un progetto NUOVO e vuoto; per riprendere un lavoro si usa «Apri
// progetto» (.ehub). Non si ripristina più silenziosamente la sessione precedente.
hubState = emptyHubProjectState();
try { localStorage.removeItem('hub:state'); } catch(e) {}

// Project gate: schermata a scelta obbligata (Nuovo/Apri progetto). Mostra/nasconde
// #project-gate secondo hubState.id — nessun login da attendere (mono-studio locale).
export function syncProjectGate() {
  const gate = document.getElementById('project-gate');
  if (!gate) return;
  gate.hidden = hubState.id !== null;
}

// ── Planimetria di Progetto come XREF ──────────────────────────────────────
// Sul bus viaggia SOLO L'IDENTITÀ della planimetria (percorso/nome/dimensione), MAI i
// byte del DXF. Prima li trasportava: l'hub li teneva in cache e li rimandava a ogni
// tool, che li riparsava. Con le tavole vere dello studio (240 MB) significa una copia
// da 240 MB per tool attraverso `postMessage` — non è lento, è impossibile. Adesso chi
// importa un file lo legge da sé, in locale, e sul canale annuncia solo QUALE
// planimetria è attiva. Su disco (.ehub/localStorage) non è mai cambiato nulla: lì il
// riferimento c'era già.
export let _dxfMissing = false;    // true = c'è un `ref` XREF ma il file non è più al suo posto
export function dxfKey(dxf) { return dxf ? (dxf.ref || `${dxf.name}:${dxf.size || 0}`) : null; }
export function dxfMetaOnly(dxf) { if (!dxf) return null; const { text, ...rest } = dxf; void text; return rest; }
// Verifica che l'xref sia ancora al suo posto — con uno `stat`, non leggendo il file
// (la vecchia versione si portava a casa 240 MB solo per sapere se esisteva).
export async function ensureDxfText() {
  _dxfMissing = false;
  const dxf = hubState.sharedPlan && hubState.sharedPlan.dxf;
  if (!dxf || !dxf.ref) return;
  if (!window.ehubNative || typeof window.ehubNative.statDxf !== 'function') return;
  try {
    const r = await window.ehubNative.statDxf(dxf.ref);
    _dxfMissing = !(r && r.exists);
  } catch(e) { _dxfMissing = true; }
}
// Planimetria condivisa per relay/replay ai tool: metadati dello sfondo, mai i byte.
export function fullSharedPlan() {
  const sp = hubState.sharedPlan;
  if (!sp || !sp.dxf) return sp;
  return { ...sp, dxf: { ...dxfMetaOnly(sp.dxf), missing: _dxfMissing && !!sp.dxf.ref } };
}
// Planimetria "leggera" (solo metadati sfondo): per gli aggiornamenti di sola
// geometria e per la persistenza (mai i byte del DXF).
export function lightSharedPlan(sp) { return sp ? { ...sp, dxf: dxfMetaOnly(sp.dxf) } : sp; }
export function persistHubState() {
  try {
    const light = { ...hubState, sharedPlan: lightSharedPlan(hubState.sharedPlan) };
    localStorage.setItem('hub:state', JSON.stringify(light));
  } catch(e) {}
}
export function relayToFrames(msg, exceptWindow) {
  Object.values(loadedFrames).forEach(f => {
    if (exceptWindow && f.contentWindow === exceptWindow) return;
    try { f.contentWindow.postMessage(msg, '*'); } catch(e) {}
  });
}
// Invia lo stato condiviso corrente a un singolo frame (al suo caricamento) — GENERICO per appId.
export async function pushStateToFrame(frame) {
  for (const m of projectStateMessages(hubState)) {
    try { frame.contentWindow.postMessage(m, '*'); } catch(e) {}
  }
  // Planimetria UNICA di Progetto: assicura il testo DXF (xref → rilettura da
  // disco) e invia lo sfondo + cavidotti/circuiti condivisi.
  await ensureDxfText();
  try { frame.contentWindow.postMessage({ type: 'hub:shared-plan', plan: fullSharedPlan(), replay: true }, '*'); } catch(e) {}
}

/* ══════════════════════════════════════════════
   POST MESSAGE BUS
   ══════════════════════════════════════════════ */
window.addEventListener('message', event => {
  // Sicurezza (edizione cloud): ascolta solo messaggi same-origin. In desktop/
  // Electron i tool sono caricati da file:// → origin '' o 'null': consentito.
  if (event.origin && event.origin !== 'null' && event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {

    case 'hub:navigate': if (msg.appId) launchApp(msg.appId); break;
    case 'hub:ready':    hideOverlay(); break;
    case 'hub:go-home':  goHome(); break;
    /* α ha mutato gli utenti in localStorage (stesso storage, altro iframe):
       l'hub ricarica la sua copia in-memory e ridisegna sidebar/home. */
    case 'app:admin-changed': loadUsers(); refreshToolVisibility(); break;
    case 'app:theme': {
      // Il modo è UNICO per la suite: il toggle DENTRO un tool cambia il
      // tema di TUTTA la suite (hub + altri tool aperti). Se il modo segnalato
      // coincide con quello corrente è solo l'eco di boot (il frame parte già col
      // modo iniettato) → non propagare e non "pinnare". Altrimenti è una scelta
      // esplicita dell'utente: pinna, persiste e propaga a tutti gli altri frame.
      if (msg.theme !== 'light' && msg.theme !== 'dark') break;
      if (msg.theme !== suiteTheme.mode) setTheme(msg.theme, { user: true, exceptWindow: event.source });
      break;
    }
    case 'app:ready': hideOverlay(); break;

    /* Risposta di un tool a hub:collect-state → accumula per il progetto Open E.Hub. */
    case 'app:full-state':
      if (_collector && msg.appId) {
        _collector.states[msg.appId] = msg.state;
        if (_collector.expected.every(id => id in _collector.states)) {
          clearTimeout(_collector.timer);
          _collector.finish();
        }
      }
      break;

    /* Un'app pubblica il proprio progetto → l'hub lo memorizza,
       lo persiste e lo ritrasmette alle altre. */
    case 'app:project-update': {
      // GENERICO per qualsiasi appId del registry (nessun ramo per-tool hard-coded).
      if (!msg.appId || !APP_REGISTRY.some(a => a.id === msg.appId)) break;
      markProjectDirty(); // un tool ha cambiato qualcosa → progetto non salvato
      hubState = setToolProject(hubState, msg.appId, msg.project || null);
      persistHubState();
      relayToFrames(
        { type:'hub:project-state', source: sourceForApp(msg.appId), project: hubState.tools[msg.appId] || null, appId: msg.appId },
        event.source);
      break;
    }

    /* Un'app chiede lo stato condiviso corrente (es. β all'avvio, per il computo di μ). */
    case 'app:request-state':
      try {
        // Replica lo stato di OGNI tool (i consumatori filtrano per `source`/`appId`).
        for (const m of projectStateMessages(hubState)) event.source.postMessage(m, '*');
        // Planimetria UNICA di Progetto (project-global): un solo messaggio, col
        // testo DXF assicurato dalla cache/xref.
        const src = event.source;
        ensureDxfText().then(() => { try { src.postMessage({ type: 'hub:shared-plan', plan: fullSharedPlan(), replay: true }, '*'); } catch(e) {} });
      } catch(e) {}
      break;

    /* Planimetria UNICA di Progetto: un tool importa un DXF o aggiorna i propri
       cavidotti/circuiti → l'hub aggiorna il campo project-global e lo ritrasmette
       a tutti gli altri tool (NON gated su APP_REGISTRY: è project-global). */
    case 'app:shared-plan-update': {
      if (!msg.origin) break;
      markProjectDirty();
      const hadDxf = ('dxf' in msg && msg.dxf !== undefined);
      if (hadDxf) {
        _dxfMissing = false;                                     // appena importato: il file c'è
        hubState = setSharedDxf(hubState, dxfMetaOnly(msg.dxf)); // solo ref/metadati (xref)
      }
      // POOL UNICO: upsert per id + delete espliciti (mai clobber su omissione).
      hubState = upsertShared(hubState, { cavidotti: msg.cavidotti, circuiti: msg.circuiti, scale: msg.scale, deleted: msg.deleted });
      persistHubState();
      const plan = hadDxf ? fullSharedPlan() : lightSharedPlan(hubState.sharedPlan);
      const relayMsg = { type: 'hub:shared-plan', plan };
      if (msg.deleted) relayMsg.deleted = msg.deleted; // delete cross-tool (anche nativi)
      // IMPORT UNIFICATO: quando arriva un DXF nuovo lo si rimanda a TUTTI, incluso
      // chi l'ha importato → un'unica via di visualizzazione (adozione dal canale
      // condiviso). Gli aggiornamenti di sola geometria escludono il mittente
      // (ha già i propri; riceve solo i «foreign» degli altri).
      if (hadDxf) relayToFrames(relayMsg);
      else relayToFrames(relayMsg, event.source);
      break;
    }
  }
});

/* Lo stato del Progetto lo riscrive anche progetto.js (apri/nuovo/salva). */
export function setHubState(v) { hubState = v }

