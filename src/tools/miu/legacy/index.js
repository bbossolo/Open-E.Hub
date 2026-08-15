/*
 * μ (Prezzi) — SCRIPT LEGACY estratto verbatim dall'inline <script> di index.html
 * (STEP 1 dello snellimento HTML). Modulo ES caricato PRIMA di main.ts, come lo era
 * l'inline. Le funzioni/handler richiamati dagli attributi on*= (anche dentro l'HTML
 * generato) restano raggiungibili via `window` — vedi Object.assign in coda.
 * 2 sole modifiche rispetto all'originale:
 *  - `window._detailVals` esposto via getter (era letto da un handler generato);
 *  - setter `setCatDbFilter` al posto della scrittura inline di CAT_PANEL_FILTER.
 * STEP 2: split in moduli tematici (vedi stato.js e i moduli in questa cartella).
 */

import { applySuiteAesthetics } from '../../../shared'
import { buildTSVContent, buildMetelContent, b64ToUint8 } from './export.js'
import { S, CART_SEL, CAT_LIVELLI, CAT_LIVELLO_LABEL, CAT_SEP, AP_TIPO_LETTERA, CMP_ACC_DEFAULT,
  CMP, MIU_LIBRERIA, CART_MODE, CART_VIEW, CART_QUERY,
  _phiPresetQty, _phiSearchTimer, AP_REF_Q, AP_SEARCH_Q, AP_JUST_ADDED,
  setCMP, setMiuLibreria, setCartMode, setCartQuery,
  setPhiPresetQty, setApRefQ, setApSearchQ, setApJustAdded, setPhiSearchTimer
} from './stato.js'
import {
  misAddRiga, misCell, misDropRigheVuote, misKeydown, misMutAddRiga, misPanelHtml, misPanelRowEl, misPatchDom,
  misRemoveRiga, misRerenderPanel, misSetCampo, misToggle, misToggleBtn, misVoceRowEl
} from './misure.js'
import {
  phiChoiceHtml, phiComponiRow, phiConfirmDistinta, phiDescFull, phiDraftKey, phiMatchRows, phiPick, phiPool,
  phiScore, phiSearchInline
} from './import-distinte.js'
import {
  catChipDragOver, catChipDrop, catChipEdit, catChips3Html, catClearBtnHtml, catDbAdd, catDbAll, catDbDatalistsHtml,
  catDbDragStart, catDbFeedPath, catDbGroupsHtml, catDbOrigine, catDbPanelHtml, catDbRemove, categoriaChipHtml, categoriaColor,
  categoriaDaDistinta, categoriaHeaderRow, categoriaLabel, categoriaParts, categoriaSlots, categorieUsate
} from './categorie.js'
import {
  cartAllEntries, cartAnalisi, cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartCtxAssign, cartCtxAssignLivello, cartCtxMisure, cartDuplicateKeys,
  cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyBadgeHtml, cartRemoveKeys,
  cartRigaMDO, cartRows, cartSelClear, cartSelToggle, cartSetView, cartTotals, cartTreeToggle, cartUpdateSelUI, cartViewSwitchHtml,
  cartWarn
} from './computo.js'
import {
  cmpAcc, cmpAddCustom, cmpAddToCart, cmpApplyLibState, cmpCandAdd, cmpCandLoad, cmpCandSave, cmpClearDraft,
  cmpConfLabel, cmpCopy, cmpCurrentDescrizione, cmpDatasheetPick, cmpDraftHasContent, cmpDraftPayload, cmpDsInfoToggle, cmpEditAnalisiFromCart,
  cmpEditFromCart, cmpEditorCopy, cmpEditorInput, cmpEditorPull, cmpFacileSet, cmpFamSearch, cmpFlashBtn, cmpFrasario,
  cmpFreeMisura, cmpKey, cmpLibAdd, cmpLibDelete, cmpLibEdit, cmpLibGroupHTML, cmpLibGroupOpen, cmpLibItemHTML,
  cmpLibItems, cmpLoadDraft, cmpLoadVocePronta, cmpMacroFilter, cmpMacroShort, cmpMetelLookup, cmpNewVoce, cmpPersistDraft,
  cmpPickFam, cmpPrezzarioMisure, cmpPropText, cmpResetVoce, cmpSaveToLibreria, cmpSet, cmpSetMode, cmpShowPicker,
  cmpToggleAcc, cmpToggleLib, cmpToggleLibGroup, cmpTypeValue, cmpVocById, cmpVocText, cmpVoceObjectFromCMP
} from './compositore.js'

import {
  cmpAPAddRigaCustom, cmpAPAddToCart, cmpAPAutoSuggestManodopera, cmpAPAutoSuggestMateriale, cmpAPByCodice, cmpAPCurrentMacro, cmpAPCustomRowBlur, cmpAPDefault,
  cmpAPDescDiretta, cmpAPDuplicaRiga, cmpAPEnsure, cmpAPExportExcel, cmpAPExportPdf, cmpAPImportScomposizione, cmpAPMoMenuToggle, cmpAPMoReplace,
  cmpAPNewVoce, cmpAPRefPick, cmpAPRefResults, cmpAPRefSearchInput, cmpAPRemoveRiga, cmpAPRender, cmpAPRenderRefResults, cmpAPRenderSearchResults,
  cmpAPRenderSectionTotals, cmpAPRenderTotals, cmpAPSaveToLibreria, cmpAPSearchInput, cmpAPSearchPick, cmpAPSearchResults, cmpAPSetField, cmpAPSetPct,
  cmpAPSetRigaPrezzo, cmpAPSetRigaQty, cmpAPSetRigaUm, cmpAPSezioneHTML, cmpAPSnapshot, cmpAPUpdateRowImp
} from './analisi.js'
// STEP 2: init reale della libreria (loadLibreria è in index.js) dopo l'import dello stato.
setMiuLibreria(loadLibreria());
import { closeCartsMenu, deleteCartById, loadCartById, loadCarts, migrateLegacySel, openCartsMenu, persistCarts, pushCart, renderCartsList, saveCurrentCart } from './carrelli.js'
import { applyCatPopoverNew, applyCategoriaToKeys, applyLivelloToKeys, byCategoriaKey, closeCatPopover, joinCatSlots, loadCatDb, loadCatDbOrigin, migrateCatDbSp, openCatPopover, openLivelloPopover, persistCatDb, persistCatDbOrigin, refreshCatDbGroups, renderCatPopoverList, renderLivelloPopoverList, setCatDbFilter, setCategoria, setCategoriaLivello, toggleCatPopoverNew } from './categorie-db.js'
import { closeCopyPopup, copyToClipboard, showCopyPopup } from './clipboard.js'
import { addRowToComputo, addSelectedToComputo, clearCart, clearSearchSel, closeCart, collectExportRows, custSetPrezzo, custSetUm, customRowsHtml, exportComputoExcel, mdoBadgeHtml, nextCustomKey, openCart, openComputoPDF, persistCustomLive, publishComputo, refreshCartOverlayIfOpen, removeCustomFromCart, removeFromCart, rowByKey, rowsBySearchSel, setQtyCustom, setQtyManual, updateCartInfo } from './computo-overlay.js'
import { apBuildSheet, apMoLabel, closeComponi, closeDetail, cmpDatasheetFile, copyField, detailCartAction, exportFascicoloAP, exportFascicoloAPPdf, loadLibreria, openComponi, openComponiAnalisi, openComponiFromDetail, openDetail, persistLibreria, renderCandidati, renderComponi, renderLibreria, updateAPFascicoloBtn, updateDetailCartBtn } from './dettaglio.js'
import { clearPhiDraft, closePhiDistinta, distItemId, groupPhiItems, loadPhiDraft, openAmpereDistinta, openDistintaModal, savePhiDraft } from './distinte.js'
import { commitRowToElencoPrezzi, elencoKeyOf, elencoPrezziPanelHtml, elencoRemove, epDragEnd, epDragStart, epDropSuComputo, epFloatClose, epFloatHtml, epFloatOpen, epFloatSave, epFloatState, isInElencoPrezzi, mountEpFloat, wireEpFloat } from './elenco-prezzi.js'
import { exportMetel, latin1Bytes, pad, padN, sanitizeXmlText, umLabel, umToMetel, xmlEsc } from './export-metel.js'
import { _qeKeydown, closeQuickEdit, openQuickEdit, qePickRow, qeSearchInline, quickEditSave } from './quick-edit.js'
import { _noMotion, buildTree, captureRowTops, checkPage, crossfadeBox, displayShort, expand, flipCascade, gp, parseNum, render, renderList, renderPag, renderTableRows, renderTree, rowKey, toggleRow, treeVoce, walkTree } from './render.js'
import { addFiles, ampereFilePicked, buildFilters, buildMacroChips, cascade, countActiveFiltri, debouncedFilter, detectFromFilename, discBadge, doFilter, filterMiniSearch, handleFileInput, importAmpereMatrix, initDropZone, itemTipo, loadItem, macroPool, macroSel, metelSupplierFromName, openFolder, parseXLSX, parseXML, pickAmpere, populateSel, rebuildRows, regBadge, regColor, resetFilters, sniffRegion, toggleMacro, tryAmpereFile, updateActiveBanner, updateFiltriBtnLabel } from './ricerca.js'
import { _rowClick, _selBox, _selFocus, _selKeydown, _selKeys, _selRange, _selRestoreFocus, _selRowEl, _selSet, _treeKeydown, _treeRestoreFocus, _treeRows, _treeSetFocus, _wireSelDoc, attachRowEvents, closeCartCtxMenu, openCartCtxMenu, renderSelDock, toggleSelAll, toggleSelDock, wireCartSelection } from './selezione.js'
import { renderArchItem, renderRegionGroups, renderSidebar, toggleRegGroup, toggleTopGroup } from './sidebar.js'
// ══════════════════════════════════════════════════════════════
// SIDEBAR COLLAPSE
// ══════════════════════════════════════════════════════════════
// Sidebar comprimibile: gestita dal componente condiviso makeCollapse in main.ts.
// Persistenza su 'miu:sidebar-collapsed', glifo del bottone via CSS.

// ══════════════════════════════════════════════════════════════
// VISTE (layout) + DENSITÀ
// ══════════════════════════════════════════════════════════════
function setView(v){
  S.view = (['table','tree','list'].includes(v)) ? v : 'table';
  try{ localStorage.setItem('plView', S.view); }catch(e){}
  applyViewControls();
  render();
}
function setDensity(d){
  S.density = (['normal','compact','ultra'].includes(d)) ? d : 'normal';
  document.body.classList.toggle('compact', S.density==='compact');
  document.body.classList.toggle('ultra',   S.density==='ultra');
  try{ localStorage.setItem('plDensity', S.density); }catch(e){}
  applyViewControls();
}
function setDescLines(n){
  n = [1,2,3,5,99].includes(+n) ? +n : 3;
  S.descLines = n;
  document.documentElement.style.setProperty('--desc-lines', n);
  try{ localStorage.setItem('plDescLines', n); }catch(e){}
  applyViewControls();
}
// Schermata leggera — "Colonne: Tutte/Meno" nella tabella risultati: in "meno" si
// nascondono le colonne di CONTESTO (regione, anno, disciplina, importo netto),
// non la Descrizione (si autocomprime già per riga con .exp-btn/expand()).
function setColumns(mode){
  S.columns = mode==='meno' ? 'meno' : 'tutte';
  document.getElementById('dtable')?.classList.toggle('cols-lean', S.columns==='meno');
  try{ localStorage.setItem('plColumns', S.columns); }catch(e){}
  applyViewControls();
}
// Vista Capitoli — "Voci: Compatte/Espanse": Compatte (default) è una riga
// singola stile Tabella (codice · regione · anno · MDO · descrizione 1 riga ·
// um · misura · prezzo); Espanse è la card multi-riga storica.
function setTreeVoce(mode){
  S.treeVoce = mode==='compatta' ? 'compatta' : 'espansa';
  document.getElementById('treeview')?.classList.toggle('tvoce-compact', S.treeVoce==='compatta');
  try{ localStorage.setItem('plTreeVoce', S.treeVoce); }catch(e){}
  applyViewControls();
}
// ══════════════════════════════════════════════════════════════
// MODALITÀ RAPIDA / COMPLETA — due modi della stessa schermata.
// «Rapida» (predefinita) è la consultazione: cerca nei prezzari, seleziona, copia
// nell'Elenco Prezzi. «Completa» è il flusso di computo intero (misure,
// categorie, Excel/PDF, compositore, analisi prezzi), invariato.
// Non si perde nulla passando a Rapida: gli elementi marcati [data-full] nel markup
// vengono solo NASCOSTI (regole in styles/pricelist.css) — il computo resta
// popolato e torna intatto rientrando in Completa.
// ══════════════════════════════════════════════════════════════
const MIU_MODE_KEY='miu:mode';
let CURRENT_MODE='rapida';
// `persist` false = scelta non dell'utente (boot, auto-switch): non sporca la
// preferenza, così l'auto-switch qui sotto sa ancora se una scelta esiste davvero.
function setMode(m, persist=true){
  CURRENT_MODE = (m==='completa') ? 'completa' : 'rapida';
  document.body.classList.toggle('miu-rapida',   CURRENT_MODE==='rapida');
  document.body.classList.toggle('miu-completa', CURRENT_MODE==='completa');
  applyViewControls();
  if(persist){ try{ localStorage.setItem(MIU_MODE_KEY, CURRENT_MODE); }catch(e){} }
  // In Rapida il binario ha un solo passo: se si arriva da Misura/Categorizza/
  // Esporta si torna alla ricerca, altrimenti si resterebbe su una vista senza
  // più il comando per uscirne.
  if(CURRENT_MODE==='rapida' && CURRENT_STEP!=='cerca') setStep('cerca');
  measureChrome(); // il binario cambia altezza: le viste-passo si montano sotto
}
// Default = Rapida. Ma se il computo è già popolato — sessione ripresa, progetto
// .ehub ripristinato, distinta importata — si apre in Completa: nascondere
// dati appena portati dentro sarebbe peggio del rumore che la Rapida evita.
// Vale solo finché l'utente non ha scelto una modalità di sua mano.
function miuAutoModeForComputo(n){
  if(!(n>0) || CURRENT_MODE==='completa') return;
  let saved=null; try{ saved=localStorage.getItem(MIU_MODE_KEY); }catch(e){}
  if(saved) return;                 // scelta esplicita dell'utente: si rispetta
  setMode('completa', false);
}
function initMiuMode(){
  let saved=null; try{ saved=localStorage.getItem(MIU_MODE_KEY); }catch(e){}
  setMode(saved==='completa'?'completa':'rapida', false);
}

// aggiorna lo stato attivo dei selettori segmentati
function applyViewControls(){
  document.querySelectorAll('#mode-toggle button').forEach(b=>b.classList.toggle('active', b.dataset.mode===CURRENT_MODE));
  document.querySelectorAll('#layout-switch button').forEach(b=>b.classList.toggle('active', b.dataset.view===S.view));
  document.querySelectorAll('#density-switch button').forEach(b=>b.classList.toggle('active', b.dataset.density===S.density));
  document.querySelectorAll('#columns-switch button').forEach(b=>b.classList.toggle('active', b.dataset.columns===S.columns));
  document.querySelectorAll('#tvoce-switch button').forEach(b=>b.classList.toggle('active', b.dataset.tvoce===S.treeVoce));
  const dl=document.getElementById('desc-lines-sel'); if(dl) dl.value=String(S.descLines);
}

// ══════════════════════════════════════════════════════════════
// BINARIO = NAVIGAZIONE (setStep) — le 3 app pesanti (Componi/Misura/Esporta)
// erano overlay a schermo intero aperti da pulsanti sepolti: ora sono VISTE di
// primo livello guidate dal binario persistente sopra la pagina. Le superfici
// restano quelle di prima (openComponi/openCart), montate SOTTO il binario
// invece che come modali che coprono tutto.
// ══════════════════════════════════════════════════════════════
let CURRENT_STEP = 'cerca';
// 4 passi: "Cerca o componi" è la home (il Compositore è un pannello sopra la vista,
// aperto dal bottone ✎, non un passo a sé). Poi Misura · Categorizza · Esporta.
const MIU_STEPS = ['cerca','misura','categorizza','esporta'];
// aggiorna solo lo stato visivo del binario (nessuna apertura/chiusura di superfici):
// lo chiamano anche le open*() così il binario resta in sync da qualunque ingresso.
function _syncRail(step){
  CURRENT_STEP = step;
  document.body.dataset.step = step;
  document.querySelectorAll('#miu-rail .ehb-rail-step').forEach(s=>s.classList.toggle('active', s.dataset.step===step));
}
// router: chiude ogni superficie-passo, poi apre quella richiesta (che ri-sincronizza il binario).
// NB: Componi NON è un passo — è un pannello modale sopra la vista, aperto dal bottone ✎.
function setStep(step){
  if(!MIU_STEPS.includes(step)) step='cerca';
  // chiudi il Compositore se aperto (è un modale, non un passo) e le altre superfici-passo
  const co=document.getElementById('componi-overlay');
  if(co && co.classList.contains('open')) closeComponi();
  document.querySelectorAll('#cart-overlay').forEach(el=>el.remove());
  document.querySelectorAll('#ep-float-wrap').forEach(el=>el.remove()); // il flottante segue il Computo (rimontato da mountEpFloat se si riapre)
  CART_SEL.clear(); closeCatPopover(); closeCartCtxMenu();
  document.getElementById('export-overlay')?.classList.remove('open');
  // Misura e Categorizza sono due PANNELLI, non due viste della stessa lista: si misura
  // guardando prezzi e quantità (con l'Elenco Prezzi sotto mano), si categorizza guardando
  // il database delle categorie. Mescolarli obbligava a portarsi dietro l'una mentre si
  // faceva l'altra — ed è il motivo per cui «Elenco» sembrava tornare indietro a «Misura»:
  // era una vista di Misura infilata fra i modi.
  if(step==='misura'){ setCartMode('misura'); openCart(); }
  else if(step==='categorizza'){ setCartMode('categorizza'); openCart(); }
  else if(step==='esporta') openExport();
  else _syncRail('cerca'); // cerca: la home (#main) resta sotto, niente da aprire
  // La vista appena montata entra con una transizione — solo
  // alla NAVIGAZIONE (setStep), non ai refresh interni di openCart/openExport
  // (chiamati anche per aggiornare i dati a passo invariato).
  requestAnimationFrame(()=>{
    const el = step==='esporta' ? document.getElementById('export-overlay')
      : step==='cerca' ? document.getElementById('main')
      : document.getElementById('cart-overlay');
    window.ehbFeedback?.viewEnter(el);
  });
}
function openExport(){
  const n=S.sel.size+S.custom.size;
  const sub=document.getElementById('export-sub');
  if(sub) sub.textContent = n>0
    ? `${n.toLocaleString('it')} voci nel computo · verso documenti e Analisi Prezzi.`
    : 'Il computo è vuoto: aggiungi voci in Cerca o Misura per avere qualcosa da esportare.';
  document.getElementById('export-overlay').classList.add('open');
  _syncRail('esporta');
}
// misura l'altezza reale di header+binario e la espone come --chrome-h, così le
// viste-passo si montano esattamente SOTTO il binario (che resta sempre visibile).
function measureChrome(){
  const h=(document.getElementById('app-header')?.offsetHeight||48)
        + (document.getElementById('miu-rail')?.offsetHeight||0);
  document.documentElement.style.setProperty('--chrome-h', h+'px');
}

// Popover "Visualizzazione ⋯": ospita densità + righe descrizione fuori dalla barra a vista.
function setViewMenu(open){
  const pop=document.getElementById('view-menu-pop'), btn=document.getElementById('view-menu-btn');
  if(!pop||!btn) return;
  pop.hidden=!open;
  btn.setAttribute('aria-expanded', open?'true':'false');
  btn.classList.toggle('active', open);
  if(open){
    document.addEventListener('click', onViewMenuOutside, true);
    document.addEventListener('keydown', onViewMenuKey, true);
  }else{
    document.removeEventListener('click', onViewMenuOutside, true);
    document.removeEventListener('keydown', onViewMenuKey, true);
  }
}
function onViewMenuOutside(e){
  const wrap=document.getElementById('view-menu-wrap');
  if(wrap && !wrap.contains(e.target)) setViewMenu(false);
}
function onViewMenuKey(e){ if(e.key==='Escape') setViewMenu(false); }
function toggleViewMenu(){
  const pop=document.getElementById('view-menu-pop');
  setViewMenu(!!pop && pop.hidden);
}

// Popover header "⋯ Altro": raccoglie le azioni secondarie (Computi, distinte
// import Ampère/prezzario, cartella, guida) fuori dalla vista a riposo —
// stesso pattern di setViewMenu/onViewMenuOutside/onViewMenuKey.
function setMoreMenu(open){
  const pop=document.getElementById('more-menu-pop'), btn=document.getElementById('more-btn');
  if(!pop||!btn) return;
  pop.hidden=!open;
  btn.setAttribute('aria-expanded', open?'true':'false');
  btn.classList.toggle('active', open);
  if(open){
    document.addEventListener('click', onMoreMenuOutside, true);
    document.addEventListener('keydown', onMoreMenuKey, true);
  }else{
    document.removeEventListener('click', onMoreMenuOutside, true);
    document.removeEventListener('keydown', onMoreMenuKey, true);
  }
}
function onMoreMenuOutside(e){
  const wrap=document.getElementById('more-menu-wrap');
  if(wrap && !wrap.contains(e.target)) setMoreMenu(false);
}
function onMoreMenuKey(e){ if(e.key==='Escape') setMoreMenu(false); }
function toggleMoreMenu(){
  const pop=document.getElementById('more-menu-pop');
  setMoreMenu(!!pop && pop.hidden);
}

// Popover "Esporta ▾": accesso rapido alle stesse destinazioni dell'export
// overlay completo (raggiungibile anche dal passo Esporta del binario) —
// stesso pattern di setViewMenu/setMoreMenu.
function setExportMenu(open){
  const pop=document.getElementById('export-menu-pop'), btn=document.getElementById('export-menu-btn');
  if(!pop||!btn) return;
  pop.hidden=!open;
  btn.setAttribute('aria-expanded', open?'true':'false');
  btn.classList.toggle('active', open);
  if(open){
    document.addEventListener('click', onExportMenuOutside, true);
    document.addEventListener('keydown', onExportMenuKey, true);
  }else{
    document.removeEventListener('click', onExportMenuOutside, true);
    document.removeEventListener('keydown', onExportMenuKey, true);
  }
}
function onExportMenuOutside(e){
  const wrap=document.getElementById('export-menu-wrap');
  if(wrap && !wrap.contains(e.target)) setExportMenu(false);
}
function onExportMenuKey(e){ if(e.key==='Escape') setExportMenu(false); }
function toggleExportMenu(){
  const pop=document.getElementById('export-menu-pop');
  setExportMenu(!!pop && pop.hidden);
}
// Esc a livelli nel Computo Metrico: popover categoria → menu contestuale →
// overlay. Il pannello misure gestisce Esc da sé (misKeydown, stopPropagation);
// il compositore ha il suo listener in capture (cmpKey) e vince quando è aperto.
document.addEventListener('keydown',(e)=>{
  if(e.defaultPrevented) return;
  if(e.key==='Escape'){
    if(document.getElementById('cat-popover')){ closeCatPopover(); return; }
    if(document.getElementById('cart-ctx-menu')){ closeCartCtxMenu(); return; }
    if(document.getElementById('cart-overlay') || document.getElementById('export-overlay')?.classList.contains('open')) setStep('cerca');
    return;
  }
  // scorciatoie 1–5 = passi del binario (fuori dai campi di testo). In modalità
  // Rapida i passi 2·3·4 non esistono: la scorciatoia non deve portarti su una
  // vista che il binario non mostra.
  if(CURRENT_MODE==='rapida') return;
  if('12345'.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey
     && !e.target.closest('input,textarea,select,[contenteditable]')){
    setStep(MIU_STEPS[+e.key-1]); return;
  }
});

// ══════════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════════
function openModal(r){
  document.getElementById('modal-title').textContent=r.codice;
  const fields=[
    ['Regione / Anno',r.regione+' · '+r.anno],
    ['Descrizione',r.desc_short],
    ['Declaratoria completa',r.declaratoria],
    ['Disciplina',r.disciplina],
    ['Sistema',r.sistema],
    ['Settore',r.settore],
    ['Materiale',r.materia],
    ['Attività',r.attivita],
    ['Categoria',r.liv1?[r.liv1,r.liv2,r.liv3].filter(Boolean).join(' › '):''],
    ['U.M.',r.um],
    ['Prezzo unitario','€ '+fmt(r.prezzo)],
    ['Importo netto',r.importo_netto?'€ '+fmt(r.importo_netto):''],
    ['R.U. / % Manodopera',r.ru||''],
    ['Keywords',r.keywords],
    ['Tipologia',r.tipologia],
  ];
  document.getElementById('modal-body').innerHTML=fields
    .filter(([,v])=>v&&v.trim())
    .map(([l,v])=>`<div class="mf"><div class="ml">${l}</div><div class="mv">${esc(String(v))}</div></div>`)
    .join('');
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
/* La guida è ora il manuale unico condiviso: main.ts sovrascrive queste due su
   window (viene caricato dopo). Restano null-safe come fallback. */
function openGuide(){ document.getElementById('guide-overlay')?.classList.add('open'); }
function closeGuide(){ document.getElementById('guide-overlay')?.classList.remove('open'); }

// ══════════════════════════════════════════════════════════════
// STATE UI
// ══════════════════════════════════════════════════════════════
function showState(mode,label,pct){
  const sp=document.getElementById('state-panel');
  const ta=document.getElementById('table-area');
  if(mode==='idle'){
    ta.classList.remove('show');
    document.getElementById('filter-bar').style.display='none';
    document.getElementById('search-hero').style.display='none';
    const ab=document.getElementById('active-banner'); if(ab) ab.style.display='none';
    document.getElementById('results-bar').style.display='none';
    sp.classList.add('show');
    // il pulsante Computo Metrico vive nella filter-toolbar (accanto a "Reset
    // filtri"), ma quella barra è nascosta qui in idle: senza questo link, un
    // computo già popolato (sessione ripresa) resterebbe irraggiungibile finché
    // non si apre un prezzario — stessa funzione, punto d'accesso di riserva.
    const nInCart=S.sel.size+S.custom.size;
    sp.innerHTML=`
      <div class="state-icon">▤</div>
      <div class="state-h2">Prezzari trovati</div>
      <p class="state-p">Clicca su un prezzario nella lista per caricarlo.<br>Puoi caricarne più di uno contemporaneamente.</p>
      <div class="state-hint">✦ Spunta la casella per aggiungere al computo · doppio clic sulla riga per il dettaglio</div>
      ${nInCart>0
        ?`<button class="state-cart-link" onclick="openCart()">▤ Apri il Computo Metrico — ${nInCart} vo${nInCart===1?'ce':'ci'}</button>`
        :''}`;
  } else if(mode==='loading'){
    sp.classList.add('show');
    if(!document.getElementById('prog-bar')){
      sp.innerHTML=`<div class="state-icon" style="font-size:36px">⏳</div>
        <div class="state-h2">Caricamento…</div>
        <div id="prog-wrap"><div id="prog-bar"></div></div>
        <div id="prog-label"></div>`;
    }
    const pb=document.getElementById('prog-bar');
    const pl=document.getElementById('prog-label');
    if(pb) pb.style.width=(pct||0)+'%';
    if(pl) pl.textContent=label||'';
  }
}
function hideState(){
  document.getElementById('state-panel').classList.remove('show');
}

// ══════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════

/* Versione (da filename) + app:ready: ora nel modulo main.ts (shared/version). */

// Tema: l'hub inietta data-theme nello srcdoc (tema unico di suite); al boot
// ONORIAMO quel modo, non lo rileggiamo da una chiave locale. L'hub aggiorna il
// tema via 'hub:set-theme' (push del picker); la palette via 'hub:set-palette'.
function applyThemeMiu(t){
  document.documentElement.dataset.theme=t;
  const btn=document.getElementById('theme-toggle');
  if(btn) btn.textContent = (t==='dark') ? '☀' : '☾';
}
function setThemeExternal(t){
  if(document.documentElement.dataset.theme===t) return;
  applyThemeMiu(t);
}
function toggleTheme(){
  const next=(document.documentElement.dataset.theme==='dark')?'light':'dark';
  applyThemeMiu(next);
  try{ window.parent.postMessage({type:'app:theme',theme:next},'*'); }catch(e){} // informa l'hub
}
// Scorciatoia 'T': qui (non nell'hub) perché il keydown non risale dall'iframe
// al padre. Ignora l'input mentre si scrive in un campo.
document.addEventListener('keydown', function(e){
  if(e.key.toLowerCase()!=='t') return;
  const el=e.target;
  if(el && (/input|select|textarea/i.test(el.tagName||'') || el.isContentEditable)) return;
  toggleTheme();
});
// Segnala il tema all'hub così la sua chrome si adatta al tool attivo (init + toggle).
try{ window.parent.postMessage({type:'app:theme',theme:(document.documentElement.dataset.theme||'light')},'*'); }catch(e){}
// l'hub può imporre il tema a tutte le app
window.addEventListener('message',function(ev){
  const m=ev.data;
  if(!m || typeof m!=='object') return;
  if(m.type==='hub:set-theme' && m.theme){ setThemeExternal(m.theme); if(m.palette) document.documentElement.setAttribute('data-palette', m.palette); }
  applySuiteAesthetics(m);
  // ── Progetto Open E.Hub: raccolta/ripristino dello stato pieno di μ ──
  if(m.type==='hub:collect-state'){
    try { window.parent.postMessage({ type:'app:full-state', appId:'miu-price-list', state: collectMiuState() }, '*'); } catch(e){}
  }
  if(m.type==='hub:restore-state' && m.state){
    restoreMiuState(m.state);
  }
});
// Stato pieno di μ per il progetto Open E.Hub: chiavi selezionate + quantità +
// SNAPSHOT delle righe del carrello (così il carrello si ricostruisce anche se
// il prezzario regionale non è caricato).
function collectMiuState(){
  const rows=[...cartRows().values()];
  // additivo/retro-compatibile: le voci composte entrano nello snapshot
  // .ehub accanto alle righe reali — i vecchi progetti senza `custom` restano validi.
  // `categoria` è la STRUTTURA del computo (Ambito|Disciplina|Voce): senza di lei il
  // progetto riaperto tornava un elenco piatto, e le categorie a 3 livelli che l'import
  // assegna alla distinta andavano perse proprio nel momento in cui servono. La bozza
  // locale la salvava già: era il .ehub — il file che l'utente si porta via — a non farlo.
  return { sel:[...S.sel], qty:JSON.parse(JSON.stringify(S.qty||{})), rows, custom:[...S.custom.entries()],
    categoria:JSON.parse(JSON.stringify(S.categoria||{})) };
}
// Ripristina il carrello da uno snapshot: inietta le righe come prezzario
// sintetico "(progetto Open E.Hub)" (dedup per chiave), poi riapplica selezione e misure.
function restoreMiuState(state){
  const rows=(state&&state.rows)||[];
  const existing=new Set();
  for(const it of S.archive){ if(it.loaded===true) for(const r of it.rows) existing.add(rowKey(r)); }
  const fresh=rows.filter(r=>r&&!existing.has(rowKey(r)));
  if(fresh.length){
    S.archive.push({ filename:'(progetto Open E.Hub)', regione:'—', anno:'—', format:'ehub',
      loaded:true, rows:fresh, handle:null });
  }
  S.qty=(state&&state.qty)?JSON.parse(JSON.stringify(state.qty)):{};
  // voci composte dal progetto — chiave `custom` ignorata dai vecchi snapshot
  S.custom=new Map((state&&Array.isArray(state.custom))?JSON.parse(JSON.stringify(state.custom)):[]);
  // Categorie del computo: prima di `migrateLegacySel`, che rimappa le chiavi delle voci
  // legacy e si porta dietro la categoria assegnata. Un .ehub vecchio non ce l'ha: {}.
  S.categoria=(state&&state.categoria)?JSON.parse(JSON.stringify(state.categoria)):{};
  S.sel=new Set();               // computo tutto in S.custom (Elenco Prezzi)
  migrateLegacySel(state);       // .ehub vecchi (voci in sel) → copie modificabili
  render();
  const n=S.custom.size;
  toast(`Computo Metrico ripristinato dal progetto Open E.Hub — ${n} voci`, n?'ok':'warn');
}
// Crea/aggiorna il carrello dalle voci di un computo ricevuto, agganciando per CODICE
// nei prezzari caricati (match esatto, poi codice senza suffisso "_…").
// all'avvio, chiede all'hub lo stato condiviso corrente (es. un progetto già aperto)
try { window.parent.postMessage({ type:'app:request-state', want:'phi' }, '*'); } catch(e) {}

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
function fmt(n){ return n?n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'; }
// normalizza per ricerca: minuscolo, accenti via, "6 mm"->"6mm", collassa spazi
function normSearch(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/(\d)\s+(mmq|mm|mq|mc|ml|cm|kw|kv|kg|w|v|a|m)\b/g,'$1$2')
    .replace(/\s+/g,' ').trim();
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function jsEsc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function toast(msg,type=''){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast show'+(type?' '+type:'');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.className='toast',3500);
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
window.addEventListener('load',()=>{
  // (tema/palette: governati dal picker dell'hub via hub:set-theme)
  // (sidebar width: ripristinata dal resizer condiviso in main.ts)
  // (sidebar collapsed: ripristinata dal componente condiviso makeCollapse in main.ts)
  // restore vista + densità (con retrocompatibilità del vecchio compactView)
  try{
    const v=localStorage.getItem('plView'); if(v) S.view=v;
    let d=localStorage.getItem('plDensity');
    if(!d && localStorage.getItem('compactView')==='1') d='compact';
    if(d) S.density=d;
    const dl=localStorage.getItem('plDescLines'); if(dl) S.descLines=+dl;
    const cols=localStorage.getItem('plColumns'); if(cols) S.columns=cols;
    const tv=localStorage.getItem('plTreeVoce'); if(tv) S.treeVoce=tv;
  }catch(e){}
  initMiuMode();         // modalità Rapida/Completa (default Rapida) — vedi setMode
  setDensity(S.density); // applica le classi body + stato controlli
  setDescLines(S.descLines); // applica --desc-lines + stato controllo
  setColumns(S.columns); // applica cols-lean + stato controllo
  setTreeVoce(S.treeVoce); // applica tvoce-compact + stato controllo
  applyViewControls();
  if(!window.showDirectoryPicker){
    document.getElementById('folder-btn').disabled=true;
    toast('Richiede Chrome o Edge — File System Access API non disponibile','err');
  }
  initDropZone();
  renderSidebar();
  // Stato di SESSIONE: le voci composte, il carrello e la bozza vivono SOLO durante
  // la sessione del tool (in memoria + round-trip .ehub). All'avvio si azzerano le
  // chiavi localStorage residue di sessioni precedenti — «nuovo progetto»/chiusura
  // sessione ripartono da zero, niente residui (vedi persistCustomLive: no-op).
  try{ localStorage.removeItem('miu:custom-live'); localStorage.removeItem('miu:cmp-draft'); }catch(e){}
  updateCartInfo();
});

// (initSidebarResize rimosso: ora il resizer condiviso makeResizer in main.ts.)



// ── STEP 4d — prezzari INTERNI a richiesta. Lo script legacy resta classico:
// S e le funzioni restano globali. main.ts (modulo) chiama __pricelistRegister
// col manifest e fornisce __pricelistLoadRows (caricamento+decompressione lazy).
window.__pricelistRegister = function(manifest){
  const start = S.archive.length;
  for(const m of manifest){
    // `variante` (es. "Parte 4 · Elenco prezzi") distingue parti diverse della
    // stessa edizione regione+anno, altrimenti indistinguibili a video.
    const dash = String.fromCharCode(8212);
    const regAnno = (m.regione || dash) + (m.anno ? ' ' + m.anno : '');
    S.archive.push({
      filename: regAnno + (m.variante ? ' · ' + m.variante : ''),
      regione: m.regione || dash,
      anno: m.anno || dash,
      variante: m.variante || '',
      format: 'internal', loaded: false, rows: [], slug: m.slug,
      tipo: m.categoria || 'pubblico',   // pubblico | privato | metel (raggruppamento sidebar)
    });
  }
  renderSidebar();
  // attiva subito un prezzario (così l'utente vede contenuto senza aprire cartelle):
  // di default il VENETO (preferenza studio), l'edizione più RECENTE se ce ne sono
  // più d'una (stessa regione, anni diversi), altrimenti il primo registrato.
  if(S.active==null && manifest.length){
    let idx=start, bestAnno=-Infinity;
    for(let i=start;i<S.archive.length;i++){
      if(!/^veneto/i.test(S.archive[i].slug||'')) continue;
      const anno = parseInt(S.archive[i].anno, 10);
      if(idx===start && bestAnno===-Infinity) idx=i; // primo match come fallback
      if(!isNaN(anno) && anno>bestAnno){ bestAnno=anno; idx=i; }
    }
    loadItem(idx);
  }
};

// ── INIT NAVIGAZIONE ── il binario è la navigazione persistente: misura l'altezza
// del chrome (header+binario) e parte dal passo Cerca.
(function initMiuNav(){
  document.body.dataset.step = 'cerca';
  measureChrome();
  window.addEventListener('resize', measureChrome);
  // il binario può cambiare altezza (wrap dei passi) quando arriva il contesto computo
  if(window.ResizeObserver){ new ResizeObserver(measureChrome).observe(document.getElementById('miu-rail')); }
})();

// Esposizione su window: riproduce lo scope globale dell'inline classico di prima,
// così gli on*= (statici e generati) risolvono i nomi come oggi.
Object.assign(window, {
  _noMotion, _qeKeydown, _rowClick, _selBox,
  _selFocus, _selKeydown, _selKeys, _selRange, _selRestoreFocus, _selRowEl, _selSet, _syncRail,
  _treeKeydown, _treeRestoreFocus, _treeRows, _treeSetFocus, _wireSelDoc, addFiles, addRowToComputo, addSelectedToComputo, clearSearchSel,
  ampereFilePicked, apBuildSheet, apMoLabel, applyCatPopoverNew, applyCategoriaToKeys, applyLivelloToKeys, applyThemeMiu, applyViewControls,
  attachRowEvents, b64ToUint8, buildFilters, buildMacroChips, buildMetelContent, buildTSVContent, buildTree, byCategoriaKey,
  captureRowTops, cartAllEntries, cartAnalisi, cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartCtxAssign, cartCtxAssignLivello, cartCtxMisure,
  cartDuplicateKeys, cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyBadgeHtml,
  cartRemoveKeys, cartRigaMDO, cartRows, cartSelClear, cartSelToggle, cartSetView, cartTotals, cartTreeToggle, cartUpdateSelUI,
  cartViewSwitchHtml, cartWarn, cascade, catChipDragOver, catChipDrop, catChipEdit, catChips3Html, catClearBtnHtml,
  catDbAdd, catDbAll, catDbDatalistsHtml, catDbDragStart, catDbFeedPath, catDbGroupsHtml, catDbOrigine, catDbPanelHtml,
  catDbRemove, categoriaChipHtml, categoriaColor, categoriaDaDistinta, categoriaHeaderRow, categoriaLabel, categoriaParts, categoriaSlots,
  categorieUsate, checkPage, clearCart, clearPhiDraft, closeCart, closeCartCtxMenu, closeCartsMenu,
  countActiveFiltri,
  closeCatPopover, closeComponi, closeCopyPopup, closeDetail, closeGuide, closeModal, closePhiDistinta,
  closeQuickEdit, cmpAPAddRigaCustom, cmpAPAddToCart, cmpAPAutoSuggestManodopera, cmpAPAutoSuggestMateriale,
  cmpAPByCodice, cmpAPCurrentMacro, cmpAPCustomRowBlur, cmpAPDefault, cmpAPDescDiretta, cmpAPDuplicaRiga, cmpAPEnsure, cmpAPExportExcel,
  cmpAPExportPdf, cmpAPImportScomposizione, cmpAPMoMenuToggle, cmpAPMoReplace, cmpAPNewVoce, cmpAPRefPick, cmpAPRefResults, cmpAPRefSearchInput,
  cmpAPRemoveRiga, cmpAPRender, cmpAPRenderRefResults, cmpAPRenderSearchResults, cmpAPRenderSectionTotals, cmpAPRenderTotals, cmpAPSaveToLibreria,
  cmpAPSearchInput, cmpAPSearchPick, cmpAPSearchResults, cmpAPSetField, cmpAPSetPct, cmpAPSetRigaPrezzo, cmpAPSetRigaQty, cmpAPSetRigaUm,
  cmpAPSezioneHTML, cmpAPSnapshot, cmpAPUpdateRowImp, cmpAcc, cmpAddCustom, cmpAddToCart, cmpApplyLibState, cmpCandAdd,
  cmpCandLoad, cmpCandSave, cmpClearDraft, cmpConfLabel, cmpCopy, cmpCurrentDescrizione, cmpDatasheetFile, cmpDatasheetPick,
  cmpDraftHasContent, cmpDraftPayload, cmpDsInfoToggle, cmpEditAnalisiFromCart, cmpEditFromCart, cmpEditorCopy, cmpEditorInput, cmpEditorPull,
  cmpFacileSet, cmpFamSearch, cmpFlashBtn, cmpFrasario, cmpFreeMisura, cmpKey, cmpLibAdd, cmpLibDelete,
  cmpLibEdit, cmpLibGroupHTML, cmpLibGroupOpen, cmpLibItemHTML, cmpLibItems, cmpLoadDraft, cmpLoadVocePronta, cmpMacroFilter,
  cmpMacroShort, cmpMetelLookup, cmpNewVoce, cmpPersistDraft, cmpPickFam, cmpPrezzarioMisure, cmpPropText, cmpResetVoce,
  cmpSaveToLibreria, cmpSet, cmpSetMode, cmpShowPicker, cmpToggleAcc, cmpToggleLib, cmpToggleLibGroup,
  cmpTypeValue, cmpVocById, cmpVocText, cmpVoceObjectFromCMP, collectExportRows, collectMiuState, commitRowToElencoPrezzi,
  copyField, copyToClipboard, crossfadeBox, custSetPrezzo, custSetUm, customRowsHtml, debouncedFilter,
  deleteCartById, detailCartAction, detectFromFilename, discBadge, displayShort, distItemId, doFilter, elencoKeyOf,
  elencoPrezziPanelHtml, elencoRemove, epDragEnd, epDragStart, epDropSuComputo, epFloatClose, epFloatHtml, epFloatOpen, epFloatSave, epFloatState, esc, expand,
  exportFascicoloAP, exportFascicoloAPPdf, exportMetel, filterMiniSearch, flipCascade, fmt, gp,
  groupPhiItems, handleFileInput, hideState, importAmpereMatrix, initDropZone, isInElencoPrezzi,
  itemTipo, joinCatSlots, latin1Bytes, loadCartById, loadCarts, loadCatDb, loadCatDbOrigin, loadItem,
  loadLibreria, loadPhiDraft, macroPool, macroSel, mdoBadgeHtml, measureChrome,
  metelSupplierFromName, migrateCatDbSp, migrateLegacySel, misAddRiga, misCell, misDropRigheVuote, misKeydown, misMutAddRiga,
  misPanelHtml, misPanelRowEl, misPatchDom, misRemoveRiga, misRerenderPanel, misSetCampo, misToggle, misToggleBtn,
  misVoceRowEl, mountEpFloat, nextCustomKey, normSearch, onExportMenuKey, onExportMenuOutside, onMoreMenuKey, onMoreMenuOutside, onViewMenuKey, onViewMenuOutside, openAmpereDistinta, openCart, openCartCtxMenu,
  openCartsMenu, openCatPopover, openComponi, openComponiAnalisi, openComponiFromDetail, exportComputoExcel, openComputoPDF, openDetail, openDistintaModal,
  openExport, openFolder, openGuide, openLivelloPopover, openModal, openQuickEdit, pad, padN, parseNum, parseXLSX, parseXML,
  persistCarts, persistCatDb, persistCatDbOrigin, persistCustomLive, persistLibreria, phiChoiceHtml, phiComponiRow,
  phiConfirmDistinta, phiDescFull, phiDraftKey, phiMatchRows, phiPick, phiPool, phiScore, phiSearchInline,
  pickAmpere, populateSel, publishComputo, pushCart, qePickRow, qeSearchInline, quickEditSave, rebuildRows, refreshCartOverlayIfOpen, refreshCatDbGroups,
  regBadge, regColor, removeCustomFromCart, removeFromCart, render, renderArchItem, renderCandidati, renderCartsList,
  renderCatPopoverList, renderComponi, renderLibreria, renderList, renderLivelloPopoverList, renderPag, renderRegionGroups, renderSidebar,
  renderTableRows, renderTree, resetFilters, restoreMiuState, rowByKey, rowKey, rowsBySearchSel, sanitizeXmlText,
  saveCurrentCart, savePhiDraft, setCategoria, setCategoriaLivello, setColumns, setDensity, setDescLines, setQtyCustom,
  setExportMenu, setMode, setMoreMenu, setQtyManual, setStep, setThemeExternal, setTreeVoce, setView, setViewMenu, showCopyPopup, showState, sniffRegion,
  renderSelDock, toggleSelDock,
  toast, toggleCatPopoverNew, toggleExportMenu, toggleMacro, toggleMoreMenu, toggleRegGroup, toggleRow, toggleSelAll, toggleTheme,
  toggleTopGroup, toggleViewMenu, treeVoce, tryAmpereFile, umLabel, umToMetel, updateAPFascicoloBtn, updateActiveBanner,
  updateCartInfo, updateDetailCartBtn, updateFiltriBtnLabel, walkTree,
  wireCartSelection, wireEpFloat, xmlEsc,
  setCatDbFilter,
  S, CART_SEL,
});

// STEP 2: esportati per i moduli estratti (export.js). Live-binding, import circolare sicuro.

// modulo (compositore, ...) le importa da './index.js' e risolve sempre.


// var locali di index.js (stato non-condiviso)

// ri-esporta le funzioni dei moduli estratti (import da fratelli)


// var locali di index.js (stato non-condiviso)

// ri-esporta le funzioni dei moduli estratti (import da fratelli)


// var locali di index.js (stato non-condiviso)

// ri-esporta le funzioni dei moduli estratti (import da fratelli)

// barrel STEP 2: funzioni locali di index.js
export {
  _syncRail, applyThemeMiu, applyViewControls, closeGuide, closeModal, collectMiuState, esc, fmt, hideState, measureChrome, miuAutoModeForComputo, normSearch, onViewMenuKey, onViewMenuOutside, openExport, openGuide, openModal, restoreMiuState, setDensity, setDescLines, setMode, setStep, setThemeExternal, setView, setViewMenu, showState, toast, toggleTheme, toggleViewMenu
}

// var locali di index.js (stato non-condiviso)
export {
  CURRENT_STEP, MIU_STEPS
}

// ri-esporta le funzioni dei moduli estratti (import da fratelli)
export {
  b64ToUint8, buildMetelContent, buildTSVContent, cartAllEntries, cartAnalisi, cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartCtxAssign, cartCtxAssignLivello, cartCtxMisure, cartDuplicateKeys, cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyBadgeHtml, cartRemoveKeys, cartRigaMDO, cartRows, cartSelClear, cartSelToggle, cartSetView, cartTotals, cartTreeToggle, cartUpdateSelUI, cartViewSwitchHtml, cartWarn, catChipDragOver, catChipDrop, catChipEdit, catChips3Html, catClearBtnHtml, catDbAdd, catDbAll, catDbDatalistsHtml, catDbDragStart, catDbFeedPath, catDbGroupsHtml, catDbOrigine, catDbPanelHtml, catDbRemove, categoriaChipHtml, categoriaColor, categoriaDaDistinta, categoriaHeaderRow, categoriaLabel, categoriaParts, categoriaSlots, categorieUsate, cmpAPAddRigaCustom, cmpAPAddToCart, cmpAPAutoSuggestManodopera, cmpAPAutoSuggestMateriale, cmpAPByCodice, cmpAPCurrentMacro, cmpAPCustomRowBlur, cmpAPDefault, cmpAPDescDiretta, cmpAPDuplicaRiga, cmpAPEnsure, cmpAPExportExcel, cmpAPExportPdf, cmpAPImportScomposizione, cmpAPMoMenuToggle, cmpAPMoReplace, cmpAPNewVoce, cmpAPRefPick, cmpAPRefResults, cmpAPRefSearchInput, cmpAPRemoveRiga, cmpAPRender, cmpAPRenderRefResults, cmpAPRenderSearchResults, cmpAPRenderSectionTotals, cmpAPRenderTotals, cmpAPSaveToLibreria, cmpAPSearchInput, cmpAPSearchPick, cmpAPSearchResults, cmpAPSetField, cmpAPSetPct, cmpAPSetRigaPrezzo, cmpAPSetRigaQty, cmpAPSetRigaUm, cmpAPSezioneHTML, cmpAPSnapshot, cmpAPUpdateRowImp, cmpAcc, cmpAddCustom, cmpAddToCart, cmpApplyLibState, cmpCandAdd, cmpCandLoad, cmpCandSave, cmpClearDraft, cmpConfLabel, cmpCopy, cmpCurrentDescrizione, cmpDatasheetPick, cmpDraftHasContent, cmpDraftPayload, cmpDsInfoToggle, cmpEditAnalisiFromCart, cmpEditFromCart, cmpEditorCopy, cmpEditorInput, cmpEditorPull, cmpFacileSet, cmpFamSearch, cmpFlashBtn, cmpFrasario, cmpFreeMisura, cmpKey, cmpLibAdd, cmpLibDelete, cmpLibEdit, cmpLibGroupHTML, cmpLibGroupOpen, cmpLibItemHTML, cmpLibItems, cmpLoadDraft, cmpLoadVocePronta, cmpMacroFilter, cmpMacroShort, cmpMetelLookup, cmpNewVoce, cmpPersistDraft, cmpPickFam, cmpPrezzarioMisure, cmpPropText, cmpResetVoce, cmpSaveToLibreria, cmpSet, cmpSetMode, cmpShowPicker, cmpToggleAcc, cmpToggleLib, cmpToggleLibGroup, cmpTypeValue, cmpVocById, cmpVocText, cmpVoceObjectFromCMP, misAddRiga, misCell, misDropRigheVuote, misKeydown, misMutAddRiga, misPanelHtml, misPanelRowEl, misPatchDom, misRemoveRiga, misRerenderPanel, misSetCampo, misToggle, misToggleBtn, misVoceRowEl
}


// Dichiarazioni di index.js usate dai moduli estratti (prima erano solo interne).
export {
  jsEsc, onExportMenuKey, onExportMenuOutside, onMoreMenuKey, onMoreMenuOutside, setColumns, setExportMenu, setMoreMenu, toggleExportMenu, toggleMoreMenu
}

// ── Ri-esporto dei moduli estratti ──
// I moduli legacy fratelli (computo.js, compositore.js, misure.js, …) importano da
// './index.js': ri-esportando qui ciò che si è spostato, nessuno di loro va toccato.
export {
  MIU_CARTS, closeCartsMenu, deleteCartById, loadCartById, loadCarts, migrateLegacySel, openCartsMenu, persistCarts, pushCart, renderCartsList, saveCurrentCart
} from './carrelli.js'
export {
  CAT_DB, CAT_DB_ORIGIN, CAT_LIVELLO_HINT, CAT_PALETTE, CAT_PANEL_FILTER, applyCatPopoverNew, applyCategoriaToKeys, applyLivelloToKeys, byCategoriaKey, closeCatPopover, joinCatSlots, loadCatDb, loadCatDbOrigin, migrateCatDbSp, openCatPopover, openLivelloPopover, persistCatDb, persistCatDbOrigin, refreshCatDbGroups, renderCatPopoverList, renderLivelloPopoverList, setCatDbFilter, setCategoria, setCategoriaLivello, toggleCatPopoverNew
} from './categorie-db.js'
export {
  closeCopyPopup, copyToClipboard, showCopyPopup
} from './clipboard.js'
export {
  CUSTOM_SEQ, MIS_OPEN, _prevCartN, _prevCartRailN, addRowToComputo, addSelectedToComputo, clearCart, clearSearchSel, closeCart, collectExportRows, custSetPrezzo, custSetUm, customRowsHtml, exportComputoExcel, mdoBadgeHtml, nextCustomKey, openCart, openComputoPDF, persistCustomLive, publishComputo, refreshCartOverlayIfOpen, removeCustomFromCart, removeFromCart, rowByKey, rowsBySearchSel, setQtyCustom, setQtyManual, updateCartInfo
} from './computo-overlay.js'
export {
  AP_MAT_SUGGESTED, AP_MO_SUGGESTED, AP_TIPI, AP_TIPO_LABEL, CMP_CANDIDATI, CMP_MACRO_ORDER, CMP_TYPE_TIMERS, _detailRow, _detailVals, _dsBusy, apBuildSheet, apMoLabel, closeComponi, closeDetail, cmpDatasheetFile, cmpMacroKey, copyField, detailCartAction, exportFascicoloAP, exportFascicoloAPPdf, loadLibreria, openComponi, openComponiAnalisi, openComponiFromDetail, openDetail, persistLibreria, renderCandidati, renderComponi, renderLibreria, updateAPFascicoloBtn, updateDetailCartBtn
} from './dettaglio.js'
export {
  PHI_KIND_FAMIGLIA, PHI_TEMA, _distGroups, _distItems, _distMeta, _phiChoice, _phiMatches, _phiResults, clearPhiDraft, closePhiDistinta, distItemId, groupPhiItems, loadPhiDraft, openAmpereDistinta, openDistintaModal, savePhiDraft
} from './distinte.js'
export {
  EP_FLOAT_KEY, _epFloatDragging, _epFloatGlobalWired, _epFloatOx, _epFloatOy, commitRowToElencoPrezzi, elencoKeyOf, elencoPrezziPanelHtml, elencoRemove, epDragEnd, epDragStart, epDropSuComputo, epFloatClose, epFloatHtml, epFloatOpen, epFloatSave, epFloatState, isInElencoPrezzi, mountEpFloat, wireEpFloat
} from './elenco-prezzi.js'
export {
  UM_METEL, exportMetel, latin1Bytes, pad, padN, sanitizeXmlText, umLabel, umToMetel, xmlEsc
} from './export-metel.js'
export {
  _qeKey, _qeKeydown, _qePickedRow, _qeResults, _qeSearchTimer, closeQuickEdit, openQuickEdit, qePickRow, qeSearchInline, quickEditSave
} from './quick-edit.js'
export {
  _noMotion, _prevView, buildTree, captureRowTops, checkPage, crossfadeBox, displayShort, expand, flipCascade, gp, parseNum, render, renderList, renderPag, renderTableRows, renderTree, rowKey, toggleRow, treeVoce, walkTree
} from './render.js'
export {
  FILTER_FIELD, FILTER_LABEL, FILTER_ORDER, HIER, MACRO_KEY, REGIONS, REG_COLORS, _filterTimer, activePrezzarioLabel, addFiles, ampereFilePicked, buildFilters, buildMacroChips, cascade, countActiveFiltri, debouncedFilter, detectFromFilename, discBadge, doFilter, filterMiniSearch, handleFileInput, importAmpereMatrix, initDropZone, itemTipo, loadItem, macroPool, macroSel, matBadge, metelSupplierFromName, openFolder, parseXLSX, parseXML, pickAmpere, populateSel, rebuildRows, regBadge, regColor, resetFilters, sniffRegion, toggleMacro, tryAmpereFile, updateActiveBanner, updateFiltriBtnLabel
} from './ricerca.js'
export {
  _cartLassoTrascinato, _didDrag, _dragOn, _dragStartKey, _dragging, _mouseDown, _rowClick, _selAnchor, _selBox, _selFocus, _selFocusKey, _selKeydown, _selKeys, _selRange, _selRestoreFocus, _selRowEl, _selSet, _selWired, _treeFocusNav, _treeKeydown, _treeRestoreFocus, _treeRows, _treeSetFocus, _selDockWired, _wireSelDoc, attachRowEvents, closeCartCtxMenu, openCartCtxMenu, renderSelDock, toggleSelAll, toggleSelDock, wireCartSelection
} from './selezione.js'
export {
  renderArchItem, renderRegionGroups, renderSidebar, toggleRegGroup, toggleTopGroup, updateSidebarCollapsedLabel
} from './sidebar.js'
