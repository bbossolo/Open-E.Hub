/* μ (Prezzi) legacy — resa dei risultati di ricerca nelle tre viste (tabella, albero, elenco),
   paginazione e transizioni fra viste.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { misCell } from './misure.js'
import { S } from './stato.js'
import { updateCartInfo } from './computo-overlay.js'
import { isInElencoPrezzi } from './elenco-prezzi.js'
import { applyViewControls, esc, fmt, hideState } from './index.js'
import { doFilter, matBadge, regBadge } from './ricerca.js'
import { _selRestoreFocus, _treeRestoreFocus, _wireSelDoc, attachRowEvents, setTreeFocusNav } from './selezione.js'

// ══════════════════════════════════════════════════════════════
// SORT
// ══════════════════════════════════════════════════════════════
document.querySelectorAll('th.sortable').forEach(th=>{
  th.addEventListener('click',()=>{
    const col=th.dataset.col;
    if(S.sortCol===col) S.sortDir*=-1;
    else{S.sortCol=col;S.sortDir=1;}
    document.querySelectorAll('th.sortable').forEach(t=>{t.classList.remove('sort-asc','sort-desc');});
    th.classList.add(S.sortDir===1?'sort-asc':'sort-desc');
    doFilter();
  });
});

// ══════════════════════════════════════════════════════════════
// RENDER TABLE
// ══════════════════════════════════════════════════════════════
// ── MOVIMENTO del pannello voci (rispetta «riduci movimento» = data-motion) ──
export let _prevView=null;
export function _noMotion(){ return document.documentElement.getAttribute('data-motion')==='reduced' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
// cattura la posizione verticale di ogni riga PRIMA del re-render (per il FLIP)
export function captureRowTops(box){ const m=new Map(); if(box&&!_noMotion()) box.querySelectorAll('[data-key]').forEach(el=>m.set(el.dataset.key, el.getBoundingClientRect().top)); return m; }
// FLIP per le righe che PERMANGONO (scivolano nella nuova posizione quando il ranking
// riordina) + cascata (fade+slide sfalsato) per le righe NUOVE.
export function flipCascade(box, prevTops){
  if(!box||_noMotion()||!box.animate&&!box.querySelectorAll) return;
  let neu=0;
  box.querySelectorAll('[data-key]').forEach(el=>{
    if(!el.animate) return;
    const old=prevTops&&prevTops.get(el.dataset.key);
    if(old!=null){ const dy=old-el.getBoundingClientRect().top; if(Math.abs(dy)>1) el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'}); }
    else el.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'none'}],{duration:230,delay:Math.min(neu++,12)*15,easing:'ease-out',fill:'backwards'});
  });
}
// crossfade morbido al CAMBIO vista (Tabella↔Capitoli↔Elenco)
export function crossfadeBox(box){ if(box&&box.animate&&!_noMotion()) box.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:230,easing:'ease-out'}); }

export function render(){
  const total=S.filtered.length;
  const pages=Math.max(1,Math.ceil(total/S.pp));
  S.page=Math.min(S.page,pages);
  const start=(S.page-1)*S.pp;
  const pageRows=S.filtered.slice(start,start+S.pp);

  document.getElementById('results-count').innerHTML=`<strong>${total.toLocaleString('it')}</strong> voci`;
  updateCartInfo();
  applyViewControls();

  // Movimento: distingue re-render stessa-vista (FLIP+cascata righe) da cambio-vista (crossfade).
  const viewChanged = _prevView!==null && _prevView!==S.view;
  const activeBox = S.view==='table'?document.getElementById('tbody')
                  : S.view==='list'?document.getElementById('listview')
                  : document.getElementById('treeview');
  const prevTops = viewChanged ? null : captureRowTops(activeBox);

  // mostra il contenitore della vista attiva, nasconde gli altri
  document.getElementById('dtable').style.display   = S.view==='table' ? '' : 'none';
  document.getElementById('treeview').style.display = S.view==='tree'  ? '' : 'none';
  document.getElementById('listview').style.display = S.view==='list'  ? '' : 'none';

  if(S.view==='tree'){ renderTree(); }       // albero: usa TUTTO il filtrato (no paginazione)
  else if(S.view==='list') renderList(pageRows);
  else renderTableRows(pageRows);

  // Tabella/Elenco (paginate ≤ S.pp righe): FLIP+cascata. Albero: solo crossfade al cambio vista.
  if(viewChanged) crossfadeBox(S.view==='table'?document.getElementById('dtable'):activeBox);
  else if(S.view!=='tree') flipCascade(activeBox, prevTops);
  _prevView=S.view;

  // la paginazione non si applica all'albero (raggruppa l'intero filtrato)
  renderPag(S.view==='tree'?0:total, S.view==='tree'?1:pages);
  const ca=document.getElementById('chk-all'); if(ca){ ca.checked=false; ca.indeterminate=false; }
  document.getElementById('search-hero').style.display='flex';
  document.getElementById('filter-bar').style.display='block';
  document.getElementById('results-bar').style.display='flex';
  hideState();
  document.getElementById('table-area').classList.add('show');
  _wireSelDoc();                                        // selezione: listener globali (1 volta)
  if(S.view==='tree') _treeRestoreFocus(false); else _selRestoreFocus();  // ripristina il cursore
}

// Descrizione VISIBILE auto-esplicativa: se la breve è un frammento (inizia minuscolo
// o con una misura, es. "di kg. 2.500…") antepone il contesto del padre (Settore o la
// testa della declaratoria prima di " — "), così la voce si capisce senza aprire il dettaglio.
// Solo display: non modifica i dati né l'export.
export function displayShort(r){
  const s=String(r.desc_short||'').trim();
  if(!s) return String(r.declaratoria||'').replace(/[\r\n]+/g,' ').trim();
  const isFragment=/^[-–—a-zàèéìòùÀ-ÿ0-9Ø(]/.test(s) && !/^[A-ZÀÈÉÌÒÙ]/.test(s);
  if(!isFragment) return s;
  let parent=String(r.settore||'').trim();
  if(!parent && r.declaratoria){
    const d=String(r.declaratoria).replace(/[\r\n]+/g,' ').trim();
    const i=d.indexOf(' — ');
    if(i>0 && i<90) parent=d.slice(0,i).trim();
  }
  if(!parent || parent.length>80 || s.toLowerCase().includes(parent.toLowerCase())) return s;
  const sep=/[:\-–—]$/.test(parent)?' ':' · ';
  return parent+sep+s;
}

export function renderTableRows(pageRows){
  const tb=document.getElementById('tbody'); tb.innerHTML='';
  pageRows.forEach(r=>{
    const key=rowKey(r), isSel=S.searchSel.has(key);
    const tr=document.createElement('tr');
    if(isSel) tr.classList.add('sel');
    tr.innerHTML=`
      <td class="tc"><input type="checkbox" ${isSel?'checked':''} onchange="toggleRow('${esc(key)}',this)"></td>
      <td class="tco">${esc(r.codice)}${isInElencoPrezzi(r)?' <span class="in-computo" title="Già nel computo (Elenco Prezzi)">✓</span>':''}</td>
      <td class="tr">${regBadge(r.regione)}</td>
      <td class="ty">${esc(r.anno)}</td>
      <td class="tmdo">${r.ru?'MDO '+Math.round(Number(r.ru))+'%':'—'}</td>
      <td class="td">
        <div class="desc-short">${esc(displayShort(r))} ${matBadge(r)}</div>
        ${r.declaratoria&&r.declaratoria!==r.desc_short?`<div class="desc-prev">${esc(r.declaratoria)}</div><button class="exp-btn" onclick="expand(this)">▼ mostra tutto</button><div class="desc-long">${esc(r.declaratoria)}</div>`:''}
        ${r.settore?`<div class="sub-info">${esc(r.settore)}</div>`:''}
      </td>
      <td class="tum">${esc(r.um)}</td>
      <td class="tmis">${misCell(r,key)}</td>
      <td class="tprice">${fmt(r.prezzo)}</td>
      <td class="tnet">${r.importo_netto?fmt(r.importo_netto):'—'}</td>`;
    attachRowEvents(tr,r,key);
    tb.appendChild(tr);
  });
}

// Vista Capitoli (vista ad albero): raggruppa l'intero filtrato per
// disciplina › sistema › settore, espandibile lazy. Le voci foglia mostrano
// codice · descrizione · UM · prezzo · incidenza manodopera.
export function buildTree(rows){
  const root={children:new Map(), rows:[], count:0};
  for(const r of rows){
    const path=[r.disciplina,r.sistema,r.settore].map(x=>String(x||'').trim()).filter(Boolean);
    if(!path.length) path.push('(Senza capitolo)');
    let node=root; node.count++;
    for(const seg of path){
      if(!node.children.has(seg)) node.children.set(seg,{children:new Map(), rows:[], count:0});
      node=node.children.get(seg); node.count++;
    }
    node.rows.push(r);
  }
  return root;
}
export function treeVoce(r, depth, parentKey){
  const key=rowKey(r), isSel=S.searchSel.has(key);
  const el=document.createElement('div');
  el.className='tvoce'+(isSel?' sel':'');
  el.dataset.nav='v:'+key; el.dataset.parent=parentKey||'';   // navigazione tastiera albero
  el.style.paddingLeft=(10+(depth+1)*16)+'px';
  el.innerHTML=`
    <input type="checkbox" ${isSel?'checked':''} onchange="toggleRow('${esc(key)}',this)">
    <span class="tv-code">${esc(r.codice)}</span>
    <span class="tv-desc">${esc(displayShort(r))} ${matBadge(r)}</span>
    <span class="tv-um">${esc(r.um||'')}</span>
    <span class="tv-mis">${misCell(r,key)}</span>
    <span class="tv-price">${fmt(r.prezzo)} €</span>
    <span class="tv-mdo">${r.ru?('MDO '+Math.round(Number(r.ru))+'%'):''}</span>`;
  attachRowEvents(el,r,key);
  return el;
}
export function walkTree(node,prefix,depth,out){
  const labels=[...node.children.keys()].sort((a,b)=>a.localeCompare(b,'it'));
  for(const label of labels){
    const child=node.children.get(label);
    const key=prefix+'›'+label;
    const open=S.treeOpen.has(key);
    const hdr=document.createElement('div');
    hdr.className='tnode'+(open?' open':''); hdr.style.paddingLeft=(10+depth*16)+'px';
    hdr.dataset.nav='h:'+key; hdr.dataset.node=key; hdr.dataset.parent=prefix; hdr.dataset.open=open?'1':'0'; // navigazione tastiera
    hdr.innerHTML=`<span class="tchev">${open?'▾':'▸'}</span><span class="tlabel">${esc(label)}</span><span class="tcount">${child.count.toLocaleString('it')}</span>`;
    hdr.addEventListener('click',()=>{ if(open)S.treeOpen.delete(key); else S.treeOpen.add(key); setTreeFocusNav('h:'+key); renderTree(); _treeRestoreFocus(false); });
    out.appendChild(hdr);
    if(open) walkTree(child,key,depth+1,out);
  }
  if(node.rows.length) for(const r of node.rows) out.appendChild(treeVoce(r,depth,prefix));
}
export function renderTree(){
  const cont=document.getElementById('treeview'); cont.innerHTML='';
  if(!S.treeOpen) S.treeOpen=new Set();
  const root=buildTree(S.filtered);
  const frag=document.createDocumentFragment();
  walkTree(root,'',0,frag);
  cont.appendChild(frag);
}

// Vista Elenco essenziale (una riga densa per voce)
export function renderList(pageRows){
  const l=document.getElementById('listview'); l.innerHTML='';
  pageRows.forEach(r=>{
    const key=rowKey(r), isSel=S.searchSel.has(key);
    const it=document.createElement('div'); it.className='litem'+(isSel?' sel':'');
    it.innerHTML=`
      <input type="checkbox" ${isSel?'checked':''} onchange="toggleRow('${esc(key)}',this)">
      <span class="li-code">${esc(r.codice)}</span>
      <span class="li-desc">${esc(displayShort(r))} ${matBadge(r)}</span>
      <span class="li-um">${esc(r.um||'')}</span>
      <span class="li-mis">${misCell(r,key)}</span>
      <span class="li-price">${fmt(r.prezzo)} €</span>`;
    attachRowEvents(it,r,key);
    l.appendChild(it);
  });
}

export function expand(btn){
  const tr=btn.closest('tr');
  tr.classList.toggle('expanded');
  btn.textContent=tr.classList.contains('expanded')?'▲ comprimi':'▼ mostra tutto';
}

export function renderPag(total,pages){
  const pg=document.getElementById('pagination');
  if(pages<=1){pg.innerHTML='';return;}
  const cur=S.page;
  let h=`<button class="pg-btn" onclick="gp(${cur-1})" ${cur===1?'disabled':''}>◀</button>`;
  const ps=[];
  ps.push(1);
  if(cur>3) ps.push('…');
  for(let p=Math.max(2,cur-1);p<=Math.min(pages-1,cur+1);p++) ps.push(p);
  if(cur<pages-2) ps.push('…');
  if(pages>1) ps.push(pages);
  ps.forEach(p=>{
    if(p==='…') h+=`<span class="pg-sep">…</span>`;
    else h+=`<button class="pg-btn ${p===cur?'act':''}" onclick="gp(${p})">${p}</button>`;
  });
  h+=`<button class="pg-btn" onclick="gp(${cur+1})" ${cur===pages?'disabled':''}>▶</button>`;
  h+=`<span class="pg-info">Pag. ${cur} di ${pages} · ${total.toLocaleString('it')} voci</span>`;
  pg.innerHTML=h;
}
export function gp(p){const pages=Math.ceil(S.filtered.length/S.pp);S.page=Math.max(1,Math.min(p,pages));render();}

// ══════════════════════════════════════════════════════════════
// SELECTION
// ══════════════════════════════════════════════════════════════
export function rowKey(r){return r.codice+'|'+r.regione+'|'+r.anno;}
export function toggleRow(key,cb){
  if(cb.checked) S.searchSel.add(key); else S.searchSel.delete(key);
  const row=cb.closest('tr,.tvoce,.litem'); if(row) row.classList.toggle('sel',cb.checked);
  updateCartInfo();
}
// ── MISURAZIONI: quantità per voce ──────────────────────
// S.qty[key] = { qty, um, source:'ampere'|'gamma'|'pi'|'phi'|'manual' }: da quale
// distinta/import viene la quantità ('phi' = composta a mano da una distinta via
// "Componi", nome storico del meccanismo condiviso); 'manual' = inserita/modificata
// a mano nella colonna "Misura".
export function parseNum(s){
  s=String(s==null?'':s).trim().replace(/\s/g,'');
  if(!s) return NaN;
  if(s.includes(',')&&s.includes('.')) s=s.replace(/\./g,'').replace(',','.'); // 1.234,5
  else s=s.replace(',','.');
  const n=parseFloat(s); return isFinite(n)?n:NaN;
}
export function checkPage(cb){
  const start=(S.page-1)*S.pp;
  S.filtered.slice(start,start+S.pp).forEach(r=>{
    const k=rowKey(r);
    if(cb.checked) S.searchSel.add(k); else S.searchSel.delete(k);
  });
  render();
}
