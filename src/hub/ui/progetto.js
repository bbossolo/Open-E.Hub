/* hub — Progetto Open E.Hub (.ehub): raccolta dello stato dai tool, salvataggio,
   apertura, nuovo progetto e ripristino differito. */
import { bundleEhubProject, ehubProjectToolCount, parseEhubProject } from '../../shared/ehub-project'
import { openModal } from '../../shared/ui/components/modal'
import { APP_REGISTRY } from '../data/registry'
import { emptySharedPlan, ensureProjectId, normalizeSharedPlan, setProjectIdentity } from '../engine/index'
import { _dxfMissing, ensureDxfText, fullSharedPlan, hubState, persistHubState, relayToFrames, setHubState, syncProjectGate } from './bus.js'
import { goHome, launchApp, loadedFrames } from './frames.js'
import { hubToast } from './shell.js'

/* ══════════════════════════════════════════════
   PROGETTO E.HUB — salva/apri l'intero stato del programma in un file .ehub.
   L'hub chiede a ogni tool caricato il suo stato pieno (hub:collect-state →
   app:full-state), lo impacchetta (shared/ehub-project) e lo scarica. All'apertura
   ridistribuisce gli stati ai tool (hub:restore-state), anche al loro caricamento.
   ══════════════════════════════════════════════ */
export let _collector = null;                 // raccolta in corso degli stati (Promise)
export const pendingRestore = Object.create(null); // appId → stato da ripristinare al load

// Id stabile del progetto Open E.Hub corrente (identità di ISTANZA UNICA).
export function genProjectId() { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

// Stato "modifiche non salvate": il pulsante Salva si colora finché lo stato
// del programma è cambiato dall'ultimo salvataggio/apertura di un progetto.
export let projectDirty = false;
export let _suppressDirtyUntil = Date.now() + 3000; // ignora gli update di avvio/ripristino
export function updateSaveButtons() {
  document.querySelectorAll('.js-save-project').forEach(b => b.classList.toggle('dirty', projectDirty));
}
export function markProjectDirty() {
  if (Date.now() < _suppressDirtyUntil) return;
  if (!projectDirty) { projectDirty = true; updateSaveButtons(); }
}
export function markProjectSaved() {
  if (projectDirty) { projectDirty = false; updateSaveButtons(); }
  else updateSaveButtons();
}

export function dlHub(content, name, type) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Chiede lo stato pieno a tutti i frame caricati; risolve quando tutti hanno
   risposto o allo scadere del timeout (i tool senza supporto non rispondono). */
/* Timeout generoso: 500 ms bastano coi tool leggeri, ma un tool che serializza
   una tavola DXF vera (megabyte di layer/blocchi/testi) risponde dopo, e il
   .ehub finirebbe scritto SENZA quel tool. C'è comunque l'early-finish quando
   tutti i frame hanno risposto: il timeout lungo paga solo se un tool è muto. */
export function collectFullState(timeoutMs = 8000) {
  return new Promise(resolve => {
    const expected = Object.keys(loadedFrames);
    if (!expected.length) { resolve({}); return; }
    const states = {};
    const finish = () => { if (!_collector) return; _collector = null; resolve(states); };
    _collector = { states, expected, finish, timer: setTimeout(finish, timeoutMs) };
    relayToFrames({ type: 'hub:collect-state' });
  });
}

/* «Salva con nome»: chiede il NOME del progetto e la CARTELLA di destinazione,
   poi salva. Su Electron usa chooseProjectDir (dialog nativo). */
export async function saveEhubProjectAs() {
  // Qui c'era una `window.prompt()`. In Electron NON esiste: ritorna sempre null, quindi
  // la funzione usciva subito e «Salva con nome» non faceva assolutamente nulla — senza
  // nemmeno un messaggio. Si usa il modal condiviso, come ovunque nell'hub.
  const input = document.createElement('input');
  input.className = 'ehb-input';
  input.style.width = '100%';
  input.value = hubState.name || 'progetto';
  input.setAttribute('aria-label', 'Nome del progetto');
  const choice = await openModal({
    title: 'Salva con nome',
    body: input,
    actions: [
      { label: 'Annulla', variant: 'ghost', value: 'cancel' },
      { label: 'Salva', variant: 'accent', value: 'ok' },
    ],
  });
  if (choice !== 'ok') return;
  const nm = (input.value || '').trim();
  if (nm) setHubState(setProjectIdentity(hubState, hubState.id, nm));
  if (window.ehubNative && window.ehubNative.chooseProjectDir) {
    const r = await window.ehubNative.chooseProjectDir();
    if (r && r.canceled) { hubToast('Salvataggio annullato', { warn: true }); return; }
  }
  await saveEhubProject();
}
export async function saveEhubProject() {
  hubToast('Raccolta stato dei tool…');
  const states = await collectFullState();
  if (!Object.keys(states).length) {
    hubToast('Niente da salvare: apri e usa almeno un tool', { warn: true });
    return;
  }
  // Il progetto corrente ha un'identità stabile (id) e un nome → nel bundle.
  setHubState(ensureProjectId(hubState, genProjectId));
  persistHubState();
  // XREF: assicura il testo (dalla cache o riletto dal ref) e passalo al bundle;
  // se c'è un `ref` i byte NON finiscono nel file (solo il riferimento), altrimenti
  // (fallback web) vengono incorporati.
  await ensureDxfText();
  const bundle = bundleEhubProject(states, { now: Date.now(), name: hubState.name || undefined, sharedPlan: fullSharedPlan() });
  const stamp = new Date().toISOString().slice(0, 10);
  const content = JSON.stringify(bundle, null, 2);
  const safeName = (hubState.name || 'progetto').replace(/[^\w.-]+/g, '_');
  const filename = `${safeName}-${stamp}.ehub`;
  const n = ehubProjectToolCount(bundle);
  // Electron: scrive nella cartella scelta (chiesta la prima volta). Browser: download.
  if (window.ehubNative && window.ehubNative.saveProject) {
    const res = await window.ehubNative.saveProject(filename, content);
    if (res && res.path) { markProjectSaved(); hubToast(`Progetto salvato (${n} tool) → ${res.path}`); }
    else if (res && res.canceled) hubToast('Salvataggio annullato', { warn: true });
    else hubToast('Errore nel salvataggio' + (res && res.error ? `: ${res.error}` : ''), { warn: true });
    return;
  }
  dlHub(content, filename, 'application/json');
  markProjectSaved();
  hubToast(`Progetto Open E.Hub salvato — ${n} tool`);
}

/* Chiede cosa fare delle modifiche non salvate PRIMA di azzerare la sessione
   (nuovo progetto o logout): un solo dialogo a 3 scelte (Salva/Scarta/Annulla)
   invece di due `confirm()` in sequenza — con `confirm()` premere "Annulla" sul
   primo ne apriva subito un secondo, percepito come una doppia richiesta.
   Ritorna true se si può procedere (salvato o scartato di proposito), false se
   l'utente ha annullato l'operazione. */
export async function confirmDiscardUnsaved(title) {
  if (!projectDirty) return true;
  const choice = await openModal({
    title,
    message: 'Il progetto Open E.Hub corrente ha modifiche non salvate.',
    actions: [
      { label: 'Annulla', variant: 'ghost', value: 'cancel' },
      { label: 'Scarta', value: 'discard' },
      { label: 'Salva', variant: 'accent', value: 'save' },
    ],
  });
  if (choice === 'save') { await saveEhubProject(); return true; }
  if (choice === 'discard') return true;
  hubToast('Operazione annullata', { warn: true });
  return false;
}
/* Azzera identità e stato per-tool in memoria (nuova istanza di progetto) — nucleo
   condiviso da «Nuovo progetto» e dal logout: niente stato di un utente
   visibile al successivo su una macchina condivisa. */
export function resetProjectSession() {
  setHubState(ensureProjectId(setProjectIdentity({ ...hubState, tools: {}, sharedPlan: emptySharedPlan() }, null, null), genProjectId));
  persistHubState();
  for (const k in pendingRestore) delete pendingRestore[k];
  markProjectSaved();
}
/* Nuovo progetto: riparte da zero. Se ci sono tool aperti ricarica l'hub (i tool
   ripartono vuoti: il progetto non è persistito per-tool); altrimenti torna alla home. */
export async function newEhubProject() {
  if (!(await confirmDiscardUnsaved('Nuovo progetto'))) return;
  resetProjectSession();
  syncProjectGate();   // id assegnato: chiude il project-gate se era aperto
  if (Object.keys(loadedFrames).length > 0) { window.location.reload(); return; }
  goHome();
  hubToast('Nuovo progetto — si riparte da zero');
}

export function openEhubProject() {
  const inp = document.getElementById('ehub-file');
  if (inp) inp.click();
}

export function onEhubFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    let bundle;
    try { bundle = parseEhubProject(String(ev.target.result)); }
    catch (err) { hubToast((err && err.message) || 'File progetto non valido', { warn: true }); return; }
    applyEhubProject(bundle);
  };
  r.onerror = () => hubToast('Impossibile leggere il file', { warn: true });
  r.readAsText(file);
}

export async function applyEhubProject(bundle) {
  const tools = bundle.tools || {};
  const ids = Object.keys(tools).filter(id => APP_REGISTRY.some(a => a.id === id));
  if (!ids.length) { hubToast('Progetto privo di tool riconosciuti', { warn: true }); return; }
  // GUARDIA IMPORT a livello Open E.Hub — aprire un progetto con modifiche non salvate chiede
  // conferma esplicita (salva prima / scarta / annulla), così non si perde lavoro né si mescolano
  // istanze. Disponibile solo con conferme native del browser/Electron.
  if (projectDirty && typeof window.confirm === 'function') {
    const salva = window.confirm(
      'Il progetto Open E.Hub corrente ha modifiche non salvate.\n\n' +
      'OK = SALVA prima di aprire\nAnnulla = scegli se scartarle');
    if (salva) {
      await saveEhubProject();
    } else {
      const scarta = window.confirm(
        'Aprire il nuovo progetto SCARTANDO le modifiche non salvate?\n\n' +
        'OK = scarta e apri\nAnnulla = annulla apertura');
      if (!scarta) { hubToast('Apertura annullata', { warn: true }); return; }
    }
  }
  // Aprire un .ehub stabilisce l'ISTANZA del progetto corrente (nuova identità + nome).
  // Lo stato per-appId riparte pulito: i tool ripubblicano il proprio progetto al ripristino.
  // Planimetria UNICA di Progetto: ripristinata a livello project-global (non è
  // sotto `tools`), poi relayata ai tool già aperti; quelli lanciati dopo la
  // ricevono via pushStateToFrame al load.
  setHubState(ensureProjectId(setProjectIdentity({ ...hubState, tools: {}, sharedPlan: normalizeSharedPlan(bundle.sharedPlan) }, null, bundle.name || null), genProjectId));
  syncProjectGate();   // .ehub aperto con successo: chiude il project-gate se era aperto
  persistHubState();
  // Appena caricato = allineato al file: non "non salvato". Sopprime gli update
  // indotti dal ripristino (un tool che ripubblica il proprio stato) per ~2.5s.
  _suppressDirtyUntil = Date.now() + 2500;
  markProjectSaved();
  // XREF: se lo sfondo è un riferimento, controlla che il file sia ancora al suo posto.
  // Se non esiste più → avviso esplicito (niente più sparizione in silenzio).
  ensureDxfText().then(() => {
    if (_dxfMissing) {
      const d = hubState.sharedPlan && hubState.sharedPlan.dxf;
      const nm = (d && (d.name || d.ref)) || 'planimetria';
      hubToast(`Planimetria di progetto non trovata: ${nm}. Le geometrie sono al loro posto — reimporta il DXF.`, { warn: true });
    }
    relayToFrames({ type: 'hub:shared-plan', plan: fullSharedPlan() });
  });
  for (const id of ids) {
    if (loadedFrames[id]) {
      try { loadedFrames[id].contentWindow.postMessage({ type: 'hub:restore-state', appId: id, state: tools[id] }, '*'); } catch (e) {}
    } else {
      pendingRestore[id] = tools[id];        // ripristinato quando il tool verrà aperto
    }
  }
  hubToast(`Progetto caricato — ${ids.length} tool ripristinati`);
  await launchApp(ids[0]);                    // mostra il primo tool del progetto
}

/* Al caricamento di un frame: se c'è uno stato in attesa per quel tool, applicalo. */
export function flushPendingRestore(id, frame) {
  if (!(id in pendingRestore)) return;
  const state = pendingRestore[id];
  delete pendingRestore[id];
  try { frame.contentWindow.postMessage({ type: 'hub:restore-state', appId: id, state }, '*'); } catch (e) {}
}
