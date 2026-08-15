/* μ (Prezzi) legacy — barra laterale: archivio dei prezzari raggruppato per regione.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { S } from './stato.js'
import { esc, jsEsc } from './index.js'
import { REGIONS, activePrezzarioLabel, itemTipo, loadItem, regColor } from './ricerca.js'
export function updateSidebarCollapsedLabel(){
  const el=document.getElementById('sidebar-collapsed-label');
  if(!el) return;
  const label=activePrezzarioLabel();
  el.textContent=label;
  el.title = label==='Prezzari' ? 'Prezzari caricati — clic su ▶ per espandere' : `${label} (prezzario attivo) — clic su ▶ per espandere`;
}
export function renderSidebar(){
  const list=document.getElementById('archive-list');
  const validCount=S.archive.filter(a=>a.loaded!=='empty').length;
  document.getElementById('arch-total').textContent=validCount?`${validCount} file`:'';
  updateSidebarCollapsedLabel();

  // separa pubblici, privati e listini METEL
  const pub=[], priv=[], metel=[];
  S.archive.forEach((item,idx)=>{
    if(item.loaded==='empty') return;
    const t=itemTipo(item);
    (t==='metel'?metel:t==='privato'?priv:pub).push({item,idx});
  });

  let html='';
  const pubCollapsed=S.collapsedGroup.has('pubblici');
  const privCollapsed=S.collapsedGroup.has('privati');
  const metelCollapsed=S.collapsedGroup.has('metel');

  // ══ GRUPPO PUBBLICI ══
  html+=`<div class="top-group-header" onclick="toggleTopGroup('pubblici')">
    <span class="tgh-arrow">${pubCollapsed?'▶':'▼'}</span>
    <span class="tgh-icon">⌂</span>
    <span class="tgh-name">Prezzari Pubblici</span>
    <span class="tgh-count">${pub.length}</span>
  </div>`;
  if(!pubCollapsed){
    html+=`<div class="top-group-body">`;
    html+=renderRegionGroups(pub);
    html+=`</div>`;
  }

  // ══ GRUPPO PRIVATI ══
  html+=`<div class="top-group-header" onclick="toggleTopGroup('privati')">
    <span class="tgh-arrow">${privCollapsed?'▶':'▼'}</span>
    <span class="tgh-icon">❖</span>
    <span class="tgh-name">Prezzari Privati</span>
    <span class="tgh-count">${priv.length}</span>
  </div>`;
  if(!privCollapsed){
    html+=`<div class="top-group-body">`;
    if(priv.length){
      priv.forEach(({item,idx})=>{ html+=renderArchItem(item,idx,'#6366f1'); });
    } else {
      html+=`<div class="group-empty-hint">Trascina qui un prezzario fornitore o privato</div>`;
    }
    html+=`</div>`;
  }

  // ══ GRUPPO LISTINI METEL ══
  html+=`<div class="top-group-header" onclick="toggleTopGroup('metel')">
    <span class="tgh-arrow">${metelCollapsed?'▶':'▼'}</span>
    <span class="tgh-icon">⚡</span>
    <span class="tgh-name">Listini METEL</span>
    <span class="tgh-count">${metel.length}</span>
  </div>`;
  if(!metelCollapsed){
    html+=`<div class="top-group-body">`;
    if(metel.length){
      metel.forEach(({item,idx})=>{ html+=renderArchItem(item,idx,'#0ea5e9'); });
    } else {
      html+=`<div class="group-empty-hint">Trascina qui un listino METEL (.dcf / .txt) di un fornitore</div>`;
    }
    html+=`</div>`;
  }

  list.innerHTML=html;
}

// costruisce i gruppi-regione (per i pubblici): regioni con prezzari + elenco grigio
export function renderRegionGroups(entries){
  const byReg={};
  entries.forEach(({item,idx})=>{
    if(!byReg[item.regione]) byReg[item.regione]=[];
    byReg[item.regione].push({item,idx});
  });
  const allRegions=[...new Set(Object.values(REGIONS))].sort((a,b)=>a.localeCompare(b,'it'));
  Object.keys(byReg).forEach(r=>{ if(!allRegions.includes(r)) allRegions.push(r); });
  const present=allRegions.filter(r=>byReg[r]);
  const absent=allRegions.filter(r=>!byReg[r]);

  let html='';
  present.forEach(reg=>{
    const list=byReg[reg];
    const c=regColor(reg);
    // Vista compatta: le regioni sono CHIUSE di default. Restano aperte se
    // l'utente le ha espanse in sessione o se contengono il prezzario attivo.
    const hasActive=list.some(e=>e.idx===S.active);
    const collapsed=!(S.expandedReg.has(reg) || hasActive);
    const loadedN=list.filter(e=>e.item.loaded===true).length;
    const years=[...new Set(list.map(e=>e.item.anno).filter(a=>a&&a!=='—'))].sort();
    const yearLabel=years.length?`<span class="rgh-year">${years.join(', ')}</span>`:'';
    html+=`<div class="reg-group-header" onclick="toggleRegGroup('${jsEsc(reg)}')" style="color:${c}">
      <span class="rgh-arrow">${collapsed?'▶':'▼'}</span>
      <span class="rgh-name">${reg}</span>
      ${yearLabel}
      <span class="rgh-count">${list.length}${loadedN?' · '+loadedN+' ✓':''}</span>
    </div>`;
    html+=`<div class="reg-group-body" ${collapsed?'style="display:none"':''}>`;
    list.forEach(({item,idx})=>{ html+=renderArchItem(item,idx,c); });
    html+=`</div>`;
  });

  if(present.length && absent.length){
    html+=`<div class="reg-divider">Regioni senza prezzari</div>`;
  } else if(!present.length){
    html+=`<div class="reg-divider">Apri o trascina un prezzario regionale</div>`;
  }
  absent.forEach(reg=>{
    html+=`<div class="reg-empty"><span class="reg-empty-dot"></span><span class="reg-empty-name">${reg}</span></div>`;
  });
  return html;
}

// costruisce un singolo item prezzario
export function renderArchItem(item,idx,color){
  const isActive=S.active===idx;
  const cls=(item.loaded===true?'loaded':item.loaded==='loading'?'loading':'')+(isActive?' active':'');
  const cnt=item.loaded===true
    ?`<span class="arch-count">${item.rows.length.toLocaleString('it')}</span>`
    :item.loaded==='loading'
    ?`<span class="arch-count" style="color:var(--warn)">…</span>`
    :`<span class="arch-count" style="opacity:.5">clic</span>`;
  const radio=item.loaded===true
    ? `<span class="arch-radio ${isActive?'on':''}" style="${isActive?'border-color:'+color+';background:'+color:''}"></span>`
    : `<span class="arch-dot"></span>`;
  // Nel gruppo regione il titolo è l'anno; con più PARTI della stessa edizione
  // (item.variante, es. "Parte 4 · Elenco prezzi") la si aggiunge per distinguerle.
  const annoTitle=item.variante?`${item.anno} · ${item.variante}`:item.anno;
  const title=item.anno&&item.anno!=='—'?(item.regione&&item.regione!=='Sconosciuta'?annoTitle:item.filename):item.filename;
  return `<div class="arch-item ${cls}" style="--reg:${color}" onclick="loadItem(${idx})" title="${esc(item.filename)}">
    ${radio}
    <div class="arch-info">
      <div class="arch-region">${esc(title)}${isActive?' <span class="arch-viewing">a video</span>':''}</div>
      <div class="arch-file">${esc(item.filename)}</div>
    </div>
    ${cnt}
  </div>`;
}

export function toggleTopGroup(g){
  if(S.collapsedGroup.has(g)) S.collapsedGroup.delete(g);
  else S.collapsedGroup.add(g);
  renderSidebar();
}

export function toggleRegGroup(reg){
  if(S.expandedReg.has(reg)) S.expandedReg.delete(reg);
  else S.expandedReg.add(reg);
  renderSidebar();
}
