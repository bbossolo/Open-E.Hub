/* hub — extra della cornice: versione ed edizione, protip, guida F1, tour,
   note legali, crediti, cambio password, aspetto. */
import { valida } from '../../shared/memoria-studio'
import { closeGuide as closeGuideShared, toggleGuide } from '../../shared/ui/components/index'
import { startTour } from '../../shared/ui/components/tour'
import { companyLogoHtml, findCompany } from '../data/companies'
import { creditsNoticeHTML } from '../data/credits'
import { legalNoticeHTML } from '../data/legal'
import { HUB_TOUR } from '../data/tour'
import { authProfile } from './auth.js'
import { escHtml } from './shell.js'
import { closeFontMenu, closePaletteMenu, closeSettings } from './tema.js'

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
/* ══ Extra hub: versione + crediti (indipendenti dal profilo) ══
   Il footer edizione dipende dal PROFILO al login → refreshProfileUI(),
   rieseguita anche a login/logout. */
export function initHubExtras() {
  const V = window.EHUB_VERSIONS; if (!V) return;

  // Versione hub/app (sidebar-footer) — guida output e tag GitHub
  const hv = document.getElementById('stat-hubver'); if (hv) hv.textContent = V.app.version;

  // I crediti sono ora in un modale dedicato (openCredits), come le Note legali.
  refreshProfileUI();
}

/* Protip + footer edizione, in funzione del PROFILO al login (logo azienda nel
   footer per il profilo aziendale). Rieseguibile: chiamata all'avvio (initAuth)
   e a ogni login/logout. */
export let _protipTimer = null;
export function refreshProfileUI() {
  const role = authProfile && authProfile.role;
  renderProtips();
  renderEdition(role);
}

/* Protip a rotazione (tutti i profili), generici e statici. Un solo timer alla volta. */
export function renderProtips() {
  const pt = document.getElementById('hub-protip');
  if (!pt) return;
  if (_protipTimer) { clearInterval(_protipTimer); _protipTimer = null; }
  const tips = buildProtips();
  let i = 0;
  const show = () => {
    pt.style.opacity = '0';
    setTimeout(() => { pt.innerHTML = '<span class="tip-tag">✦ Protip</span> · ' + tips[i % tips.length]; pt.title = pt.textContent; pt.style.opacity = '1'; i++; }, 300);
  };
  show(); _protipTimer = setInterval(show, 6500);
}

/* Protip: suggerimenti d'uso generici e statici, uguali per tutti i profili
   Si aggiornano a mano, su richiesta. */
export function buildProtips() {
  // Tip brevi (una riga sola: vengono troncati con ellissi se eccedono).
  return [
    'Premi <b>/</b> per cercare subito un tool.',
    'Premi <b>T</b> per il tema chiaro/scuro, <b>B</b> per il menu laterale.',
    'In <b>μ Prezzi</b> cerca la voce a parole tue: «cavo fg16 3x2.5» basta e avanza.',
    'Il computo di <b>μ Prezzi</b> passa in <b>β Contabilità</b> e diventa SAL e libretto delle misure.',
    'In <b>χ Refs</b> smisti i layer di una base DXF altrui senza sporcare il tuo standard.',
    'Con <b>δ Copertine</b> l\'elenco delle tavole diventa un unico PDF di frontespizi.',
    'Ogni tool ha la <b>Guida</b> rossa in alto a destra: parti da lì.',
    'Con <b>Salva progetto</b> raccogli tutti i tool aperti in un file <b>.ehub</b>.',
  ];
}

/* Guida rapida Open E.Hub: cos'è la suite, come si passano i dati tra i tool, progetto .ehub. */
export function openGuide() { toggleGuide('hub'); }
export function closeGuide() { closeGuideShared(); }

/* Tour guidato della home: richiamabile a mano dalla Guida, o avviato da solo al primo accesso (non-admin).
   La sidebar parte sempre COLLASSATA: in quello stato #search-wrap è display:none e #brand-mark
   ha un layout diverso (icon-rail) — va espansa prima, altrimenti metà degli step punta a elementi nascosti/spostati. */
export function expandSidebarForTour() { document.getElementById('sidebar')?.classList.remove('collapsed'); }
export function startHubTour() { expandSidebarForTour(); startTour(HUB_TOUR); }

/* Note legali: app "così com'è" + marchi di terzi citati a fini di interoperabilità.
   Testo centralizzato in data/legal; NON compare nei documenti tecnici esportati. */
export function openLegal() {
  const body = document.getElementById('legal-body');
  if (body && !body.innerHTML.trim()) body.innerHTML = legalNoticeHTML();
  document.getElementById('legal-overlay')?.classList.add('open');
}
export function closeLegal() { document.getElementById('legal-overlay')?.classList.remove('open'); }

/* Crediti: autore (developer ID), sviluppo assistito da AI e tutela della proprietà
   intellettuale (software proprietario, non diffusione). Modale a sé, come le Note legali. */
export function openCredits() {
  const body = document.getElementById('credits-body');
  const V = window.EHUB_VERSIONS;
  if (body && !body.innerHTML.trim() && V) {
    body.innerHTML = creditsNoticeHTML(V.developer, { year: new Date().getFullYear() });
  }
  document.getElementById('credits-overlay')?.classList.add('open');
}
export function closeCredits() { document.getElementById('credits-overlay')?.classList.remove('open'); }

export function openAppearance() {
  closeSettings();
  document.getElementById('appearance-overlay')?.classList.add('open');
}
export function closeAppearance() {
  closePaletteMenu(); closeFontMenu();
  document.getElementById('appearance-overlay')?.classList.remove('open');
}

/* ══ Footer edizione (#hub-edition) — guidato dal PROFILO al login ══
   - admin    → badge "Amministratore" (riusa lo stile developer);
   - aziendale → logo azienda + ragione sociale (riusa lo stile internal);
   - nessun profilo → footer vuoto (nessun badge di build). */
export function renderEdition(role) {
  const el = document.getElementById('hub-edition');
  if (!el) return;
  el.classList.remove('dev', 'internal', 'public', 'admin', 'company');
  const company = (authProfile && authProfile.companyId) ? findCompany(authProfile.companyId) : null;
  if (company) {
    // Profilo aziendale (utente O admin aziendale): logo + ragione sociale. Se è
    // admin aziendale aggiunge un piccolo marcatore.
    const adminTag = role === 'admin' ? '<span class="hub-edi-adm">admin</span>' : '';
    el.innerHTML = `${companyLogoHtml(company, 'hub-edi-logo')}<span class="hub-edi-badge internal">${escHtml(company.name)}</span>${adminTag}`;
    el.classList.add('internal', 'company');
  } else if (role === 'admin') {
    el.innerHTML = `<span class="hub-edi-badge dev">Amministratore</span>`;
    el.classList.add('dev', 'admin');
  } else {
    el.innerHTML = '';
  }
}
