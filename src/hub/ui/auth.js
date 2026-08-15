/* hub — utenti, profilo (fisso, locale), sessione e visibilità dei tool per utente. */
import { writeAuth } from '../../shared/session-profile'
import { companyLogoHtml, findCompany } from '../data/companies'
import { APP_REGISTRY } from '../data/registry'
import { findUser, normalizeUsers } from '../data/users'
import { filterApps, isToolVisible, profileLabel } from '../engine/index'
import { applyFont, broadcastFont, resolveFont, suiteFont } from './aspetto.js'
import { loadedFrames } from './frames.js'
import { refreshProfileUI } from './guida.js'
import { renderList, renderWelcomeCards } from './navigazione.js'
import { escHtml } from './shell.js'

/* ── Profilo (mono-studio locale, nessun login) ──
   Open E.Hub è per un singolo studio self-hosted: non c'è login né sessione
   da scadere. All'avvio si entra sempre con un profilo admin locale fisso,
   scritto in sessionStorage (vedi shared/session-profile) così i tool aperti
   in iframe (stessa origine) lo riconoscono — usato in particolare dal gate
   difensivo di α (Centro di controllo), che va protetto anche aprendo il suo
   HTML direttamente fuori dall'hub. */
export let authProfile = null;

/* ── Utenti aziendali (PREDISPOSIZIONE locale, gestiti dall'admin) ──
   Store in localStorage['hub:users'], seminato da SEED_USERS al primo avvio.
   L'admin li gestisce dal pannello; il login aziendale li riconosce. */
export const USERS_KEY = 'hub:users';
export let hubUsers = [];
export function loadUsers() {
  try { hubUsers = normalizeUsers(JSON.parse(localStorage.getItem(USERS_KEY) || 'null')); }
  catch (e) { hubUsers = normalizeUsers(null); }
}
export function persistUsers() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(hubUsers)); } catch (e) {}
}

/* Utente company loggato (se c'è), dal registro utenti locale. */
export function currentHubUser() {
  return (authProfile && authProfile.companyId)
    ? findUser(hubUsers, authProfile.companyId, authProfile.utente)
    : null;
}
/* Logica PURA in src/hub/engine/visibility.ts (testata): tutti i tool sono
   visibili di default, l'unico gate è `adminOnly` (solo admin). */
export function isToolEnabledForCurrentUser(id) {
  const app = APP_REGISTRY.find(a => a.id === id);
  if (!app) return false;
  return isToolVisible(app, { isAdmin: !!(authProfile && authProfile.role === 'admin') });
}
export function enabledApps() { return APP_REGISTRY.filter(a => isToolEnabledForCurrentUser(a.id)); }
/* Ridisegna lista, welcome e conteggio secondo i flag correnti. */
export function refreshToolVisibility() {
  const q = (document.getElementById('search') || {}).value || '';
  renderList(filterApps(enabledApps(), q));
  renderWelcomeCards();
  const sn = document.getElementById('stat-n'); if (sn) sn.textContent = enabledApps().length;
}
export const USER_ICON = '<svg class="prof-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
/* Impostazioni: icona utente + AZIENDA (o «Amministratore»), SENZA username.
   Logo azienda discreto nel footer solo per i profili aziendali (admin → niente). */
export function renderAuthProfile() {
  const row = document.getElementById('set-profile');
  const who = document.getElementById('set-prof-who');
  const adminBtn = document.getElementById('set-prof-admin');
  const sideCo = document.getElementById('side-company');
  if (!row || !who) return;
  if (!authProfile) {
    row.hidden = true;
    if (sideCo) { sideCo.hidden = true; sideCo.innerHTML = ''; }
    return;
  }
  who.innerHTML = `${USER_ICON}<span class="set-prof__name">${profileLabel(authProfile)}</span>`;
  row.hidden = false;
  if (adminBtn) adminBtn.hidden = authProfile.role !== 'admin';
  const company = authProfile.companyId ? findCompany(authProfile.companyId) : null;
  if (sideCo) {
    // Chi sono, SEMPRE: nome utente in evidenza + azienda sotto (quando c'è).
    // Il footer compare anche per i profili SENZA azienda e per l'admin, che
    // prima non vedevano nulla: su una macchina condivisa dev'essere sempre
    // leggibile con quale identità si sta lavorando.
    const chi = escHtml((authProfile.utente || '').trim());
    const sotto = company ? escHtml(company.name) : (authProfile.role === 'admin' ? 'Amministratore' : 'Profilo personale');
    const logo = company ? companyLogoHtml(company, 'side-co__logo') : USER_ICON;
    if (chi || company) {
      sideCo.innerHTML = `${logo}<span class="side-co__txt"><span class="side-co__user">${chi || sotto}</span>${chi ? `<span class="side-co__name">${sotto}</span>` : ''}</span>`;
      sideCo.hidden = false;
    } else { sideCo.hidden = true; sideCo.innerHTML = ''; }
  }
}
/* Brand azienda per le STAMPE dei tool: ragione sociale + indirizzo +
   HTML del logo (template/immagine). null per admin (nessuna intestazione). */
export function currentCompanyBrand() {
  const co = authProfile && authProfile.companyId ? findCompany(authProfile.companyId) : null;
  if (!co) return null;
  return { name: co.name, address: co.address || '', logoHtml: companyLogoHtml(co) };
}
/* Propaga l'azienda a TUTTI i frame aperti (via bus). I tool la useranno nei documenti. */
export function broadcastCompany() {
  const company = currentCompanyBrand();
  Object.values(loadedFrames).forEach(f => {
    try { f.contentWindow.postMessage({ type: 'hub:set-company', company }, '*'); } catch (e) {}
  });
}

/* Nessun login, nessun logout: Open E.Hub è mono-studio locale, si entra
   sempre con un profilo admin locale fisso (vedi initAuth). */

/* Avvio: nessun gate. Il profilo admin locale è sintetizzato subito e scritto
   in sessionStorage (vedi shared/session-profile) — così i tool caricati in
   iframe dall'hub (stessa origine) lo trovano, in particolare il gate
   difensivo di α (Centro di controllo) se il suo HTML viene aperto fuori
   dall'hub. Un gate lato client offline non sarebbe comunque un confine di
   sicurezza reale: qui serve solo a riconoscere "sono stato aperto dall'hub". */
export function initAuth() {
  loadUsers();
  authProfile = { azienda: 'admin', utente: 'admin', role: 'admin', companyId: null, ts: Date.now() };
  writeAuth(authProfile);
  resolveFont(); applyFont(); broadcastFont(suiteFont);
  renderAuthProfile();
  refreshProfileUI();
}
