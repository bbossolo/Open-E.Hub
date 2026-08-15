/* μ (Prezzi) legacy — Elenco Prezzi: pannello flottante (posizione e stato persistiti) e
   trascinamento delle voci verso il computo.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { cartAllEntries, cartDuplicateKeys } from './computo.js'
import { misToggle } from './misure.js'
import { CAT_SEP, S } from './stato.js'
import { MIS_OPEN, refreshCartOverlayIfOpen, updateCartInfo } from './computo-overlay.js'
import { esc, fmt, toast } from './index.js'
import { openQuickEdit } from './quick-edit.js'
import { render, rowKey } from './render.js'
// Raccoglie le righe nel carrello da TUTTI i prezzari caricati (anche non a video)
// ── ELENCO PREZZI del progetto ────────────────────────────────────────────────
// Aggiungere una voce di prezzario al computo NON la lega più alla ricerca: ne
// salva una COPIA indipendente in S.custom (l'Elenco Prezzi), modificabile a
// posteriori (descrizione/prezzo/U.M.) senza toccare il prezzario. Svuotare o
// cambiare la ricerca non tocca l'Elenco Prezzi. Chiave stabile 'ep:'+rowKey per
// dedup (una voce di prezzario entra una volta sola; per averla in più
// Sottocategorie si usa «Duplica»).
// `scope` = discriminante opzionale (es. il QUADRO di provenienza di una linea Ampère):
// la stessa voce di prezzario usata in due quadri resta DUE voci nell'Elenco Prezzi,
// ognuna con la sua quantità e la sua Sottocategoria. Senza scope, dedup come sempre.
export function elencoKeyOf(row, scope){ return 'ep:'+rowKey(row)+(scope?'#'+scope:''); }
export function isInElencoPrezzi(row){
  if(!row) return false;
  const base='ep:'+rowKey(row);
  if(S.custom.has(base)) return true;
  for(const k of S.custom.keys()) if(k===base || k.startsWith(base+'#')) return true; // anche le copie per-quadro
  return false;
}
export function commitRowToElencoPrezzi(row, qty, scope){
  const k=elencoKeyOf(row, scope);
  if(!S.custom.has(k)){
    S.custom.set(k, { desc_short:row.desc_short, declaratoria:row.declaratoria||row.desc_short,
      um:row.um, prezzo:(row.prezzo>0?row.prezzo:null), codice:row.codice,
      regione:row.regione, anno:row.anno, famigliaId:null, famNome:'',
      source:'prezzario', _ref:rowKey(row), _scope:scope||undefined });
  }
  if(qty!=null && qty>0) S.qty[k]={ qty, um:row.um||'', source:'manual' };
  return k;
}
   // dentro MISURA: come si guardano le voci
    // quale PANNELLO: misura (voci+prezzi) o categorizza (voci+database)
// Elenco unificato delle voci del computo (reali + composte), normalizzato per
// le viste Categorie/Elenco che non distinguono la provenienza.
// Pannello ELENCO PREZZI: il catalogo delle voci del progetto (composte o copiate
// dai prezzari), persistente e indipendente dalla ricerca. Ogni voce composta/copiata
// è modificabile (✎) e rimovibile (✕). Le voci legacy/import (S.sel) sono mostrate
// ma non ancora modificabili (verranno convertite in copie nel 2° giro).
/* DALL'ELENCO PREZZI AL COMPUTO — si trascina.
   L'Elenco Prezzi è il CATALOGO del progetto (ogni voce una volta sola); il Computo Metrico
   è dove quelle voci si usano, e la stessa voce ci compare quante volte serve: le prese in
   cucina e quelle in garage sono la stessa voce di listino ma DUE VOCI DI COMPUTO, perché
   vanno in sottocategorie diverse e si misurano a parte.
   Trascinare crea quindi una VOCE NUOVA — non un'altra misurazione di quella di prima — e
   non le si eredita la categoria: la nuova va categorizzata dove serve a lei.
   Se però la lasci cadere DENTRO un gruppo, la categoria di quel gruppo se la prende: è il
   modo più corto per dire «questa va qui». */
export function epDragStart(ev,key){
  try{ ev.dataTransfer.setData('text/ep-key', key); ev.dataTransfer.effectAllowed='copy'; }catch(e){}
  document.getElementById('cart-ov-body')?.classList.add('ep-drop-armed');
}
export function epDragEnd(){
  const b=document.getElementById('cart-ov-body');
  b?.classList.remove('ep-drop-armed'); b?.classList.remove('ep-drop-over');
}
export function epDropSuComputo(ev){
  ev.preventDefault();
  epDragEnd();
  let key=''; try{ key=ev.dataTransfer.getData('text/ep-key')||''; }catch(e){}
  if(!key) return;
  // DOVE l'hai lasciata: se è dentro il gruppo di una categoria, la nuova voce la eredita
  const sotto=ev.target.closest && ev.target.closest('.cm-sel-row');
  const catDelGruppo=(sotto && S.categoria[sotto.dataset.key]) || '';
  // sempre una VOCE NUOVA: senza misure (sono sue) e senza categoria (la sceglie l'utente)
  const target=cartDuplicateKeys([key], { senzaMisure:true, senzaCategoria:true, muto:true })[0];
  if(!target) return;
  if(catDelGruppo) S.categoria[target]=catDelGruppo;
  refreshCartOverlayIfOpen();
  if(!MIS_OPEN.has(target)) misToggle(target); // misure aperte e pronte da scrivere
  const row=document.querySelector(`#cart-ov-body .cm-sel-row[data-key="${CSS.escape(target)}"]`);
  row?.scrollIntoView({ block:'center', behavior:'smooth' });
  toast(catDelGruppo
    ? `Nuova voce di computo in «${catDelGruppo.split(CAT_SEP).pop()}»`
    : 'Nuova voce di computo — assegnale la categoria', 'ok');
}
export function elencoPrezziPanelHtml(map, opts){
  const entries=cartAllEntries(map);
  const rows=entries.length ? entries.map(e=>{
    const ek=e.key.replace(/'/g,"\\'");
    const custom=S.custom.get(e.key);
    const um=custom?(custom.um||''):((map.get(e.key)||{}).um||'');
    return `<div class="ep-row" data-key="${esc(e.key)}" draggable="true"
      ondragstart="epDragStart(event,'${ek}')" ondragend="epDragEnd()"
      title="Trascinala nel computo qui sopra: crea una NUOVA voce di computo (la stessa voce di listino può comparire più volte, in sottocategorie diverse). Lasciandola dentro un gruppo, ne prende la categoria.">
      <span class="ep-code">${e.codice?esc(e.codice):'✎'}</span>
      <span class="ep-desc" title="${esc(e.desc)}">${esc(e.desc.slice(0,180))}</span>
      <span class="ep-um">${esc(um)}</span>
      <span class="ep-price">${e.prezzo>0?'€ '+fmt(e.prezzo):'—'}</span>
      <span class="ep-actions">
        ${custom?`<button class="ep-edit" title="Modifica rapida: descrizione, prezzo, U.M." onclick="openQuickEdit('${ek}')">✎ modifica</button>`
                :`<span class="ep-locked" title="Voce di prezzario importata/legacy — riaggiungila dalla ricerca per renderla modificabile">da prezzario</span>`}
        <button class="ep-del" title="Togli dall'Elenco Prezzi" onclick="elencoRemove('${ek}')">✕</button>
      </span>
    </div>`;
  }).join('') : '<div class="ep-empty">Nessuna voce. Cerca nei prezzari e premi «＋ Aggiungi al computo», o componi una voce.</div>';
  const rowsHtml=`<div class="ep-rows">${rows}</div>`;
  // opts.compact: solo le righe, senza l'intestazione propria — usato dentro il
  // guscio del pannello FLOTTANTE (mountEpFloat), che ha già il suo header col titolo.
  if(opts && opts.compact) return rowsHtml;
  return `<div class="ep-panel">
    <div class="ep-hd">▤ Elenco Prezzi <span class="ep-sub">— catalogo del progetto · ${entries.length} vo${entries.length===1?'ce':'ci'} · modificabili, indipendenti dalla ricerca</span></div>
    ${rowsHtml}
  </div>`;
}
export function elencoRemove(key){
  const wasCustom=S.custom.has(key), _undoItem=wasCustom?S.custom.get(key):undefined;
  const _undoQty=S.qty[key], _undoCat=S.categoria[key];
  if(wasCustom) S.custom.delete(key);
  else S.sel.delete(key); // riferimento legacy/import
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
  window.ehbFeedback?.undoToast('Voce tolta dall\'Elenco Prezzi', ()=>{
    if(wasCustom) S.custom.set(key,_undoItem); else S.sel.add(key);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    updateCartInfo(); refreshCartOverlayIfOpen(); render();
  });
}

// ── Elenco Prezzi FLOTTANTE — pannello persistente fuori da #cart-overlay
// (mockup docs/mockups/computo-metrico-elenco-flottante). A differenza del
// vecchio dock agganciato in fondo all'overlay (rimosso: era una 4ª fascia
// fissa sempre presente, solo in modalità Misura), questo pannello:
//  - sopravvive al cambio vista/modo del Computo (openCart() lo AGGIORNA,
//    non lo ricrea — vedi mountEpFloat, chiamato in coda a openCart());
//  - si trascina (epFloatDrag*) e si ridimensiona (resize CSS nativo,
//    persistito via ResizeObserver);
//  - si nasconde in una pillola cliccabile (epFloatClose/epFloatOpen).
// Stato (posizione/dimensione/aperto) in localStorage: stessa persistenza
// leggera di plView/plDensity, non in S (non è dato di progetto).
export const EP_FLOAT_KEY='miu:ep-float';
export function epFloatState(){
  const def={ x:null, y:null, w:400, h:300, closed:false };
  try{ return Object.assign(def, JSON.parse(localStorage.getItem(EP_FLOAT_KEY)||'{}')); }
  catch(e){ return def; }
}
export function epFloatSave(patch){
  const st=Object.assign(epFloatState(), patch);
  try{ localStorage.setItem(EP_FLOAT_KEY, JSON.stringify(st)); }catch(e){}
  return st;
}
export function epFloatHtml(map, st){
  const n=map.size+S.custom.size;
  if(st.closed){
    return `<div class="ep-pill" id="ep-pill" onclick="epFloatOpen()" title="Riapri l'Elenco Prezzi">
      <span class="ep-pill-ico">▤</span> Elenco Prezzi <span class="ep-pill-cnt">${n}</span>
    </div>`;
  }
  // clamp difensivo: la x/y salvata potrebbe non stare più nella finestra corrente
  // (finestra ridimensionata/più piccola da un'apertura all'altra) — senza questo il
  // pannello può rimontare fuori dall'area visibile, irraggiungibile col mouse.
  let px=st.x, py=st.y;
  if(px!=null&&py!=null){
    px=Math.max(4, Math.min(px, window.innerWidth-80));
    py=Math.max(4, Math.min(py, window.innerHeight-40));
  }
  const pos=(px!=null&&py!=null) ? `left:${px}px;top:${py}px;right:auto;` : '';
  return `<div class="ep-float" id="ep-float" style="${pos}width:${st.w}px;height:${st.h}px">
    <div class="ep-float-hd" id="ep-float-drag">
      <span class="ep-float-ico">▤</span><span class="ep-float-ttl">Elenco Prezzi</span>
      <span class="ep-float-cnt">${n}</span>
      <button class="ep-float-min" title="Nascondi (resta accessibile dalla pillola)" onclick="epFloatClose()">─</button>
    </div>
    <div class="ep-float-body" id="ep-float-body">${elencoPrezziPanelHtml(map,{compact:true})}</div>
  </div>`;
}
export function mountEpFloat(map){
  if(!document.getElementById('cart-overlay')) return; // solo mentre il Computo è aperto
  const existing=document.getElementById('ep-float-wrap');
  if(existing){ existing.innerHTML=epFloatHtml(map, epFloatState()); wireEpFloat(); return; }
  const wrap=document.createElement('div');
  wrap.id='ep-float-wrap';
  wrap.innerHTML=epFloatHtml(map, epFloatState());
  document.body.appendChild(wrap);
  wireEpFloat();
}
export function epFloatClose(){ epFloatSave({ closed:true }); refreshCartOverlayIfOpen(); }
export function epFloatOpen(){ epFloatSave({ closed:false }); refreshCartOverlayIfOpen(); }
// Stato di drag a livello di modulo (non per-chiamata): mountEpFloat() rimonta/aggiorna
// il pannello ad ogni refresh del Computo, quindi gli handler su `handle` (proprietà
// onmousedown, sovrascrivibile) si possono riassegnare ogni volta, ma i listener
// GLOBALI (mousemove/mouseup su document) vanno agganciati una sola volta — altrimenti
// si accumulano ad ogni refresh.
export let _epFloatDragging=false, _epFloatOx=0, _epFloatOy=0, _epFloatGlobalWired=false;
export function wireEpFloat(){
  const panel=document.getElementById('ep-float');
  if(!panel) return; // pillola: nessun drag/resize da agganciare
  const handle=document.getElementById('ep-float-drag');
  handle.onmousedown=(e)=>{
    if(e.target.closest('button')) return;
    _epFloatDragging=true; const r=panel.getBoundingClientRect();
    _epFloatOx=e.clientX-r.left; _epFloatOy=e.clientY-r.top;
    e.preventDefault();
  };
  if(!_epFloatGlobalWired){
    _epFloatGlobalWired=true;
    document.addEventListener('mousemove', (e)=>{
      if(!_epFloatDragging) return;
      const p=document.getElementById('ep-float'); if(!p) return;
      const x=Math.max(4, Math.min(e.clientX-_epFloatOx, window.innerWidth-80));
      const y=Math.max(4, Math.min(e.clientY-_epFloatOy, window.innerHeight-40));
      p.style.left=x+'px'; p.style.top=y+'px'; p.style.right='auto';
    });
    document.addEventListener('mouseup', ()=>{
      if(!_epFloatDragging) return; _epFloatDragging=false;
      const p=document.getElementById('ep-float'); if(!p) return;
      epFloatSave({ x:parseFloat(p.style.left)||null, y:parseFloat(p.style.top)||null });
    });
  }
  // resize:both nativo (CSS) — persiste la dimensione via ResizeObserver.
  // mountEpFloat rimonta il nodo (innerHTML) a ogni refresh del Computo — molto
  // spesso, non solo sui resize veri — quindi qui riparte sempre un observer NUOVO.
  // Il suo primo scatto riporta la dimensione ATTUALE del box appena osservato
  // (non un resize dell'utente): se non lo si scarta, ogni remount ri-salva la
  // dimensione corrente com'è nel momento del mount (che può essere più piccola
  // di quella salvata, per un clamp momentaneo di max-width/max-height o layout
  // non ancora assestato), rimpicciolendo il pannello da solo a ogni refresh —
  // era il bug per cui l'Elenco Prezzi «tornava sempre piccolo».
  if(window.ResizeObserver && !panel._epRo){
    let epRoFirstFire=true;
    panel._epRo=new ResizeObserver(()=>{
      if(epRoFirstFire){ epRoFirstFire=false; return; }
      epFloatSave({ w:Math.round(panel.offsetWidth), h:Math.round(panel.offsetHeight) });
    });
    panel._epRo.observe(panel);
  }
}
