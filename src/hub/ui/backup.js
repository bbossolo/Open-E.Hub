/* hub — Backup dati: quello che Open E.Hub ha imparato lavorando (catalogo voci,
   dizionario blocchi, analisi prezzi) esportato e reimportato. */
import { readAuth } from '../../shared/session-profile'
import { PARTI, anteprima, catalogoCsv, chiaveDi, esporta, importa as importaMemoria, inventario, valida } from '../../shared/memoria-studio'
import { dlHub } from './progetto.js'
import { escHtml } from './shell.js'
import { closeSettings } from './tema.js'

/* Aspetto: menu grafico separato (palette, font, dimensione testo, densità, ombre,
   animazioni). I controlli sono gli stessi .set-row/.set-seg spostati qui: i gestori
   setFont/setPalette/… agiscono per classe/data-* globali → funzionano senza modifiche. */
/* ── BACKUP DATI ───────────────────────────────────────────────────────────────────────
   Lavorando, la suite impara: cos'è ogni blocco del CAD, quali sono legende e non si
   computano, come si computa un blocco, le voci composte con le loro Analisi Prezzi.
   È il capitale dello studio — vale più del singolo progetto, perché il progetto finisce
   e questo resta. Ma vive nel browser di UNA macchina: il collega non ce l'ha, il PC nuovo
   riparte da zero, e se il disco muore è perso. Il server aziendale risolverà tutto questo;
   finché non c'è, un file che si esporta e si importa è ciò che rende quel capitale
   trasferibile — e sarà esattamente il payload che il server sincronizzerà domani. */
export function bkCompanyId() {
  try { return (readAuth() || {}).companyId || null } catch { return null }
}
export function bkStudio() {
  try { const a = readAuth(); return (a && (a.companyName || a.companyId)) || 'studio' } catch { return 'studio' }
}
/** Le parti che l'utente ha spuntato (di default: tutte quelle che contengono qualcosa). */
export function bkPartiScelte() {
  return [...document.querySelectorAll('#bk-list input[type=checkbox]:checked')].map(c => c.dataset.id);
}
export function renderBackup() {
  const box = document.getElementById('bk-list'); if (!box) return;
  const inv = inventario(localStorage, bkCompanyId());
  const totale = inv.reduce((s, x) => s + x.n, 0);
  const warn = document.getElementById('bk-warn');
  if (warn) warn.hidden = totale > 0 ? false : true;
  box.innerHTML = inv.map(({ parte, n }) => `
    <label class="bk-row${n ? '' : ' is-vuota'}" title="${escHtml(parte.cosa)}">
      <input type="checkbox" data-id="${parte.id}" ${n ? 'checked' : 'disabled'}>
      <span class="bk-row__tool">${parte.tool}</span>
      <span class="bk-row__t">
        <b>${escHtml(parte.nome)}</b>
        <small>${escHtml(parte.cosa)}</small>
      </span>
      <span class="bk-row__n">${n ? n : '—'}</span>
    </label>`).join('')
    + (totale ? '' : '<div class="bk-empty">Non c\'è ancora niente da salvare. Si riempie da sé mentre usi i tool: quando dichiari in χ come si abbina un profilo, o scegli in μ la voce di prezzario che gli corrisponde.</div>');
}
export function openBackup() {
  closeSettings();
  renderBackup();
  document.getElementById('backup-overlay')?.classList.add('open');
}
export function closeBackup() { document.getElementById('backup-overlay')?.classList.remove('open'); }

export function backupEsporta() {
  const parti = bkPartiScelte();
  if (!parti.length) { alert('Scegli almeno una parte da salvare.'); return; }
  const dump = esporta(localStorage, { companyId: bkCompanyId(), studio: bkStudio(), parti });
  const oggi = new Date().toISOString().slice(0, 10);
  dlHub(JSON.stringify(dump, null, 2), `backup-ehub-${(bkCompanyId() || 'studio')}-${oggi}.json`, 'application/json');
}
/* Il catalogo in CSV: non è un doppione del backup — è il formato in cui lo studio lo
   VERIFICA. Si apre in Excel, si guarda riga per riga, si trova l'errore. Un JSON non lo
   rilegge nessuno. */
export function backupEsportaCsv() {
  let cat = null;
  try { cat = JSON.parse(localStorage.getItem(chiaveDi(PARTI.find(p => p.id === 'catalogo-voci'), bkCompanyId())) || 'null'); } catch (e) { /* illeggibile */ }
  const csv = catalogoCsv(cat);
  if (csv.split('\n').length <= 1) { alert('Il catalogo è vuoto: non c\'è ancora nessun blocco agganciato a una voce.'); return; }
  const oggi = new Date().toISOString().slice(0, 10);
  dlHub('\ufeff' + csv, `catalogo-voci-${(bkCompanyId() || 'studio')}-${oggi}.csv`, 'text/csv');
}
/* Importare UNISCE: due colleghi che si scambiano il catalogo non devono cancellarsi il
   lavoro a vicenda. E prima di scrivere qualsiasi cosa si dice COSA c'è nel file: un
   backup che sovrascrive in silenzio non è un backup, è un incidente. */
export async function backupImporta(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  let j = null;
  try { j = JSON.parse(await f.text()); } catch (e) { alert('Questo file non si legge: non è un backup di Open E.Hub.'); return; }
  if (!valida(j)) { alert('Questo non è un backup di Open E.Hub (schema non riconosciuto). Non è stato toccato nulla.'); return; }
  const parti = anteprima(j);
  if (!parti.length) { alert('Il backup è vuoto: non c\'è niente da importare.'); return; }
  const quando = (j.esportata || '').slice(0, 10);
  const elenco = parti.map(p => `  · ${p.parte.nome}: ${p.n}`).join('\n');
  const ok = confirm(
    `Backup di «${j.studio}»${quando ? ` del ${quando}` : ''}\n\n${elenco}\n\n` +
    'Verrà UNITO al tuo: le tue decisioni restano, arrivano solo quelle che qui non c\'erano.\n\nProcedo?');
  if (!ok) return;
  const esiti = importaMemoria(localStorage, j, { companyId: bkCompanyId(), modo: 'unisci' });
  const nuovi = esiti.reduce((s, e) => s + Math.max(0, e.dopo - e.prima), 0);
  renderBackup();
  alert(nuovi
    ? `Importato: ${nuovi} elementi nuovi.\nRiapri i tool per vederli.`
    : 'Importato: non c\'era nulla che tu non avessi già.');
}
