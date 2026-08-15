/* μ (Prezzi) legacy — l'overlay del Computo Metrico: apertura/chiusura, righe e voci
   custom, quantità, riepilogo e pubblicazione verso gli altri tool.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { categoriaChipHtml, categoriaHeaderRow } from './categorie.js'
import { cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartDuplicateKeys, cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyBadgeHtml, cartRemoveKeys, cartRigaMDO, cartRows, cartSelClear, cartTotals, cartUpdateSelUI, cartViewSwitchHtml, cartWarn } from './computo.js'
import { misPanelHtml, misToggleBtn } from './misure.js'
import { CART_MODE, CART_QUERY, CART_SEL, CART_VIEW, S } from './stato.js'
import { byCategoriaKey, closeCatPopover } from './categorie-db.js'
import { showCopyPopup } from './clipboard.js'
import { apBuildSheet, updateAPFascicoloBtn } from './dettaglio.js'
import { commitRowToElencoPrezzi, elencoKeyOf, epDropSuComputo, isInElencoPrezzi, mountEpFloat } from './elenco-prezzi.js'
import { _syncRail, esc, fmt, miuAutoModeForComputo, setStep, toast } from './index.js'
import { openQuickEdit } from './quick-edit.js'
import { parseNum, render, rowKey } from './render.js'
import { closeCartCtxMenu, renderSelDock, wireCartSelection } from './selezione.js'

// ── VOCI COMPOSTE = STATO DI SESSIONE ─────────────────────────────────────────
// Le voci composte (S.custom) + quantità vivono in memoria durante la sessione e
// vengono salvate solo nei Carrelli salvati a mano e nel progetto .ehub. NON sono
// più persistite in localStorage fra sessioni (evita residui in «nuovo progetto»/
// chiusura sessione). persistCustomLive resta no-op per non toccare i call-site.
export function persistCustomLive(){ /* no-op: le voci composte sono di sessione (vedi .ehub) */ }

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

export let CUSTOM_SEQ = 0;
export function nextCustomKey(){ return 'cmp:'+(++CUSTOM_SEQ)+':'+Date.now(); }
// HTML della cella "Misura": input quantità + marcatore sorgente (⇪ / ✎).
// Imposta/aggiorna la quantità a mano: marca 'manual' e mette la voce nel carrello.
export function setQtyManual(key,val,um){
  const n=parseNum(val);
  // misurare una voce dai risultati = metterla nell'Elenco Prezzi come COPIA e
  // salvare la misura sulla copia (chiave 'ep:'), non più su S.sel.
  const r=rowByKey(key);
  const ek=r?elencoKeyOf(r):key;
  if(!(n>0)){
    delete S.qty[ek];                        // svuotando si toglie la misura (non la voce)
  } else {
    if(r && !S.custom.has(ek)) commitRowToElencoPrezzi(r); // misurare = includere nel computo
    const prevUm=S.qty[ek]&&S.qty[ek].um;
    S.qty[ek]={ qty:n, um: prevUm||um||'', source:'manual' };
  }
  render();                                  // riallinea .sel e marcatore sorgente
  updateCartInfo();
}
// Quantità di una voce CUSTOM (composta, non da S.archive) — stesso formato di
// S.qty delle voci reali, ma NON tocca S.sel (quel Set resta riservato alle righe reali).
export function setQtyCustom(key,val,um){
  const n=parseNum(val);
  if(!(n>0)) delete S.qty[key];
  else S.qty[key]={ qty:n, um: um||'', source:'manual' };
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
// ── COMPUTO METRICO: misurazioni multi-riga per voce (L1×L2×H×n) ──
// S.qty[key].misurazioni = MisurazioneRiga[] (opzionale, coesiste con .qty che
// resta il totale calcolato — vedi src/shared/compositore/misurazioni.ts). Un
// pannello per riga di carrello (reale o composta), apribile/richiudibile.
export let MIS_OPEN=new Set(); // chiavi con pannello misurazioni aperto nell'overlay carrello
// Intestazione di gruppo quando cambia la categoria (vista raggruppata del computo metrico).
// Prezzo manuale di una voce custom (l'utente lo imposta perché non c'è un
// prezzo di listino) — mai bloccante, resta "senza prezzo" finché non lo valorizza.
export function custSetPrezzo(key,val){
  const it=S.custom.get(key); if(!it) return;
  const n=parseNum(val);
  it.prezzo = (n>0) ? n : null;
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
// Unità di misura editabile per una voce composta (Descrizione o
// Analisi Prezzi) direttamente dal carrello — prima era fissa (dalla famiglia
// o dall'Analisi Prezzi al momento dell'aggiunta), non correggibile dopo.
export function custSetUm(key,val){
  const it=S.custom.get(key); if(!it) return;
  it.um = (val||'').trim();
  const q=S.qty[key]; if(q) q.um = it.um; // la quantità salvata segue la stessa UM
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
export function removeCustomFromCart(key){
  const _undoItem=S.custom.get(key), _undoQty=S.qty[key], _undoCat=S.categoria[key];
  S.custom.delete(key);
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  MIS_OPEN.delete(key); CART_SEL.delete(key);
  refreshCartOverlayIfOpen();
  updateCartInfo();
  if(_undoItem) window.ehbFeedback?.undoToast('Voce composta rimossa dal computo', ()=>{
    S.custom.set(key,_undoItem);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    refreshCartOverlayIfOpen(); updateCartInfo(); render();
  });
}
// Il carrello è una funzione fondamentale di μ: il bottone vive nell'header,
// SEMPRE visibile (non solo quando la results-bar di un prezzario è a video).
export let _prevCartN=0;
export let _prevCartRailN=0; // stessa logica di _prevCartN, ma per il flash del binario (rail-computo)
export function updateCartInfo(){
  const n=S.sel.size+S.custom.size; // il badge conta anche le voci composte
  miuAutoModeForComputo(n);         // computo popolato + nessuna scelta dell'utente ⇒ modalità Completa
  const btn=document.getElementById('cart-btn');
  if(btn){
    if(n>_prevCartN){ btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); } // pulsa all'aggiunta
    _prevCartN=n;
    const cnt=btn.querySelector('.cart-count'), tot=btn.querySelector('.cart-total');
    if(n>0){
      btn.classList.remove('disabled'); btn.classList.add('active');
      if(cnt){ cnt.style.display='inline'; cnt.textContent=n.toLocaleString('it'); }
      const t=cartTotals();
      if(tot){ tot.style.display = t.tot>0 ? 'inline' : 'none'; tot.textContent = t.tot>0 ? '€ '+fmt(t.tot) : ''; }
      btn.title=`${n.toLocaleString('it')} voci nel computo metrico${t.tot>0?' · € '+fmt(t.tot):''} — clic per vederle`;
    } else {
      btn.classList.add('disabled'); btn.classList.remove('active');
      if(cnt) cnt.style.display='none';
      if(tot) tot.style.display='none';
      btn.title='Computo Metrico vuoto — clic per aprirlo';
    }
  }
  const clearBtn=document.getElementById('btn-cart-clear');
  if(clearBtn) clearBtn.style.display = n>0 ? '' : 'none';
  // Voci scelte nei risultati di ricerca ma NON ANCORA nel computo (S.searchSel,
  // distinto da S.sel/S.custom sopra): hanno il loro pannello a fondo pagina, dove si
  // vedono per nome e si tolgono una a una — non più un contatore nella barra.
  renderSelDock();
  updateAPFascicoloBtn(); // badge fascicolo Σ segue le voci con analisiPrezzi
  persistCustomLive(); // C2: voci composte + quantità sopravvivono al reload
  publishComputo();
  // contesto sul binario: computo attivo (voci · totale)
  const rc=document.getElementById('rail-computo');
  if(rc){
    if(n>0){
      const t=cartTotals(); rc.innerHTML='Computo: <b>'+n.toLocaleString('it')+' voci'+(t.tot>0?' · € '+fmt(t.tot):'')+'</b>';
      if(n>_prevCartRailN) window.ehbFeedback?.flashElement(rc); // stesso segnale del bump su #cart-btn, ma sul binario
    }
    else rc.textContent='';
  }
  _prevCartRailN=n;
}

// Pubblica il computo (carrello valorizzato) sull'hub → consumato dagli altri tool.
export function publishComputo(){
  const items=[];
  for(const [k,r] of cartRows()){
    const q=S.qty[k];
    items.push({ codice:r.codice, desc_short:r.desc_short, declaratoria:r.declaratoria,
      um:r.um, prezzo:r.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:r.regione, anno:r.anno, tematica:r.tematica, source:q?q.source:undefined,
      // categoria assegnata a mano nel computo metrico: i consumatori la usano come sezione
      // esplicita del suo computo (stesso campo/semantica di un import esterno) —
      // vedi src/tools/tau/engine/chapters.ts::sectionOf.
      categoria:S.categoria[k]||undefined });
  }
  // Le voci composte entrano nel computo con lo stesso formato delle voci reali
  // (nessuna voce di prezzario dietro: codice sintetico, niente regione/anno/tematica).
  for(const [k,it] of S.custom){
    const q=S.qty[k];
    items.push({ codice:'✎ composta', desc_short:it.desc_short, declaratoria:it.declaratoria,
      um:it.um, prezzo:it.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:undefined, anno:undefined, tematica:undefined, source:'componi',
      categoria:S.categoria[k]||undefined,
      // inoltro ai consumatori: identità/caratteristiche per il capitolato (additivo)
      famigliaId:it.famigliaId||undefined, caratteristiche:it.caratteristiche||undefined,
      marca:it.marca||undefined, modello:it.modello||undefined, codice_prodotto:it.codice_prodotto||undefined });
  }
  try{ window.parent.postMessage({ type:'app:project-update', appId:'miu-price-list', project:{ items, ts:Date.now() } }, '*'); }catch(e){}
}
// Incidenza % manodopera di una riga del computo — dal prezzario (r.ru) o
// ricalcolata al volo dall'Analisi Prezzi della voce composta (mai un valore
// salvato a parte: resta sempre coerente se l'analisi viene poi modificata).
export function mdoBadgeHtml(pct){
  const p=Math.round(Number(pct)||0);
  return p>0 ? `<span class="cm-mdo-badge" title="Incidenza manodopera">MDO ${p}%</span>` : '';
}
// Nota a fianco del totale: voci non valorizzate (senza misura o senza prezzo).
export function clearCart(){
  if(!S.sel.size && !S.custom.size) return;
  S.sel.clear();
  for(const k of S.custom.keys()) if(S.qty[k]) delete S.qty[k];
  S.custom.clear();
  S.categoria={};
  render();
  toast('Computo svuotato','ok');
}
export function rowByKey(key){
  for(const it of S.archive){ if(it.loaded!==true) continue;
    for(const r of it.rows){ if(rowKey(r)===key) return r; } }
  return null;
}
export function rowsBySearchSel(){
  const out=[];
  for(const it of S.archive){ if(it.loaded!==true) continue;
    for(const r of it.rows){ if(S.searchSel.has(rowKey(r))) out.push(r); } }
  return out;
}
// Aggiunge UNA voce di prezzario (dal ＋ di riga o dal dettaglio) all'Elenco Prezzi.
export function addRowToComputo(key){
  const r=(typeof key==='object')?key:rowByKey(key);
  if(!r) return;
  const already=isInElencoPrezzi(r);
  commitRowToElencoPrezzi(r);
  updateCartInfo(); render();
  toast(already?'Già nel computo':'Aggiunta al computo','ok');
}
// Aggiunge le voci SELEZIONATE nei risultati di ricerca all'Elenco Prezzi.
export function addSelectedToComputo(){
  const rows=rowsBySearchSel();
  if(!rows.length){ toast('Seleziona prima una o più voci nei risultati','warn'); return; }
  let n=0;
  rows.forEach(r=>{ if(!isInElencoPrezzi(r)){ commitRowToElencoPrezzi(r); n++; } });
  S.searchSel.clear();
  updateCartInfo(); render();
  toast(n?`${n} vo${n===1?'ce aggiunta':'ci aggiunte'} al computo`:'Voci già nel computo','ok');
}
// Azzera la selezione dei risultati (S.searchSel), senza toccare il computo.
export function clearSearchSel(){
  if(!S.searchSel.size) return;
  S.searchSel.clear();
  updateCartInfo(); render();
}
// Frammenti riusati sia dal render completo (openCart/customRowsHtml) sia dal
// patch mirato post-misurazioni (misPatchDom) — un'unica sorgente per il markup.
// Riga "Incidenza manodopera media" sotto il totale — assente se non c'è nulla di
// prezzato con manodopera nota (nessun buco da colmare con uno zero fuorviante).
// Riallinea conteggio/totale/avviso nell'header e footer dell'overlay aperto.
// Righe CUSTOM (voci composte senza voce di prezzario) — stesso layout delle
// righe reali, ma prezzo e quantità sono editabili (onchange, non oninput: si conferma
// con Invio/blur, come già in misCell/setQtyManual, per non perdere il focus a ogni tasto).
export function customRowsHtml(){
  const sortedEntries=[...S.custom.entries()].sort(byCategoriaKey);
  let lastCatCustom;
  return sortedEntries.map(([k,it])=>{
    const cat=S.categoria[k]||'';
    const catHeader=(cat && cat!==lastCatCustom)?categoriaHeaderRow(cat):'';
    lastCatCustom=cat;
    const q=S.qty[k];
    const qtyVal=q?String(q.qty).replace('.',','):'';
    const qtyIn=`<input type="text" inputmode="decimal" value="${esc(qtyVal)}" placeholder="—"
      onclick="event.stopPropagation()" onchange="setQtyCustom('${k}',this.value,'${esc(it.um||'')}')"
      style="width:56px;text-align:right;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);font-size:11px;font-family:var(--mono)"
      title="Quantità (Invio per confermare)">`;
    const prezzoIn=`<input type="number" step="0.01" min="0" value="${it.prezzo!=null?it.prezzo:''}" placeholder="—"
      onclick="event.stopPropagation()" onchange="custSetPrezzo('${k}',this.value)"
      style="width:70px;text-align:right;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);font-size:11px;font-family:var(--mono)"
      title="Prezzo manuale (non c'è nel prezzario) — Invio per confermare">`;
    // UM editabile anche per le voci composte (Descrizione E Analisi
    // Prezzi) — prima era testo fisso, solo qty/prezzo si potevano correggere qui.
    const umIn=`<input type="text" value="${esc(it.um||'')}" placeholder="um"
      onclick="event.stopPropagation()" onchange="custSetUm('${k}',this.value)"
      style="width:44px;text-align:center;padding:3px 4px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text3);font-size:10px;font-family:var(--mono)"
      title="Unità di misura — Invio per confermare">`;
    const mdo=cartRigaMDO(null,it);
    return `${catHeader}<tr class="cm-sel-row" data-key="${esc(k)}" style="border-top:1px solid var(--border)">
      <td style="vertical-align:top;padding:6px 4px;font-size:10px;white-space:nowrap">${it.codice
        ?`<span title="Voce con codice originale (non generata da μ) — modificabile come una composta" style="font-family:var(--mono);font-size:11px;color:var(--accent-text)">${esc(it.codice)}</span><br><span style="color:var(--warn);font-weight:700">✎</span>`
        :`<span title="Voce composta, non da prezzario" style="color:var(--warn);font-weight:700">✎ composta</span>`}</td>
      <td style="vertical-align:top;padding:6px 8px">
        <div style="font-size:12px;color:var(--text);line-height:1.35">${esc(it.desc_short||it.declaratoria||'')}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:3px">
          ${it.famNome?`<span style="font-size:9.5px;color:var(--text3)">${esc(it.famNome)}</span>`:''}
          ${umIn}
          <button class="cm-ap-edit-badge" onclick="event.stopPropagation();openQuickEdit('${k}')" title="Modifica rapida: descrizione, prezzo, U.M. (Compositore/Analisi Prezzi dal piede)">${it.analisiPrezzi?'Σ modifica':'✎ modifica'}</button>
          ${mdoBadgeHtml(mdo)}
          ${categoriaChipHtml(k)}
        </div>
      </td>
      <td style="vertical-align:top;padding:6px 4px;text-align:right"><div data-cell="qty">${qtyIn}</div><div data-cell="mis">${misToggleBtn(k)}</div></td>
      <td style="vertical-align:top;padding:6px 4px;text-align:right">${prezzoIn}</td>
      <td data-cell="imp" style="vertical-align:top;padding:6px 4px;text-align:right;font-family:var(--mono);font-size:11.5px;white-space:nowrap">${cartImpCellHtml(it.prezzo||0,q)}</td>
      <td style="vertical-align:top;padding:6px 4px;text-align:center">
        <button onclick="removeCustomFromCart('${k}')" title="Rimuovi dal computo"
                style="background:var(--danger-light);color:var(--danger);border:1px solid var(--danger);border-radius:6px;width:22px;height:22px;font-size:12px;line-height:1;cursor:pointer">✕</button>
      </td>
    </tr>${misPanelHtml(k)}`;
  }).join('');
}
// Ricostruisce l'overlay Carrello se è aperto (dopo un cambio di prezzo/quantità/
// rimozione custom) — no-op se è chiuso. A computo svuotato NON si chiude più:
// openCart() mostra l'empty state (finestra pronta ad accogliere nuove voci).
export function refreshCartOverlayIfOpen(){
  if(!document.getElementById('cart-overlay')) return;
  openCart();
}
export function openCart(){
  // idempotente: ogni modifica dentro l'overlay (es. il pannello misurazioni) lo ricostruisce
  // chiamando openCart() di nuovo — senza questa pulizia si impilano overlay duplicati con lo
  // stesso #cart-overlay, e chiudere quello in vista (il più recente) non lo toglie davvero,
  // perché closeCart() prende il PRIMO match per id (il più vecchio, sotto): serve richiudere
  // più volte. Rimuovendo prima ogni overlay residuo, ne resta sempre e solo uno.
  document.querySelectorAll('#cart-overlay').forEach(el=>el.remove());
  const map=cartRows();
  const T=cartTotals(map);
  // raggruppate per CATEGORIA (assegnazione manuale): categorizzate prima in ordine
  // alfabetico, poi le non categorizzate senza intestazione — vista piatta di default
  // invariata per chi non usa la funzione.
  const sortedEntries=[...map.entries()].sort(byCategoriaKey);
  let lastCatReal;
  const rowsHtml=sortedEntries.map(([k,r])=>{
    const cat=S.categoria[k]||'';
    const catHeader=(cat && cat!==lastCatReal)?categoriaHeaderRow(cat):'';
    lastCatReal=cat;
    const q=S.qty[k];
    const mdo=cartRigaMDO(r);
    return `${catHeader}<tr class="cm-sel-row" data-key="${esc(k)}" style="border-top:1px solid var(--border)">
      <td style="vertical-align:top;padding:6px 4px;font-family:var(--mono);font-size:11px;color:var(--accent-text);white-space:nowrap">${esc(r.codice)}</td>
      <td style="vertical-align:top;padding:6px 8px">
        <div style="font-size:12px;color:var(--text);line-height:1.35">${esc(r.desc_short||r.declaratoria||'')}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:3px">
          ${r.regione?`<span style="font-size:9.5px;color:var(--text3)">${esc(r.regione)}${r.anno&&r.anno!=='—'?' '+esc(r.anno):''}</span>`:''}
          ${mdoBadgeHtml(mdo)}
          ${categoriaChipHtml(k)}
        </div>
      </td>
      <td style="vertical-align:top;padding:6px 4px;text-align:right"><div data-cell="qty">${cartQtyBadgeHtml(k)}</div><div data-cell="mis">${misToggleBtn(k)}</div></td>
      <td style="vertical-align:top;padding:6px 4px;text-align:right;font-family:var(--mono);font-size:11.5px;color:var(--text2);white-space:nowrap">${r.prezzo>0?'€ '+fmt(r.prezzo):'—'}</td>
      <td data-cell="imp" style="vertical-align:top;padding:6px 4px;text-align:right;font-family:var(--mono);font-size:11.5px;white-space:nowrap">${cartImpCellHtml(r.prezzo||0,q)}</td>
      <td style="vertical-align:top;padding:6px 4px;text-align:center">
        <button onclick="removeFromCart('${k.replace(/'/g,"\\'")}')" title="Rimuovi dal computo"
                style="background:var(--danger-light);color:var(--danger);border:1px solid var(--danger);border-radius:6px;width:22px;height:22px;font-size:12px;line-height:1;cursor:pointer">✕</button>
      </td>
    </tr>${misPanelHtml(k)}`;
  }).join('');
  // Computo vuoto: l'overlay si apre lo stesso, come finestra pronta a
  // popolarsi aggiungendo voci dal prezzario.
  const vuoto=!map.size && !S.custom.size;
  const bodyHtml = vuoto
    ? `<div style="text-align:center;padding:48px 24px;color:var(--text3)">
        <div style="font-size:34px;margin-bottom:10px">▤</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Computo vuoto</div>
        <div style="font-size:11.5px;max-width:420px;margin:0 auto 16px">Aggiungi voci dal prezzario spuntandole o misurandole.</div>
      </div>`
    : CART_MODE==='categorizza' ? cartBodyCategorieHtml(map)
    : CART_VIEW==='elenco' ? cartBodyElencoHtml(map)
    : CART_VIEW==='capitoli' ? cartBodyCapitoliHtml(map)
    : `<table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.5px">
          <th style="padding:8px 4px">Codice</th><th style="padding:8px 8px">Descrizione</th>
          <th style="padding:8px 4px;text-align:right">Quantità</th><th style="padding:8px 4px;text-align:right">Prezzo</th><th style="padding:8px 4px;text-align:right">Importo</th><th style="padding:8px 4px"></th>
        </tr></thead>
        <tbody id="cart-ov-tbody">${rowsHtml}${customRowsHtml()}</tbody>
      </table>`;
  const ov=document.createElement('div');
  ov.id='cart-overlay';
  // Vista (non più modale a schermo intero): montata SOTTO il binario persistente
  // (--chrome-h), fondo opaco, riempie lo spazio. Il binario resta sopra e cliccabile.
  ov.style.cssText='position:fixed;left:0;right:0;bottom:0;top:var(--chrome-h,48px);background:var(--bg);z-index:60;display:flex;flex-direction:column';
  ov.innerHTML=`
    <div style="background:var(--surface);width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:20px">▤</span>
        <div style="min-width:120px">
          <div style="font-weight:700;font-size:15px">${CART_MODE==='categorizza'?'Categorizza':'Computo Metrico'}</div>
          <div style="font-size:11px;color:var(--text3)">${CART_MODE==='categorizza'
            ? `<span id="cart-ov-count">${map.size+S.custom.size}</span> voci · trascina una categoria su una voce, o selezionane più d'una col lazo e assegnala in blocco`
            : `<span id="cart-ov-count">${map.size+S.custom.size}</span> voci da tutti i prezzari caricati e composte · pronte per l'export`}</div>
        </div>
        <input id="cart-search" class="cart-search" placeholder="⌕ cerca nel computo…" value="${esc(CART_QUERY)}"
          oninput="cartFilterRows(this.value)" onkeydown="event.stopPropagation()"
          title="Filtra le voci del computo per codice, descrizione o categoria">
        ${cartViewSwitchHtml()}
        <button onclick="setStep('cerca')" title="Torna alla ricerca (Esc)" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
      </div>
      <div id="cart-ov-selbar" class="cm-selbar">
        <span><b id="cart-ov-seln">0</b> voci selezionate</span>
        <span class="cm-selbar-sp"></span>
        <button class="fam-assign" onclick="cartOpenCatPopoverForSel(event)">🏷 Assegna categoria</button>
        <button onclick="showCopyPopup()" title="Copia rapida TSV delle sole voci selezionate — senza analisi prezzi">📋 Copia</button>
        <button onclick="cartDuplicateKeys([...CART_SEL])">⧉ Duplica</button>
        <button class="danger" onclick="cartRemoveKeys([...CART_SEL])">✕ Rimuovi</button>
        <button class="ghost" onclick="cartSelClear()">Deseleziona</button>
      </div>
      <div style="flex:1;overflow:auto;padding:4px 20px" id="cart-ov-body"
        ondragover="if(event.dataTransfer.types.includes('text/ep-key')){event.preventDefault();this.classList.add('ep-drop-over')}"
        ondragleave="this.classList.remove('ep-drop-over')"
        ondrop="epDropSuComputo(event)">
        ${bodyHtml}
      </div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <button class="ehb-btn-fam-danger-outline" onclick="clearCart();setStep('cerca')" style="padding:8px 14px;font-size:12px">Svuota computo</button>
        <div style="flex:1;text-align:right">
          <div id="cart-ov-warn" style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Totale computo${cartWarn(T)}</div>
          <div id="cart-ov-total" style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--accent-text)">€ ${fmt(T.tot)}</div>
          <div id="cart-ov-mdo" style="font-size:10px;color:var(--text3)">${cartMdoLineHtml(T)}</div>
        </div>
        <button onclick="setStep('cerca')" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 16px;font-size:12px;cursor:pointer;color:var(--text2)">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  wireCartSelection(ov);
  cartUpdateSelUI();
  if(CART_QUERY) cartFilterRows(CART_QUERY); // riapplica il filtro ricerca dopo un rebuild
  _syncRail(CART_MODE==='categorizza' ? 'categorizza' : 'misura'); // il binario segue la MODALITÀ del carrello (non la vista Tabella/Elenco)
  mountEpFloat(map);
}
export function removeFromCart(key){
  // snapshot per l'Annulla (toast) — qty/categoria si perdono col delete sotto
  const _undoQty=S.qty[key], _undoCat=S.categoria[key];
  S.sel.delete(key);
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  MIS_OPEN.delete(key); CART_SEL.delete(key);
  window.ehbFeedback?.undoToast('Voce rimossa dal computo', ()=>{
    S.sel.add(key);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    refreshCartOverlayIfOpen(); updateCartInfo(); render();
  });
  // aggiorna la riga nell'overlay senza ricostruirlo tutto
  const tbody=document.getElementById('cart-ov-tbody');
  if(tbody){
    const btn=tbody.querySelector(`button[onclick*="${key.replace(/'/g,"\\'")}"]`);
    const tr=btn?btn.closest('tr'):null;
    // il pannello misurazioni (se aperto) è il <tr> gemello subito dopo: va rimosso insieme
    const misTr=tr&&tr.nextElementSibling&&tr.nextElementSibling.classList.contains('mis-panel-row')?tr.nextElementSibling:null;
    if(misTr) misTr.remove();
    if(tr) tr.remove();
    cartPatchTotals();
    if(!S.sel.size && !S.custom.size) refreshCartOverlayIfOpen(); // → empty state, non si chiude
    cartUpdateSelUI();
  } else {
    // viste Categorie/Elenco: niente #cart-ov-tbody da patchare al volo, si
    // ricostruisce tutto (stesso costo di un qualunque altro cambio di stato).
    refreshCartOverlayIfOpen();
  }
  updateCartInfo();
  render();
}
export function closeCart(){
  document.querySelectorAll('#cart-overlay').forEach(el=>el.remove()); // vedi nota in openCart()
  document.querySelectorAll('#ep-float-wrap').forEach(el=>el.remove());
  CART_SEL.clear(); closeCatPopover(); closeCartCtxMenu();
}

// ══════════════════════════════════════════════════════════════
// EXPORT METEL — fixed-width 234 chars
// ══════════════════════════════════════════════════════════════
// BUG FIX (due difetti distinti):
// 1) Con carrello di sole voci COMPOSTE (S.custom) e nessuna riga da prezzario
//    selezionata (S.sel vuoto), il controllo guardava solo S.sel: le voci composte
//    non finivano MAI nell'export (TSV/Excel/METEL/report), a prescindere.
// 2) Con carrello COMPLETAMENTE vuoto (S.sel e S.custom entrambi vuoti), la funzione
//    ripiegava su S.filtered — «ciò che è filtrato a video» — che senza una ricerca
//    attiva COINCIDE col prezzario intero (migliaia di voci): un click su «Esporta»
//    a carrello vuoto esportava tutto il prezzario invece di avvisare che è vuoto.
// Ora: SOLO il carrello (S.sel + S.custom); vuoto ⇒ array vuoto, i chiamanti già
// mostrano «Nessuna voce da esportare» quando rows.length===0. Le voci di S.custom
// portano con sé la quantità già risolta (`_qty`) perché la loro chiave in S.qty è
// quella originale di S.custom, non il rowKey sintetico. Solo quelle SENZA codice
// (compositore/Analisi Prezzi) ricevono una TARIFFA PROGRESSIVA («NP.001», «Nuovo
// Prezzo» — convenzione dei computi metrici italiani per le voci fuori prezzario);
// le voci di prezzario reale o con un codice originale mantengono il LORO codice.
// soloSelezionate=true e c'è una selezione attiva in CART_SEL (lazo/clic nel
// carrello) ⇒ solo le voci selezionate, stessa chiave (rowKey/S.custom) usata
// dal resto del carrello. Nessuna selezione o parametro assente ⇒ tutto il
// carrello, comportamento invariato per gli export che non conoscono CART_SEL.
export function collectExportRows(soloSelezionate){
  const sel=(soloSelezionate && CART_SEL.size) ? CART_SEL : null;
  const rows=[];
  for(const [k,r] of cartRows()){
    if(sel && !sel.has(k)) continue;
    rows.push(r);
  }
  let i=0;
  for(const [k,it] of S.custom){
    i++;
    if(sel && !sel.has(k)) continue;
    rows.push({
      // le voci di prezzario reale (source:'prezzario') o con un codice originale portano
      // il LORO codice/tariffa e lo mantengono in export; solo compositore/Analisi
      // Prezzi (senza codice) restano NP.xxx progressivi.
      codice:it.codice||('NP.'+String(i).padStart(3,'0')),
      desc_short:it.desc_short, declaratoria:it.declaratoria,
      um:it.um, prezzo:it.prezzo, ru:null, regione:'—', anno:'—',
      _custom:true, _qty:S.qty[k],
      // La scomposizione viaggia con la voce: serve alla «Copia»
      // (formato XMLDCF_EP). Gli altri export la ignorano.
      analisiPrezzi:it.analisiPrezzi,
    });
  }
  return rows;
}

// Report PDF (computo/estratto): apre una finestra stampabile con le voci del
// carrello valorizzate prezzo×quantità (carrello vuoto ⇒ avviso, nessun report).
// Il modello + HTML sono nell'engine puro (engine/report.ts), esposto da main.ts
// su window.miuComputoReport perché questo script classico non importa moduli ES.
export function openComputoPDF(){
  const rows=collectExportRows();
  if(!rows.length){ toast('Nessuna voce da mettere nel report','warn'); return; }
  if(typeof window.miuComputoReport!=='function'){ toast('Modulo report non pronto, riprova tra un attimo','warn'); return; }
  const items=rows.map(r=>{ const q=r._qty||S.qty[rowKey(r)];
    return { codice:r.codice, desc_short:r.desc_short, declaratoria:r.declaratoria,
      um:(q&&q.um)||r.um, prezzo:r.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:r.regione, anno:r.anno }; });
  const html=window.miuComputoReport(items, { now: Date.now() });
  const w=window.open('', '_blank');
  if(!w){ toast('Finestra bloccata: consenti i popup per aprire il report','warn'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// Export EXCEL del computo metrico (formato generico, nessun template esterno):
// una riga per voce con codice/descrizione/categoria/U.M./quantità/prezzo/importo
// + il totale. Stesso pattern SheetJS di exportFascicoloAP (dettaglio.js).
export function exportComputoExcel(){
  const rows=collectExportRows();
  if(!rows.length){ toast('Nessuna voce da esportare','warn'); return; }
  if(!window.computoMetricoAOA || typeof XLSX==='undefined'){ toast('Modulo Excel non pronto, riprova tra un attimo','warn'); return; }
  const righe=rows.map(r=>{
    const q=r._qty||S.qty[rowKey(r)];
    return {
      codice:r.codice||'',
      descrizione:(r.desc_short||r.declaratoria||'').replace(/\s+/g,' ').trim(),
      categoria:S.categoria[rowKey(r)]||'',
      um:(q&&q.um)||r.um||'',
      quantita:(q&&q.qty)||0,
      prezzoUnitario:r.prezzo||0,
    };
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, apBuildSheet(window.computoMetricoAOA(righe), [5,6], [4]), 'Computo Metrico');
  XLSX.writeFile(wb, window.computoMetricoFileName());
  toast(`${righe.length.toLocaleString('it')} voci esportate in Excel`,'ok');
}

