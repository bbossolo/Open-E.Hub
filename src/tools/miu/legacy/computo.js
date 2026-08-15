// μ (Prezzi) legacy — modulo computo.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { CART_MODE, CART_SEL, CART_CAP_OPEN, CART_VIEW, S, setCartMode, setCartQuery, setCartView } from './stato.js'
import {
  MIS_OPEN, _syncRail, byCategoriaKey, catChipDrop, catChips3Html, catClearBtnHtml, catDbDatalistsHtml, catDbPanelHtml,
  categoriaChipHtml, categoriaColor, categoriaLabel, closeCartCtxMenu, commitRowToElencoPrezzi, esc, fmt, misToggle,
  nextCustomKey, openCatPopover, openLivelloPopover, refreshCartOverlayIfOpen, render, rowKey, toast, updateCartInfo
} from './index.js'

function cartAllEntries(map){
  const out=[];
  for(const [k,r] of map) out.push({ key:k, codice:r.codice, desc:(r.desc_short||r.declaratoria||''), prezzo:r.prezzo||0, qty:(S.qty[k]&&S.qty[k].qty>0)?S.qty[k].qty:null });
  for(const [k,it] of S.custom) out.push({ key:k, codice:it.codice||null, desc:(it.desc_short||it.declaratoria||''), prezzo:it.prezzo||0, qty:(S.qty[k]&&S.qty[k].qty>0)?S.qty[k].qty:null });
  return out;
}

function cartAnalisi(){
  return [...S.custom.values()].filter(v=>v && v.analisiPrezzi).map(v=>v.analisiPrezzi);
}

function cartBodyCategorieHtml(map){
  const entries=cartAllEntries(map).sort((a,b)=>byCategoriaKey([a.key],[b.key]));
  let lastCat;
  const rows=entries.map(e=>{
    const ek=e.key.replace(/'/g,"\\'");
    const cat=S.categoria[e.key]||'';
    const head=(cat&&cat!==lastCat)
      ?`<div class="cat2-head" style="--chip-color:${categoriaColor(cat)}"><span class="dot"></span>${esc(categoriaLabel(cat))}</div>`:'';
    lastCat=cat;
    const imp=(e.prezzo&&e.qty)?e.prezzo*e.qty:null;
    return `${head}<div class="cm-crow cm-sel-row" data-key="${esc(e.key)}"
      ondragover="event.preventDefault();this.classList.add('drop-target')"
      ondragleave="this.classList.remove('drop-target')"
      ondrop="this.classList.remove('drop-target');catChipDrop(event,'${ek}',-1)">
      <span class="cm-lcode">${e.codice?esc(e.codice):'✎'}</span>
      <div class="cm-cmain">
        <div class="cm-cdesc" title="${esc(e.desc)}">${esc(e.desc.slice(0,220))}</div>
        <div class="cm-catrow">${catChips3Html(e.key)}${catClearBtnHtml(e.key)}</div>
      </div>
      <span class="cm-lamt">${imp!=null?'€ '+fmt(imp):'—'}</span>
    </div>`;
  }).join('');
  return `<div class="cat2col">
    ${catDbPanelHtml()}
    <div class="cat2col-rows">${rows||'<div class="cat-tree-empty">Nessuna voce nel computo.</div>'}</div>
  </div>${catDbDatalistsHtml()}`;
}

function cartBodyElencoHtml(map){
  const entries=cartAllEntries(map);
  if(!entries.length) return '<div class="cat-tree-empty">Nessuna voce nel computo.</div>';
  const rows=entries.map(e=>{
    const imp=(e.prezzo&&e.qty)?e.prezzo*e.qty:null;
    return `<div class="cm-lrow cm-sel-row" data-key="${esc(e.key)}">
      <span class="cm-lcode">${e.codice?esc(e.codice):'✎'}</span>
      <span class="cm-ldesc" title="${esc(e.desc)}">${esc(e.desc.slice(0,220))}</span>
      ${categoriaChipHtml(e.key)}
      <span class="cm-lamt">${imp!=null?'€ '+fmt(imp):'—'}</span>
    </div>`;
  }).join('');
  return `<div class="cm-list">${rows}</div>`;
}

// Vista "Capitoli": raggruppa le voci del computo per disciplina › sistema ›
// settore del prezzario SORGENTE (automatico) — complementare alla vista
// "Categorie" sopra, che raggruppa per S.categoria (assegnazione MANUALE).
// Stesso principio di buildTree() del browser prezzario (index.js), ma non lo
// riusa: qui il nodo-foglia porta la CHIAVE del computo (anche per le voci
// composte S.custom, che non hanno disciplina/sistema/settore e cadono tutte
// sotto "(Senza capitolo)"), non un oggetto PriceRow con cui rowKey() non è
// pensato per lavorare.
function cartCapitoliGroups(map){
  const root={ children:new Map(), items:[], count:0, importo:0 };
  const push=(path,item)=>{
    let node=root; node.count++; node.importo+=item.imp;
    for(const seg of path){
      if(!node.children.has(seg)) node.children.set(seg,{ children:new Map(), items:[], count:0, importo:0 });
      node=node.children.get(seg); node.count++; node.importo+=item.imp;
    }
    node.items.push(item);
  };
  for(const [k,r] of map){
    const path=[r.disciplina,r.sistema,r.settore].map(x=>String(x||'').trim()).filter(Boolean);
    if(!path.length) path.push('(Senza capitolo)');
    const q=S.qty[k]; const qty=q&&q.qty>0?q.qty:null;
    const imp=(r.prezzo>0&&qty!=null)?r.prezzo*qty:0;
    push(path,{ key:k, codice:r.codice, desc:(r.desc_short||r.declaratoria||''), imp });
  }
  for(const [k,it] of S.custom){
    const q=S.qty[k]; const qty=q&&q.qty>0?q.qty:null;
    const imp=(it.prezzo>0&&qty!=null)?it.prezzo*qty:0;
    push(['(Senza capitolo)'],{ key:k, codice:it.codice||null, desc:(it.desc_short||it.declaratoria||''), imp });
  }
  return root;
}

function cartCapitoliVoceHtml(item,depth){
  return `<div class="cm-lrow cm-sel-row" data-key="${esc(item.key)}" style="padding-left:${10+(depth+1)*16}px">
    <span class="cm-lcode">${item.codice?esc(item.codice):'✎'}</span>
    <span class="cm-ldesc" title="${esc(item.desc)}">${esc(item.desc.slice(0,220))}</span>
    <span class="cm-lamt">${item.imp?'€ '+fmt(item.imp):'—'}</span>
  </div>`;
}

function cartCapitoliNodeHtml(node,prefix,depth){
  const labels=[...node.children.keys()].sort((a,b)=>a.localeCompare(b,'it'));
  let html='';
  for(const label of labels){
    const child=node.children.get(label);
    const key=prefix+'›'+label;
    const open=CART_CAP_OPEN.has(key);
    const ek=key.replace(/'/g,"\\'");
    html+=`<div class="tnode${open?' open':''}" style="padding-left:${10+depth*16}px" onclick="cartTreeToggle('${ek}')">
      <span class="tchev">${open?'▾':'▸'}</span><span class="tlabel">${esc(label)}</span>
      <span class="tcount">${child.count.toLocaleString('it')}</span>
      <span class="tamt">${child.importo?'€ '+fmt(child.importo):''}</span>
    </div>`;
    if(open) html+=cartCapitoliNodeHtml(child,key,depth+1);
  }
  if(node.items.length) for(const item of node.items) html+=cartCapitoliVoceHtml(item,depth);
  return html;
}

function cartBodyCapitoliHtml(map){
  const root=cartCapitoliGroups(map);
  if(!root.count) return '<div class="cat-tree-empty">Nessuna voce nel computo.</div>';
  return `<div class="cart-capitoli">${cartCapitoliNodeHtml(root,'',0)}</div>`;
}

function cartTreeToggle(key){
  if(CART_CAP_OPEN.has(key)) CART_CAP_OPEN.delete(key); else CART_CAP_OPEN.add(key);
  refreshCartOverlayIfOpen();
}

function cartCtxAssign(){
  const menu=document.getElementById('cart-ctx-menu');
  const rect=menu?menu.getBoundingClientRect():{ bottom:60, left:60 };
  closeCartCtxMenu();
  openCatPopover(rect,[...CART_SEL]);
}

function cartCtxAssignLivello(livello){
  const menu=document.getElementById('cart-ctx-menu');
  const rect=menu?menu.getBoundingClientRect():{ bottom:60, left:60 };
  closeCartCtxMenu();
  openLivelloPopover(rect,[...CART_SEL],livello);
}

function cartCtxMisure(){
  closeCartCtxMenu();
  if(CART_SEL.size!==1){ toast('Apri le misure di una voce alla volta','warn'); return; }
  const key=[...CART_SEL][0];
  if(!MIS_OPEN.has(key)) misToggle(key); // stesso percorso a un clic: prima riga pronta e a fuoco
}

function cartDuplicateKeys(keys, opts){
  const rows=cartRows(); // key→row delle voci reali (da prezzario)
  const nuove=[];
  keys.forEach(k=>{
    const nk=nextCustomKey();
    const it=S.custom.get(k);
    if(it){
      S.custom.set(nk, JSON.parse(JSON.stringify(it)));
    } else {
      const r=rows.get(k); if(!r) return;
      S.custom.set(nk, { codice:r.codice, desc_short:r.desc_short, declaratoria:r.declaratoria||r.desc_short,
        um:r.um, prezzo:(r.prezzo>0?r.prezzo:null), famigliaId:null, famNome:'', source:'duplicato' });
    }
    // le MISURE non si copiano quando la voce nasce da un trascinamento: è una misurazione
    // NUOVA della stessa voce (altro locale, altro piano), non la fotocopia di quella di prima
    if(S.qty[k] && !(opts && opts.senzaMisure)) S.qty[nk]=JSON.parse(JSON.stringify(S.qty[k]));
    if(S.categoria[k] && !(opts && opts.senzaCategoria)) S.categoria[nk]=S.categoria[k];
    nuove.push(nk);
  });
  const n=nuove.length;
  CART_SEL.clear();
  if(!(opts && opts.muto)) toast(n?`${n} vo${n===1?'ce duplicata':'ci duplicate'} — assegna a ciascuna la sua categoria`:'Niente da duplicare','ok');
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
  return nuove;
}

function cartFilterRows(q){
  setCartQuery(q||'');
  const ov=document.getElementById('cart-overlay'); if(!ov) return;
  const t=(q||'').trim().toLowerCase();
  ov.querySelectorAll('.cm-sel-row').forEach(row=>{
    const hit=!t || row.textContent.toLowerCase().includes(t);
    row.style.display = hit ? '' : 'none';
    // nasconde anche il pannello misurazioni gemello (riga <tr> subito dopo)
    const nxt=row.nextElementSibling;
    if(nxt && nxt.classList && nxt.classList.contains('mis-panel-row')) nxt.style.display = hit ? '' : 'none';
  });
}

function cartImpCellHtml(prezzo,q){
  const qv=q&&q.qty>0?q.qty:null;
  const imp=(prezzo>0&&qv!=null)?prezzo*qv:null;
  return imp!=null
    ? `<b style="color:var(--text)">€ ${fmt(imp)}</b>`
    : `<span style="color:var(--text3)" title="${prezzo>0?'manca la quantità':'manca il prezzo'}">—</span>`;
}

function cartMdoLineHtml(T){
  return T.mdoIncidenza>0 ? `Incidenza manodopera media <b style="color:var(--text2);font-family:var(--mono)">${fmt(T.mdoIncidenza)}%</b>` : '';
}

function cartOpenCatPopoverForSel(ev){ openCatPopover(ev.currentTarget.getBoundingClientRect(), [...CART_SEL]); }

function cartPatchTotals(){
  const c=document.getElementById('cart-ov-count');
  if(c) c.textContent=S.sel.size+S.custom.size;
  const T=cartTotals();
  const tot=document.getElementById('cart-ov-total');
  if(tot) tot.textContent='€ '+fmt(T.tot);
  const warn=document.getElementById('cart-ov-warn');
  if(warn) warn.innerHTML='Totale computo'+cartWarn(T);
  const mdo=document.getElementById('cart-ov-mdo');
  if(mdo) mdo.innerHTML=cartMdoLineHtml(T);
}

function cartQtyBadgeHtml(key){
  const q=S.qty[key];
  if(!q) return '<span style="color:var(--text3);font-size:10px">— nessuna misura</span>';
  const srcMark=q.source==='manual'
    ? '<span title="manuale" style="color:var(--warn)">✎</span>'
    : '<span title="importata da una distinta" style="color:#22d3ee;font-weight:700">⇪</span>';
  return `<span style="background:rgba(34,211,238,.15);color:#22d3ee;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;font-family:var(--mono);white-space:nowrap">${fmt(q.qty)} ${esc(q.um||'')}</span> ${srcMark}`;
}

function cartRemoveKeys(keys){
  keys.forEach(k=>{ S.custom.delete(k); S.sel.delete(k); if(S.qty[k]) delete S.qty[k]; if(S.categoria[k]) delete S.categoria[k]; MIS_OPEN.delete(k); });
  CART_SEL.clear();
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
}

function cartRigaMDO(r, it){
  if(r && r.ru>0) return Number(r.ru);
  if(it && it.analisiPrezzi && window.calcolaAnalisi && window.incidenzaManodopera){
    return window.incidenzaManodopera(window.calcolaAnalisi(it.analisiPrezzi));
  }
  return 0;
}

function cartRows(){
  const byKey=new Map();
  for(const it of S.archive){
    if(it.loaded!==true) continue;
    for(const r of it.rows){
      const k=rowKey(r);
      if(S.sel.has(k) && !byKey.has(k)) byKey.set(k,r);
    }
  }
  return byKey;
}

function cartSelClear(){ CART_SEL.clear(); cartUpdateSelUI(); }

function cartSelToggle(key, additive){
  if(!additive){ const was=CART_SEL.has(key)&&CART_SEL.size===1; CART_SEL.clear(); if(!was) CART_SEL.add(key); }
  else CART_SEL.has(key)?CART_SEL.delete(key):CART_SEL.add(key);
  cartUpdateSelUI();
}

function cartSetView(v){
  setCartView(v);
  // le viste appartengono a Misura: sceglierne una TI PORTA lì, invece di lasciare il
  // binario a dire una cosa e la schermata a mostrarne un'altra
  if(CART_MODE!=='misura'){ setCartMode('misura'); }
  _syncRail('misura');
  refreshCartOverlayIfOpen();
}

function cartTotals(map){
  let tot=0, priced=0, noMeasure=0, noPrice=0, mdoTot=0;
  for(const [k,r] of (map||cartRows())){
    const q=S.qty[k];
    const qty=q&&q.qty>0?q.qty:null;
    if(!(r.prezzo>0)){ noPrice++; continue; }
    if(qty==null){ noMeasure++; continue; }
    const imp=r.prezzo*qty;
    tot += imp; priced++;
    mdoTot += imp*(cartRigaMDO(r)/100);
  }
  // Le voci composte (S.custom) seguono la stessa semantica di valorizzazione
  for(const [k,it] of S.custom){
    const q=S.qty[k];
    const qty=q&&q.qty>0?q.qty:null;
    if(!(it.prezzo>0)){ noPrice++; continue; }
    if(qty==null){ noMeasure++; continue; }
    const imp=it.prezzo*qty;
    tot += imp; priced++;
    mdoTot += imp*(cartRigaMDO(null,it)/100);
  }
  return { tot, priced, noMeasure, noPrice, mdoIncidenza: tot>0 ? (mdoTot/tot*100) : 0 };
}

function cartUpdateSelUI(){
  document.querySelectorAll('#cart-overlay .cm-sel-row').forEach(el=>el.classList.toggle('selected', CART_SEL.has(el.dataset.key)));
  const bar=document.getElementById('cart-ov-selbar');
  if(!bar) return;
  if(CART_SEL.size>0){ bar.classList.add('show'); const n=document.getElementById('cart-ov-seln'); if(n) n.textContent=CART_SEL.size; }
  else bar.classList.remove('show');
}

function cartViewSwitchHtml(){
  if(CART_MODE!=='misura') return ''; // in Categorizza non c'è nulla da commutare
  const views=[['tabella','Tabella'],['elenco','Elenco'],['capitoli','Capitoli']];
  return `<div class="cm-view-switch">${views.map(([v,l])=>
    `<button class="${CART_VIEW===v?'active':''}" onclick="cartSetView('${v}')">${l}</button>`).join('')}</div>`;
}

function cartWarn(t){
  const w=[];
  if(t.noMeasure) w.push(`${t.noMeasure} senza misura`);
  if(t.noPrice) w.push(`${t.noPrice} senza prezzo`);
  return w.length?` · <span style="color:var(--warn)">${w.join(' · ')} (escluse)</span>`:'';
}

export {
  cartAllEntries, cartAnalisi, cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartCapitoliGroups, cartCtxAssign,
  cartCtxAssignLivello, cartCtxMisure, cartDuplicateKeys,
  cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyBadgeHtml, cartRemoveKeys,
  cartRigaMDO, cartRows, cartSelClear, cartSelToggle, cartSetView, cartTotals, cartTreeToggle, cartUpdateSelUI, cartViewSwitchHtml,
  cartWarn
}
