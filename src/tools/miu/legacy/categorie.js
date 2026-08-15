// μ (Prezzi) legacy — modulo categorie.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { CAT_LIVELLI, CAT_LIVELLO_LABEL, CAT_SEP, S } from './stato.js'
import {
  CAT_DB, CAT_DB_ORIGIN, CAT_LIVELLO_HINT, CAT_PALETTE, CAT_PANEL_FILTER, esc, openCatPopover, persistCatDb,
  persistCatDbOrigin, refreshCartOverlayIfOpen, refreshCatDbGroups, setCatDbFilter, setCategoria, setCategoriaLivello
} from './index.js'

function catChipDragOver(ev,slot){
  ev.stopPropagation();
  const lv=CAT_LIVELLI[slot];
  if(!ev.dataTransfer.types.includes('text/catlv:'+lv)) return; // niente preventDefault → drop bloccato dal browser
  ev.preventDefault();
  ev.currentTarget.classList.add('drop-target');
}

function catChipDrop(ev,key,slot){
  ev.preventDefault();
  ev.stopPropagation();
  ev.currentTarget.classList.remove('drop-target');
  const liv=(slot!=null&&slot>=0)?slot:null;
  const format=liv!=null?('text/catlv:'+CAT_LIVELLI[liv]):'text/catlv';
  let d; try{ d=JSON.parse(ev.dataTransfer.getData(format)||'null'); }catch(e){ d=null; }
  if(!d||!d.nome) return;
  setCategoriaLivello(key, liv!=null?liv:Math.max(0,CAT_LIVELLI.indexOf(d.lv)), d.nome);
}

function catChipEdit(el,key,livello){
  if(el.querySelector('input')) return;
  const p=categoriaSlots(S.categoria[key]);
  const cur=p[livello]||'';
  el.classList.add('editing');
  el.innerHTML=`<input list="catdb-dl-${livello}" value="${esc(cur)}">`;
  const inp=el.querySelector('input');
  inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done) return; done=true; setCategoriaLivello(key,livello,inp.value); };
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter') commit();
    else if(e.key==='Escape'){ done=true; refreshCartOverlayIfOpen(); }
  });
  inp.addEventListener('blur',commit);
  inp.addEventListener('click',e=>e.stopPropagation());
}

function catChips3Html(key){
  const ek=key.replace(/'/g,"\\'");
  const p=categoriaSlots(S.categoria[key]); // posizionale: ogni chip mostra SOLO il suo livello
  const labels=['Supercategoria (ambito)','Categoria (disciplina)','Sottocategoria (voce della disciplina)'];
  return `<div class="cat3">${[0,1,2].map(i=>{
    const v=p[i]||'';
    const color=(i===0&&v)?categoriaColor(v):'';
    return `<span class="cat3-chip${v?'':' empty'}" ${color?`style="--chip-color:${color}"`:''}
      title="${labels[i]}${v?': '+esc(v):''} — clic per digitare (con suggerimenti), o trascina qui SOLO una chip dello stesso livello"
      onclick="event.stopPropagation();catChipEdit(this,'${ek}',${i})"
      ondragover="catChipDragOver(event,${i})"
      ondragleave="this.classList.remove('drop-target')"
      ondrop="catChipDrop(event,'${ek}',${i})">${v?esc(v):'+'}</span>`;
  }).join('<span class="cat3-sep">›</span>')}</div>`;
}

function catClearBtnHtml(key){
  if(!(S.categoria[key]||'').trim()) return '';
  const ek=key.replace(/'/g,"\\'");
  return `<button class="cat-clear" title="Togli la categoria da questa voce" onclick="event.stopPropagation();setCategoria('${ek}','')">✕</button>`;
}

function catDbAdd(livello,nome,origine){
  nome=(nome||'').trim();
  if(!nome||!CAT_DB[livello]) return;
  if(!CAT_DB[livello].includes(nome)){ CAT_DB[livello].push(nome); persistCatDb(); }
  // la provenienza si registra solo la prima volta (la prima fonte che l'ha
  // introdotta nel vocabolario) — un riuso manuale successivo non la declassa.
  if(origine && !CAT_DB_ORIGIN[livello][nome]){ CAT_DB_ORIGIN[livello][nome]=origine; persistCatDbOrigin(); }
}

function catDbAll(){
  const g=window.CATEGORIE_GOLDEN||{sp:[],cat:[],sb:[]};
  const out={sp:[],cat:[],sb:[]}, seen={sp:new Set(),cat:new Set(),sb:new Set()};
  const push=(lv,n)=>{ n=(n||'').trim(); if(n&&!seen[lv].has(n)){ seen[lv].add(n); out[lv].push(n); } };
  const normSp=n=>(window.normalizzaAmbito?window.normalizzaAmbito(n):n);
  // Golden è già curato/normalizzato in origine — invariato.
  for(const lv of CAT_LIVELLI) (g[lv]||[]).forEach(n=>push(lv,n));
  // CAT_DB (vocabolario imparato): normalizza la Supercategoria SOLO per le
  // voci non arrivate da un import esterno — quelle restano letterali
  // (imperativo), col pallino di provenienza a segnalarle nel pannello.
  for(const lv of CAT_LIVELLI) (CAT_DB[lv]||[]).forEach(n=>{
    const literal = lv==='sp' && catDbOrigine(lv,n)==='primus';
    push(lv, literal?n:(lv==='sp'?normSp(n):n));
  });
  // Categorie già assegnate nel computo corrente: letterali sempre (sono
  // ESATTAMENTE ciò che è scritto sulla voce, di origine esterna o no — l'elenco qui
  // serve a riprendere in fretta un valore già usato, non a generalizzarlo).
  for(const k in S.categoria){
    const p=categoriaSlots(S.categoria[k]); // POSIZIONALE: il sotto resta nel livello sotto
    CAT_LIVELLI.forEach((lv,i)=>{ if(p[i]) push(lv,p[i]); });
  }
  for(const lv of CAT_LIVELLI) out[lv].sort((a,b)=>a.localeCompare(b,'it'));
  return out;
}

function catDbDatalistsHtml(){
  const db=catDbAll();
  return CAT_LIVELLI.map((lv,i)=>`<datalist id="catdb-dl-${i}">${db[lv].map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`).join('');
}

function catDbDragStart(ev){
  const el=ev.currentTarget;
  const payload=JSON.stringify({ lv:el.dataset.lv, nome:el.dataset.nome });
  // due formati: uno generico (per il drop sull'INTERA riga, va al livello di
  // provenienza) e uno per-livello (per il drop su una CHIP specifica — il
  // browser permette il drop solo se il dragover fa preventDefault, e lo fa
  // solo quando i tipi coincidono: una Sottocategoria non può più finire nello
  // slot Supercategoria trascinandola sopra).
  ev.dataTransfer.setData('text/catlv', payload);
  ev.dataTransfer.setData('text/catlv:'+el.dataset.lv, payload);
}

function catDbFeedPath(cat,origine){
  // POSIZIONALE: un valore con solo la Sottocategoria non deve finire nella lista
  // Supercategorie (era il bug: categoriaParts compattava e il sotto diventava super).
  const s=categoriaSlots(cat);
  CAT_LIVELLI.forEach((lv,i)=>{
    if(!s[i]) return;
    const nome=(lv==='sp' && origine!=='primus' && window.normalizzaAmbito) ? window.normalizzaAmbito(s[i]) : s[i];
    catDbAdd(lv,nome,origine);
  });
}

function catDbGroupsHtml(){
  const db=catDbAll();
  const f=CAT_PANEL_FILTER.trim().toLowerCase();
  return CAT_LIVELLI.map((lv,i)=>{
    const items=db[lv].filter(n=>!f||n.toLowerCase().includes(f));
    return `<div class="catdb-group">
      <div class="catdb-group-hd">${CAT_LIVELLO_LABEL[lv]} <span class="catdb-group-hint">· ${CAT_LIVELLO_HINT[lv]}</span></div>
      <div class="catdb-chips">${items.map(n=>{
        const daPrimus=catDbOrigine(lv,n)==='primus';
        return `<span class="catdb-chip${daPrimus?' from-primus':''}" draggable="true" data-lv="${lv}" data-nome="${esc(n)}"
          ondragstart="catDbDragStart(event)" ${i===0?`style="--chip-color:${categoriaColor(n)}"`:''}
          title="${daPrimus?'Voce con codice originale, importata da fuori μ — ':''}Trascina su una voce (o sulla chip del livello) per assegnare">${daPrimus?'<span class="from-primus-dot" title="Da un import esterno"></span>':''}${esc(n)}<span class="catdb-x" draggable="false" title="Rimuovi «${esc(n)}» dal database" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();catDbRemove('${lv}','${esc(n).replace(/'/g,"\\'")}')">×</span></span>`;
      }).join('')||'<span class="catdb-none">nessuna</span>'}</div>
      <input class="catdb-add" placeholder="+ nuova…" onkeydown="event.stopPropagation();if(event.key==='Enter'){catDbAdd('${lv}',this.value,'manuale');this.value='';refreshCatDbGroups();}">
    </div>`;
  }).join('');
}

function catDbOrigine(livello,nome){ return (CAT_DB_ORIGIN[livello]||{})[nome]||null; }

function catDbPanelHtml(){
  return `<div class="catdb-panel">
    <div class="catdb-hd">▤ Database categorie</div>
    <input class="catdb-search" placeholder="Cerca…" value="${esc(CAT_PANEL_FILTER)}"
      onkeydown="event.stopPropagation()" oninput="setCatDbFilter(this.value)">
    <div id="catdb-groups">${catDbGroupsHtml()}</div>
    <div class="catdb-hint"><span class="from-primus-dot" style="display:inline-block;vertical-align:1px"></span> = da un import esterno — le altre sono nel database (minato o digitato a mano). I nomi nuovi che usi si aggiungono da soli e restano per i prossimi computi.</div>
  </div>`;
}

function catDbRemove(livello,nome){
  CAT_DB[livello]=(CAT_DB[livello]||[]).filter(x=>x!==nome);
  if(CAT_DB_ORIGIN[livello]) delete CAT_DB_ORIGIN[livello][nome];
  persistCatDb(); persistCatDbOrigin(); refreshCatDbGroups();
}

function categoriaChipHtml(key){
  const ek=key.replace(/'/g,"\\'");
  const cat=S.categoria[key]||'';
  if(!cat) return `<button class="cat-chip empty" onclick="event.stopPropagation();openCatPopover(this.getBoundingClientRect(),['${ek}'])">+ categoria</button>`;
  const parts=categoriaParts(cat), color=categoriaColor(cat), tail=parts.slice(1).join(' › ');
  return `<span class="cat-chip-wrap"><button class="cat-chip" style="--chip-color:${color}" onclick="event.stopPropagation();openCatPopover(this.getBoundingClientRect(),['${ek}'])" title="${esc(categoriaLabel(cat))}">
    <span class="dot"></span><span class="path"><b>${esc(parts[0])}</b>${tail?' <span class="sub">› '+esc(tail)+'</span>':''}</span>
  </button>${catClearBtnHtml(key)}</span>`;
}

function categoriaColor(cat){
  const l1=categoriaParts(cat)[0]; if(!l1) return '';
  let h=0; for(let i=0;i<l1.length;i++) h=(h*31+l1.charCodeAt(i))>>>0;
  return CAT_PALETTE[h%CAT_PALETTE.length];
}

function categoriaDaDistinta(it){
  if(!it) return '';
  return [it.ambiente, it.disciplina, it.capitolo].filter(Boolean).join(CAT_SEP);
}

function categoriaHeaderRow(cat){
  return `<tr class="cart-cat-head"><td colspan="6" style="padding:9px 4px 4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);font-weight:800;border-top:2px solid var(--border)">${esc(cat)}</td></tr>`;
}

function categoriaLabel(cat){ return categoriaParts(cat).join(' › '); }

function categoriaParts(cat){ return (cat||'').split(CAT_SEP).filter(Boolean); }

function categoriaSlots(cat){
  const a=(cat||'').split(CAT_SEP);
  return [ (a[0]||'').trim(), (a[1]||'').trim(), (a[2]||'').trim() ];
}

function categorieUsate(){
  const seen=new Set(); const out=[];
  for(const k in S.categoria){ const v=S.categoria[k]; if(v && !seen.has(v)){ seen.add(v); out.push(v); } }
  return out;
}

export {
  catChipDragOver, catChipDrop, catChipEdit, catChips3Html, catClearBtnHtml, catDbAdd, catDbAll, catDbDatalistsHtml,
  catDbDragStart, catDbFeedPath, catDbGroupsHtml, catDbOrigine, catDbPanelHtml, catDbRemove, categoriaChipHtml, categoriaColor,
  categoriaDaDistinta, categoriaHeaderRow, categoriaLabel, categoriaParts, categoriaSlots, categorieUsate
}
