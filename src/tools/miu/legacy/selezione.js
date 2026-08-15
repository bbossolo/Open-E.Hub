/* μ (Prezzi) legacy — selezione delle righe — clic, trascinamento, tastiera, intervallo —
   e menu contestuale del computo. Era il pezzo rimasto fuori dallo STEP 2.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { cartCtxAssign, cartCtxAssignLivello, cartCtxMisure, cartDuplicateKeys, cartRemoveKeys, cartSelToggle, cartUpdateSelUI } from './computo.js'
import { misToggle } from './misure.js'
import { CART_SEL, S } from './stato.js'
import { showCopyPopup } from './clipboard.js'
import { rowsBySearchSel, updateCartInfo } from './computo-overlay.js'
import { openDetail } from './dettaglio.js'
import { esc, fmt } from './index.js'
import { displayShort, render, renderTree, rowKey } from './render.js'

// ── SELEZIONE VOCI (S.sel = carrello): doppio-click=toggle, Shift=range, drag=pennello,
//    frecce=cursore + Spazio toggle + Shift-frecce estende. Il click singolo NON tocca
//    la selezione: apre il dettaglio (vedi attachRowEvents) — la selezione resta
//    disponibile anche via checkbox/drag. Additiva/sottrattiva, mai azzera tutto (è un
//    carrello di voci, non un file-browser). ─────────────────────────────────────────
export let _selAnchor=null, _selFocusKey=null, _dragging=false, _didDrag=false, _dragStartKey=null, _dragOn=true, _mouseDown=false, _selWired=false, _treeFocusNav=null;
export function _selBox(){ return S.view==='table'?document.getElementById('tbody') : S.view==='list'?document.getElementById('listview') : document.getElementById('treeview'); }
export function _selKeys(){ const b=_selBox(); return b?[...b.querySelectorAll('[data-key]')].map(e=>e.dataset.key):[]; }
export function _selRowEl(key){ const b=_selBox(); if(!b) return null; try{ return b.querySelector('[data-key="'+(window.CSS&&CSS.escape?CSS.escape(key):key)+'"]'); }catch(e){ return null; } }
export function _selSet(key,on){ if(on===S.searchSel.has(key)) return; if(on) S.searchSel.add(key); else S.searchSel.delete(key); const el=_selRowEl(key); if(el){ el.classList.toggle('sel',on); const cb=el.querySelector('input[type=checkbox]'); if(cb) cb.checked=on; } }
export function _selRange(a,b,on){ const ks=_selKeys(); let i=ks.indexOf(a), j=ks.indexOf(b); if(i<0||j<0) return; if(i>j){ const t=i; i=j; j=t; } for(;i<=j;i++) _selSet(ks[i],on); }
export function _selFocus(key,scroll){ const b=_selBox(); if(b) b.querySelectorAll('.row-focus').forEach(e=>e.classList.remove('row-focus')); _selFocusKey=key; if(!key) return; const el=_selRowEl(key); if(el){ el.classList.add('row-focus'); if(scroll&&el.scrollIntoView) el.scrollIntoView({block:'nearest'}); } }
export function _selRestoreFocus(){ if(_selFocusKey && _selRowEl(_selFocusKey)) _selRowEl(_selFocusKey).classList.add('row-focus'); }
// doppio-click su una riga (Shift = range dall'ancora; altrimenti toggle)
export function _rowClick(key,e){
  if(e.shiftKey && _selAnchor){ _selRange(_selAnchor,key,true); }
  else { _selSet(key,!S.searchSel.has(key)); _selAnchor=key; }
  _selFocus(key,false); updateCartInfo();
}
// ── Navigazione tastiera VISTA CAPITOLI (albero): ↑↓ scorrono nodi e voci, → espande
//    (o va al figlio), ← comprime (o va al genitore), Spazio/Invio toggle, Esc esci. ──
export function _treeRows(){ const c=document.getElementById('treeview'); return c?[...c.querySelectorAll('[data-nav]')]:[]; }
export function _treeSetFocus(el){
  const c=document.getElementById('treeview'); if(c) c.querySelectorAll('.row-focus').forEach(x=>x.classList.remove('row-focus'));
  _treeFocusNav = el?el.dataset.nav:null;
  if(el){ el.classList.add('row-focus'); if(el.scrollIntoView) el.scrollIntoView({block:'nearest'}); }
}
export function _treeRestoreFocus(scroll){
  if(!_treeFocusNav) return;
  const el=_treeRows().find(x=>x.dataset.nav===_treeFocusNav);
  if(el){ el.classList.add('row-focus'); if(scroll&&el.scrollIntoView) el.scrollIntoView({block:'nearest'}); }
}
export function _treeKeydown(e){
  const rows=_treeRows(); if(!rows.length) return;
  const idx = _treeFocusNav ? rows.findIndex(x=>x.dataset.nav===_treeFocusNav) : -1;
  const cur = idx>=0?rows[idx]:null;
  const k=e.key;
  if(k==='ArrowDown'||k==='ArrowUp'){ e.preventDefault(); _treeSetFocus(rows[idx<0?0:Math.min(rows.length-1,Math.max(0,idx+(k==='ArrowDown'?1:-1)))]); }
  else if(k==='ArrowRight'){ e.preventDefault();
    if(cur&&cur.dataset.node){ // intestazione: se chiusa apri, se aperta vai al primo figlio
      if(cur.dataset.open==='0'){ S.treeOpen.add(cur.dataset.node); _treeFocusNav=cur.dataset.nav; renderTree(); _treeRestoreFocus(true); }
      else _treeSetFocus(rows[Math.min(rows.length-1,idx+1)]);
    }
  }
  else if(k==='ArrowLeft'){ e.preventDefault();
    if(cur&&cur.dataset.node&&cur.dataset.open==='1'){ S.treeOpen.delete(cur.dataset.node); _treeFocusNav=cur.dataset.nav; renderTree(); _treeRestoreFocus(true); }
    else if(cur&&cur.dataset.parent){ const p=rows.find(x=>x.dataset.nav==='h:'+cur.dataset.parent); if(p) _treeSetFocus(p); }
  }
  else if(k===' '||k==='Spacebar'||k==='Enter'){ if(!cur) return; e.preventDefault();
    if(cur.dataset.node){ if(cur.dataset.open==='1')S.treeOpen.delete(cur.dataset.node); else S.treeOpen.add(cur.dataset.node); _treeFocusNav=cur.dataset.nav; renderTree(); _treeRestoreFocus(true); }
    else { const key=cur.dataset.key; _selSet(key,!S.searchSel.has(key)); _selAnchor=key; updateCartInfo(); }
  }
  else if(k==='Escape'){ _treeSetFocus(null); }
}

// tastiera: frecce muovono il cursore, Spazio toggle, Shift+frecce estende, Ctrl/⌘+A tutto
export function _selKeydown(e){
  if(e.target.closest && e.target.closest('input,textarea,select,button,[contenteditable]')) return;
  if(S.view==='tree'){ _treeKeydown(e); return; }
  const ks=_selKeys(); if(!ks.length) return;
  const idx = _selFocusKey?ks.indexOf(_selFocusKey):-1;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    const ni = idx<0 ? 0 : Math.min(ks.length-1, Math.max(0, idx+(e.key==='ArrowDown'?1:-1)));
    const nk=ks[ni];
    if(e.shiftKey){ if(!_selAnchor) _selAnchor=_selFocusKey||nk; _selRange(_selAnchor,nk,true); updateCartInfo(); }
    _selFocus(nk,true);
  } else if(e.key===' '||e.key==='Spacebar'){
    if(_selFocusKey){ e.preventDefault(); _selSet(_selFocusKey,!S.searchSel.has(_selFocusKey)); _selAnchor=_selFocusKey; updateCartInfo(); }
  } else if((e.ctrlKey||e.metaKey)&&(e.key==='a'||e.key==='A')){
    e.preventDefault(); ks.forEach(k=>_selSet(k,true)); updateCartInfo();
  } else if(e.key==='Escape'){ _selFocus(null); }
}
// listener globali (una volta): stato del mouse per il drag + fine drag + tastiera pannello
export function _wireSelDoc(){
  if(_selWired) return; _selWired=true;
  document.addEventListener('mousedown', e=>{ if(e.button===0) _mouseDown=true; });
  document.addEventListener('mouseup', ()=>{ _mouseDown=false; if(_dragging){ _dragging=false; document.body.classList.remove('sel-dragging'); } _dragStartKey=null; });
  // tastiera a livello documento: agisce sul pannello voci quando non si sta scrivendo
  // in un campo (guardia in _selKeydown). Niente gestione focus fragile.
  document.addEventListener('keydown', _selKeydown);
}

// Eventi riga condivisi da tutte le viste. Click singolo = apre il dettaglio (pannello
// laterale); doppio-click = seleziona/toglie dal carrello di ricerca (ex comportamento
// del click singolo, spostato qui su richiesta utente — il dettaglio a un click era
// troppo invasivo per la sola consultazione).
export function attachRowEvents(el,r,key){
  el.dataset.key=key;
  el.addEventListener('dblclick', e=>{
    if(e.target.closest && e.target.closest('input,button,a,.qty-in')) return;
    _rowClick(key,e);
  });
  el.addEventListener('mousedown', e=>{
    if(e.button!==0 || e.shiftKey || (e.target.closest && e.target.closest('input,button,a,.qty-in'))) return;
    _dragStartKey=key; _dragOn=!S.searchSel.has(key); _dragging=false; _didDrag=false;   // pennello: opposto dello stato di partenza
  });
  el.addEventListener('mouseenter', ()=>{
    if(_dragStartKey==null || !_mouseDown) return;
    if(!_dragging){ _dragging=true; _didDrag=true; document.body.classList.add('sel-dragging'); if(window.getSelection) getSelection().removeAllRanges(); _selSet(_dragStartKey,_dragOn); _selAnchor=_dragStartKey; }
    _selRange(_dragStartKey,key,_dragOn); _selFocus(key,false); updateCartInfo();
  });
  el.addEventListener('click', e=>{
    if(_didDrag){ _didDrag=false; return; }   // il drag ha già gestito: non riaprire il dettaglio
    if(e.target.closest('input,button,.qty-in')) return;
    openDetail(r);
  });
}
// ── VISTE del Computo Metrico: Tabella (misure/prezzi) / Categorie (pannello
// database a sinistra + voci con le 3 chip del percorso, assegnazione drag&drop
// o manuale con suggerimenti) / Elenco (scansione densa). ───────────────────
export let _cartLassoTrascinato=false; // true se l'ultimo gesto è stato un lazo (e non un clic)
// Datalist per l'editing manuale delle chip (suggerimenti dal DB, per livello).
// Le 3 chip del percorso di una voce (Supercategoria › Categoria › Sottocategoria):
// vuote = tratteggiate col "+", piene = colorate (colore = Supercategoria).
// Dragover su una chip di livello specifico: preventDefault (= "posso
// accettare il drop") SOLO se la chip trascinata è dello stesso livello, e
// SEMPRE stopPropagation — ogni chip decide da sola, non delega mai alla
// riga sotto. Senza lo stopPropagation l'evento risaliva fino al drop-zone
// generico della riga (bug: una Sottocategoria trascinata su un'ALTRA chip
// finiva comunque assegnata, perché il fallback della riga la intercettava).
// Drop su una chip specifica: accetta SOLO lo stesso livello (letto dal
// formato per-livello) e FERMA la propagazione sempre — un drop rifiutato
// qui non deve MAI ricadere sulla riga sottostante: ogni famiglia di
// categoria (Supercategoria/Categoria/Sottocategoria) vive solo nella
// propria chip, indipendente dalle altre due.
// Editing manuale di una chip: input in place con datalist del livello.
// Invio/blur conferma (vuoto = toglie il livello), Esc annulla.
// ── selezione multipla nel Computo Metrico (lazo + menu contestuale) — un
// concetto SEPARATO da S.sel/S.custom ("è nel computo"): qui è "è evidenziata
// per un'azione di gruppo" (assegna categoria, duplica, rimuovi). ───────────

// Rimuove dal computo qualunque chiave, reale o composta (distingue da sé).
// Duplica: ha senso solo per le voci COMPOSTE (una voce reale è un riferimento
// al prezzario, non un oggetto da clonare) — le altre nella selezione si ignorano.
// Duplica sia le voci COMPOSTE sia quelle di PREZZARIO. Una voce di prezzario
// duplicata diventa una COPIA indipendente (composta, con il suo codice reale): la
// stessa voce può così comparire in più Sottocategorie diverse — es. un allaccio
// che va sotto più discipline — categorizzando ogni copia a parte.
/* Restituisce le chiavi NUOVE: serve a chi deve poi portarti su di esse (il trascinamento
   dall'Elenco Prezzi apre le misure della riga appena creata). Chi non le usa, le ignora. */
// Lazo (drag su un'area vuota del corpo) + menu contestuale (clic destro):
// stesso concetto già in uso nel browser prezzario (attachRowEvents/_selBox),
// qui riscritto per le chiavi del computo (reali+composte) e scoped a CART_SEL.
export function wireCartSelection(ov){
  const bodyEl=ov.querySelector('#cart-ov-body');
  ov.querySelectorAll('.cm-sel-row').forEach(row=>{
    row.classList.toggle('selected', CART_SEL.has(row.dataset.key));
    row.addEventListener('click', (e)=>{
      // se il puntatore ha TRASCIATO, quello era un lazo e non un clic: la riga non reagisce
      if(_cartLassoTrascinato){ _cartLassoTrascinato=false; return; }
      if(e.target.closest('.cat-chip')||e.target.closest('.cat3-chip')||e.target.closest('.cm-ap-badge')||e.target.closest('.cm-mis-link')||e.target.closest('button')||e.target.closest('input')) return;
      const additive=e.shiftKey||e.metaKey||e.ctrlKey;
      // Un tocco di velocità: in vista Tabella il clic semplice su una voce apre
      // le misure GIÀ pronte da digitare (prima riga creata, campo a fuoco). La
      // selezione per azioni di gruppo resta su modificatori / lazo / tasto destro.
      if(!additive && document.getElementById('cart-ov-tbody')){
        misToggle(row.dataset.key);
        return;
      }
      cartSelToggle(row.dataset.key, additive);
    });
    row.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      if(!CART_SEL.has(row.dataset.key)){ CART_SEL.clear(); CART_SEL.add(row.dataset.key); cartUpdateSelUI(); }
      openCartCtxMenu(e.pageX, e.pageY);
    });
  });
  if(!bodyEl) return;
  /* IL LAZO — trascina per selezionare più voci.
     Prima poteva partire SOLO dallo spazio vuoto fra le righe (`if(e.target.closest('.cm-sel-row')) return`).
     In Tabella e in Elenco le righe sono fitte: di spazio vuoto non ce n'è, e il lazo era di
     fatto inutilizzabile — «tutte le liste devono avere il lazo».
     Ora parte da qualunque punto, anche da sopra una voce, e si distingue dal clic per il
     MOVIMENTO: sotto i 5 px è un clic (apre le misure), sopra è un lazo. È la stessa regola
     dei CAD sulla pianta, ed è la sola che non obbliga l'utente a mirare. */
  let lassoStart=null, lassoBox=null;
  function onMove(e){
    if(!lassoStart) return;
    // finché non ti sei mosso abbastanza, è ancora un clic: nessun box, nessuna selezione
    if(!lassoBox){
      if(Math.abs(e.pageX-lassoStart.x)<5 && Math.abs(e.pageY-lassoStart.y)<5) return;
      lassoBox=document.createElement('div'); lassoBox.className='cart-lasso-box';
      document.body.appendChild(lassoBox);
      bodyEl.style.userSelect='none'; // niente selezione nativa del testo sotto il lazo
      _cartLassoTrascinato=true;      // il click che seguirà il mouseup non deve fare nulla
    }
    const x=Math.min(lassoStart.x,e.pageX), y=Math.min(lassoStart.y,e.pageY);
    const w=Math.abs(e.pageX-lassoStart.x), h=Math.abs(e.pageY-lassoStart.y);
    Object.assign(lassoBox.style,{ left:x+'px', top:y+'px', width:w+'px', height:h+'px' });
    const box=lassoBox.getBoundingClientRect();
    ov.querySelectorAll('.cm-sel-row').forEach(row=>{
      const r=row.getBoundingClientRect();
      const hit=!(r.right<box.left||r.left>box.right||r.bottom<box.top||r.top>box.bottom);
      row.classList.toggle('selected', hit||CART_SEL.has(row.dataset.key));
    });
  }
  function onUp(){
    if(!lassoStart) return;
    if(lassoBox){ // c'è stato un trascinamento: prendi tutto ciò che il box ha toccato
      ov.querySelectorAll('.cm-sel-row.selected').forEach(row=>CART_SEL.add(row.dataset.key));
      cartUpdateSelUI();
      lassoBox.remove(); lassoBox=null;
    }
    lassoStart=null;
    bodyEl.style.userSelect='';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  bodyEl.addEventListener('mousedown', (e)=>{
    if(e.button!==0) return; // il tasto destro apre il menu, non traccia un lazo
    // i comandi VERI restano cliccabili: il lazo non parte da un pulsante, da un campo,
    // da una chip di categoria o dal database delle categorie (da lì si TRASCINA la chip).
    if(e.target.closest('button')||e.target.closest('input')||e.target.closest('.cat-chip')
      ||e.target.closest('.cat3-chip')||e.target.closest('.catdb-panel')
      ||e.target.closest('.cm-mis-link')||e.target.closest('.cm-ap-badge')) return;
    lassoStart={ x:e.pageX, y:e.pageY };
    _cartLassoTrascinato=false;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
export function openCartCtxMenu(x,y){
  closeCartCtxMenu();
  const menu=document.createElement('div');
  menu.id='cart-ctx-menu'; menu.className='cart-ctx';
  const n=CART_SEL.size;
  menu.innerHTML=`
    <div class="cart-ctx-hint">${n} vo${n===1?'ce':'ci'} selezionat${n===1?'a':'e'}</div>
    <div class="cart-ctx-item primary" onclick="cartCtxAssign()">🏷 Assegna categoria…</div>
    <div class="cart-ctx-lv3">
      <button onclick="cartCtxAssignLivello(0)" title="Assegna solo la Supercategoria (ambito: Esterni, Cabina elettrica…)">Supercat.</button>
      <button onclick="cartCtxAssignLivello(1)" title="Assegna solo la Categoria (disciplina: Impianti Elettrici, Meccanici…)">Categoria</button>
      <button onclick="cartCtxAssignLivello(2)" title="Assegna solo la Sottocategoria (voce della disciplina: Quadri Elettrici, Climatizzazione…)">Sottocat.</button>
    </div>
    <div class="cart-ctx-item" onclick="cartCtxMisure()">📏 Apri misure</div>
    <div class="cart-ctx-item" onclick="cartDuplicateKeys([...CART_SEL]);closeCartCtxMenu()">⧉ Duplica</div>
    <div class="cart-ctx-sep"></div>
    <div class="cart-ctx-item" onclick="closeCartCtxMenu();showCopyPopup()" title="Copia rapida TSV delle sole voci selezionate — senza analisi prezzi">📋 Copia</div>
    <div class="cart-ctx-sep"></div>
    <div class="cart-ctx-item danger" onclick="cartRemoveKeys([...CART_SEL]);closeCartCtxMenu()">✕ Rimuovi dal computo</div>`;
  document.body.appendChild(menu);
  const left=Math.min(x, window.innerWidth-220), top=Math.min(y, window.innerHeight-220);
  menu.style.left=Math.max(8,left)+'px'; menu.style.top=Math.max(8,top)+'px';
}
export function closeCartCtxMenu(){ const m=document.getElementById('cart-ctx-menu'); if(m) m.remove(); }
// Assegna VELOCE un solo livello (Supercategoria/Categoria/Sottocategoria) a
// tutta la selezione, senza passare dal popover a 3 campi: apre un piccolo
// popover con i suggerimenti del DB per quel livello soltanto.
document.addEventListener('click', (e)=>{ if(!e.target.closest('.cart-ctx')) closeCartCtxMenu(); }, true);
export function toggleSelAll(){
  // seleziona/deseleziona i risultati filtrati NELLA RICERCA (poi «＋ Aggiungi»); non è il computo
  const allFilteredSelected = S.filtered.length>0 && S.filtered.every(r=>S.searchSel.has(rowKey(r)));
  if(allFilteredSelected) S.filtered.forEach(r=>S.searchSel.delete(rowKey(r)));
  else S.filtered.forEach(r=>S.searchSel.add(rowKey(r)));
  render();
}

/* walkTree() (render.js) segna quale nodo dell'albero ha il fuoco prima di
   ridisegnare: riassegnazione da un altro modulo → setter. */
export function setTreeFocusNav(v) { _treeFocusNav = v }

// ══ DOCK DELLA SELEZIONE ═════════════════════════════════════════════════════
// Le voci scelte nei risultati (S.searchSel) non sono un contatore in una barra:
// sono ciò che si sta costruendo mentre si consulta. Il dock le mostra per nome,
// permette di togliere quella sbagliata con un clic (senza ricercarla nella
// tabella) e porta il comando di copia rapida.
// Lo ridisegna updateCartInfo(), che è già il punto in cui ogni variazione di
// selezione converge (clic, tastiera, pennello, «Seleziona tutti filtrati»).
export let _selDockWired=false;
const SEL_DOCK_FOLD_KEY='miu:sel-dock-folded';

export function renderSelDock(){
  const dock=document.getElementById('sel-dock'); if(!dock) return;
  const n=S.searchSel.size;
  dock.hidden = n===0;
  if(!n) return;
  if(!_selDockWired){
    _selDockWired=true;
    try{ dock.classList.toggle('folded', localStorage.getItem(SEL_DOCK_FOLD_KEY)==='1'); }catch(e){}
    // delega: le voci del dock si ridisegnano a ogni variazione, il listener no
    document.getElementById('sel-dock-list')?.addEventListener('click', e=>{
      const btn=e.target.closest('.sd-x'); if(!btn) return;
      const li=btn.closest('li'); if(!li) return;
      _selSet(li.dataset.key,false);
      updateCartInfo();
    });
  }
  const rows=rowsBySearchSel();
  let tot=0; for(const r of rows) tot+=Number(r.prezzo)||0;
  document.getElementById('sel-dock-n').textContent=n.toLocaleString('it');
  document.getElementById('sel-dock-tot').textContent = tot>0 ? '€ '+fmt(tot) : '';
  document.getElementById('sel-dock-list').innerHTML = rows.map(r=>{
    const key=rowKey(r);
    return `<li data-key="${esc(key)}">
      <span class="sd-code">${esc(r.codice)}</span>
      <span class="sd-desc" title="${esc(displayShort(r))}">${esc(displayShort(r))}</span>
      <span class="sd-um">${esc(r.um||'')}</span>
      <span class="sd-price">${fmt(r.prezzo)} €</span>
      <button class="sd-x" title="Togli questa voce dalla selezione">✕</button>
    </li>`;
  }).join('');
}
// Comprimi/espandi l'elenco (il piede col comando di copia resta sempre a vista).
export function toggleSelDock(){
  const dock=document.getElementById('sel-dock'); if(!dock) return;
  const folded=dock.classList.toggle('folded');
  try{ localStorage.setItem(SEL_DOCK_FOLD_KEY, folded?'1':'0'); }catch(e){}
}

