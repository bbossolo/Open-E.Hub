/* μ (Prezzi) legacy — dizionario delle categorie dello studio (persistito in locale) e
   popover di assegnazione categoria/livello. La resa dei chip vive in categorie.js.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { catDbAll, catDbFeedPath, catDbGroupsHtml, catDbOrigine, categoriaColor, categoriaLabel, categoriaParts, categoriaSlots, categorieUsate } from './categorie.js'
import { CAT_LIVELLI, CAT_LIVELLO_LABEL, CAT_SEP, S } from './stato.js'
import { refreshCartOverlayIfOpen, updateCartInfo } from './computo-overlay.js'
import { esc, toast } from './index.js'
// Lookup per data-attribute (niente selettori costruiti da stringhe: le chiavi
// possono contenere apostrofi/virgolette).
// Patch mirato dopo una modifica alle misurazioni: Q.tà delle righe, Totale del
// pannello, badge quantità+importo della riga voce, totali dell'overlay — SENZA
// ricostruire l'overlay (il rebuild distruggeva l'input col focus: Tab tra
// L1→L2→H→N era rotto e ogni campo andava ricliccato).
// Ri-render del SOLO pannello misure (aggiunta/rimozione riga, apri/chiudi) con
// focus opzionale su un campo; fallback al rebuild completo nelle viste senza
// tbody (Categorie/Elenco), stessa guardia di removeFromCart.
// Mutazione pura (senza render): aggiunge una riga vuota, torna il suo indice.
// Alla chiusura del pannello: elimina le righe completamente vuote (niente fantasmi).
// Tastiera nel pannello misure: Invio = commit + riga successiva (nuova se è
// l'ultima) · Esc = chiudi il pannello (stopPropagation: non chiude l'overlay).
// Pannello misure per una riga di carrello (reale o composta): tabella
// descrizione|N|L1|L2|H|quantità + aggiungi/rimuovi riga (N per primo: è il
// fattore digitato più spesso). Vuoto se chiuso.
// Link "▸ Misure" per aprire/chiudere il pannello misurazioni di una riga: freccetta che
// ruota + etichetta col conteggio, sulla propria riga sotto la quantità — deve essere
// ovvio che è un cassetto apri/chiudi, non un'icona misteriosa (rilievo utente).
// ── CATEGORIA del computo metrico (assegnazione manuale) ──────────────────────
// S.categoria[key] = nome categoria. Nota di dominio: qui è SOLO categoria (i
// capitoli strutturano l'Elenco Prezzi, un altro documento — non li usiamo qui).
export function setCategoria(key,val){
  // normalizza PER SLOT (non un .trim() globale: taglierebbe lo spazio iniziale del
  // separatore in un percorso con la sola Sottocategoria, corrompendolo). Le posizioni
  // dei livelli restano intatte.
  const v=joinCatSlots(categoriaSlots(val));
  if(v) S.categoria[key]=v; else delete S.categoria[key];
  if(v) catDbFeedPath(v,'manuale'); // il vocabolario impara ogni percorso assegnato
  refreshCartOverlayIfOpen(); updateCartInfo();
}
// ✕ per TOGLIERE del tutto la categoria da una voce (un-assign). Visibile solo
// quando c'è qualcosa da togliere.
// Rimuove un nome dal database categorie (solo le voci aggiunte a mano/minate in
// CAT_DB; i nomi del golden e quelli in uso nel computo restano finché servono).
// Nomi già usati nel computo, per il popover di riuso (ordine di prima comparsa).
// Percorso "Supercategoria · Categoria · Sottocategoria" — SEMPRE questa unica
// stringa (stesso separatore/campo dell'export).
// I 3 livelli seguono la terminologia nativa dei computi metrici (mai "capitolo").

export const CAT_PALETTE=['#1ca371','#19b6d8','#df9a12','#7d61e8','#e0668c','#4fa8f2'];
// LETTURA POSIZIONALE (3 slot fissi): a differenza di categoriaParts NON compatta
// i livelli vuoti, così ogni famiglia resta nel SUO livello e si può assegnare la
// Sottocategoria prima di Supercategoria/Categoria. Es. solo sotto → ['','','X'].
// Scrittura: taglia SOLO gli slot vuoti in coda (conserva le posizioni iniziali/
// intermedie vuote). Per un percorso COMPLETO la stringa è identica a prima
// ("A · B · C"), quindi export/interop restano invariati; l'engine
// di export filtra comunque i livelli vuoti (categoriaParts).
export function joinCatSlots(slots){
  let end=slots.length; while(end>0 && !slots[end-1]) end--;
  return end===0 ? '' : slots.slice(0,end).join(CAT_SEP);
}
// Etichetta di sola VISUALIZZAZIONE: livelli non vuoti separati da " › " (niente
// separatori penzolanti quando i livelli iniziali sono vuoti).
// ── DATABASE della struttura categorie (3 livelli) ───────────────────────────
// Vocabolario per suggerimenti/drag&drop: parte dal GOLDEN minato dai computi
// reali (window.CATEGORIE_GOLDEN, engine/categorie-db.ts), si espande con le
// categorie dell'utente (persistite in localStorage) e con quelle già usate
// nel computo corrente — inserimento manuale minimo, mai un vocabolario chiuso.


// Regola di dominio (utente): Supercategoria = AMBITO (zona fisica del cantiere:
// "Esterni", "Cabina elettrica 4", "Palazzina uffici"…), Categoria = DISCIPLINA
// (Impianti Elettrici, Impianti Meccanici…), Sottocategoria = voce specifica
// DI QUELLA disciplina (Quadri Elettrici, Cavidotti, Idrico Sanitario,
// Climatizzazione…) — guida i placeholder/hint, non un vincolo imposto al dato.
export const CAT_LIVELLO_HINT={ sp:'ambito', cat:'disciplina', sb:'voce della disciplina' };
export function loadCatDb(){
  try{ const d=JSON.parse(localStorage.getItem('miu:catdb')||'null'); if(d&&Array.isArray(d.sp)) return d; }catch(e){}
  return { sp:[], cat:[], sb:[] };
}
export let CAT_DB=loadCatDb();
export function persistCatDb(){ try{ localStorage.setItem('miu:catdb', JSON.stringify(CAT_DB)); }catch(e){} }
// Provenienza delle voci imparate dall'utente: quali nomi sono arrivati da un
// un IMPORT esterno (flusso seamless — il vocabolario si arricchisce
// da solo mentre si lavora) invece che digitati a mano. Solo etichetta/badge:
// il merge in catDbAll() resta unico, la provenienza non crea liste separate.
export function loadCatDbOrigin(){
  try{ const d=JSON.parse(localStorage.getItem('miu:catdb-origin')||'null'); if(d&&d.sp) return d; }catch(e){}
  return { sp:{}, cat:{}, sb:{} };
}
export let CAT_DB_ORIGIN=loadCatDbOrigin();
export function persistCatDbOrigin(){ try{ localStorage.setItem('miu:catdb-origin', JSON.stringify(CAT_DB_ORIGIN)); }catch(e){} }
// Ogni percorso assegnato alimenta il DB: i livelli entrano nel vocabolario.
// origine: 'primus' (da un import esterno) o 'manuale' (digitato/scelto a mano).
// IMPERATIVO: le categorie che arrivano da un import esterno restano LETTERALI, mai
// normalizzate — solo il vocabolario curato/digitato a mano si generalizza
// (togliendo i numeri di edificio dalla Supercategoria, vedi normalizzaAmbito).
// Vista fusa: golden + utente + computo corrente, dedup, alfabetico (it).
// Migrazione una tantum: normalizza/dedup le Supercategorie già persistite in
// CAT_DB prima di questa versione (localStorage 'miu:catdb') — chi ha già
// testato la funzione con "Comparto 10"/"Comparto 11" nel vocabolario locale
// altrimenti li vedrebbe non generalizzati per sempre (il feed a runtime non
// tocca ciò che è già salvato, solo i nuovi ingressi).
export function migrateCatDbSp(){
  if(!CAT_DB.sp || !CAT_DB.sp.length || !window.normalizzaAmbito) return;
  const seen=new Set(), out=[];
  let changed=false;
  for(const n of CAT_DB.sp){
    const norm = catDbOrigine('sp',n)==='primus' ? n : window.normalizzaAmbito(n);
    if(norm!==n) changed=true;
    if(!seen.has(norm)){ seen.add(norm); out.push(norm); } else changed=true;
  }
  if(changed){ CAT_DB.sp=out; persistCatDb(); }
}
migrateCatDbSp();
// Imposta UN livello del percorso di una voce, conservando gli altri.
export function setCategoriaLivello(key, livello, nome){
  const s=categoriaSlots(S.categoria[key]);
  s[livello]=(nome||'').trim();
  setCategoria(key, joinCatSlots(s)); // posizioni conservate: ogni livello resta al suo posto
}
// Colore deterministico per Supercategoria: lega visivamente Tabella/Categorie/
// Elenco senza dover aprire l'albero per capire come si raggruppano le voci.
// Chip categoria per una riga (reale o composta): assegnazione VELOCE via
// popover (categorie già usate, ricercabili, un clic assegna) invece di un
// input di testo da ridigitare ogni volta.
// ── popover "assegna categoria" — creato dinamicamente (stesso pattern di
// cmpAPMoMenuToggle/openCartsMenu), riusabile per 1 o N voci (lazo+contestuale). ──
export function openCatPopover(rect, keys){
  closeCatPopover();
  const pop=document.createElement('div');
  pop.id='cat-popover'; pop.className='cat-pop';
  pop._keys=keys;
  pop.innerHTML=`
    <div class="cat-pop-hd"><span>Assegna categoria</span>${keys.length>1?`<span class="n">${keys.length} voci</span>`:''}</div>
    <input class="cat-pop-search" placeholder="Cerca categoria…" oninput="renderCatPopoverList(this.value)">
    <div class="cat-pop-list" id="cat-pop-list"></div>
    <button class="cat-pop-newtoggle" onclick="toggleCatPopoverNew()">+ Nuova categoria</button>
    <div class="cat-pop-new" id="cat-pop-new">
      <div class="lv"><span class="lv-lbl">Supercategoria</span><input id="cp-l1" placeholder="ambito — es. Esterni, Cabina elettrica 4"></div>
      <div class="lv"><span class="lv-lbl">Categoria</span><input id="cp-l2" placeholder="disciplina — es. Impianti Elettrici, Impianti Meccanici"></div>
      <div class="lv"><span class="lv-lbl">Sottocategoria</span><input id="cp-l3" placeholder="voce della disciplina — es. Quadri Elettrici, Climatizzazione"></div>
      <button class="cat-pop-apply" onclick="applyCatPopoverNew()">Applica</button>
    </div>`;
  document.body.appendChild(pop);
  const r=rect||{bottom:60,left:60};
  const top=Math.min(r.bottom+6, window.innerHeight-380);
  const left=Math.min(r.left, window.innerWidth-300);
  pop.style.top=Math.max(8,top)+'px'; pop.style.left=Math.max(8,left)+'px';
  renderCatPopoverList('');
  const s=pop.querySelector('.cat-pop-search'); if(s) s.focus();
}
export function closeCatPopover(){ const p=document.getElementById('cat-popover'); if(p) p.remove(); }
export function renderCatPopoverList(q){
  const pop=document.getElementById('cat-popover'); if(!pop) return;
  const list=pop.querySelector('#cat-pop-list');
  const cats=categorieUsate().filter(c=>c.toLowerCase().includes((q||'').trim().toLowerCase()));
  // data-cat (via esc()) invece di JSON.stringify dentro onclick: JSON.stringify
  // produce virgolette letterali che spezzano l'attributo HTML onclick="..."
  // (bug: il click su una categoria già usata non faceva nulla, silenziosamente).
  list.innerHTML = cats.length ? cats.map(c=>{
    const parts=categoriaParts(c), color=categoriaColor(c);
    return `<div class="cat-pop-item" style="--chip-color:${color}" data-cat="${esc(c)}" onclick="applyCategoriaToKeys(this.dataset.cat)">
      <span class="dot"></span><span class="path"><b>${esc(parts[0])}</b><span> › ${esc(parts.slice(1).join(' › '))}</span></span>
    </div>`;
  }).join('') : `<div class="cat-pop-empty">Nessuna categoria trovata.</div>`;
}
export function toggleCatPopoverNew(){
  const el=document.getElementById('cat-pop-new'); if(el) el.classList.toggle('show');
}
export function applyCatPopoverNew(){
  // POSIZIONALE: niente filter (un form con la sola Sottocategoria non deve
  // collassare nel livello Supercategoria).
  const slots=['cp-l1','cp-l2','cp-l3'].map(id=>(document.getElementById(id).value||'').trim());
  if(!slots.some(Boolean)) return;
  applyCategoriaToKeys(joinCatSlots(slots));
}
export function applyCategoriaToKeys(cat){
  const pop=document.getElementById('cat-popover'); const keys=(pop&&pop._keys)||[];
  keys.forEach(k=>setCategoria(k,cat));
  closeCatPopover();
  toast(`Categoria assegnata${keys.length>1?' a '+keys.length+' voci':''}: ${categoriaLabel(cat)}`,'ok');
}
document.addEventListener('click', (e)=>{
  if(e.target.closest('.cat-pop') || e.target.closest('.cat-chip') || e.target.closest('.cat3-chip')) return;
  closeCatPopover();
}, true);
// ── popover "assegna SOLO un livello" (Supercategoria/Categoria/Sottocategoria)
// — stesso pattern di openCatPopover ma filtrato al DB di quel livello, per il
// menu contestuale a 3 pulsanti (assegnazione ancora più rapida sulla selezione). ──
export function openLivelloPopover(rect, keys, livello){
  closeCatPopover();
  const pop=document.createElement('div');
  pop.id='cat-popover'; pop.className='cat-pop';
  pop._keys=keys; pop._livello=livello;
  const label=CAT_LIVELLO_LABEL[CAT_LIVELLI[livello]];
  pop.innerHTML=`
    <div class="cat-pop-hd"><span>Assegna ${label.slice(0,-1)}</span>${keys.length>1?`<span class="n">${keys.length} voci</span>`:''}</div>
    <input class="cat-pop-search" placeholder="Cerca o digita nuovo…" oninput="renderLivelloPopoverList(this.value)"
      onkeydown="event.stopPropagation();if(event.key==='Enter'){applyLivelloToKeys(this.value)}">
    <div class="cat-pop-list" id="cat-pop-list"></div>`;
  document.body.appendChild(pop);
  const r=rect||{bottom:60,left:60};
  const top=Math.min(r.bottom+6, window.innerHeight-320);
  const left=Math.min(r.left, window.innerWidth-300);
  pop.style.top=Math.max(8,top)+'px'; pop.style.left=Math.max(8,left)+'px';
  renderLivelloPopoverList('');
  const s=pop.querySelector('.cat-pop-search'); if(s) s.focus();
}
export function renderLivelloPopoverList(q){
  const pop=document.getElementById('cat-popover'); if(!pop||pop._livello==null) return;
  const list=pop.querySelector('#cat-pop-list');
  const lv=CAT_LIVELLI[pop._livello];
  const nomi=(catDbAll()[lv]||[]).filter(n=>n.toLowerCase().includes((q||'').trim().toLowerCase()));
  list.innerHTML = nomi.length ? nomi.map(n=>{
    const color=pop._livello===0?categoriaColor(n):'';
    return `<div class="cat-pop-item" style="--chip-color:${color||'var(--text3)'}" data-nome="${esc(n)}" onclick="applyLivelloToKeys(this.dataset.nome)">
      <span class="dot"></span><span class="path">${esc(n)}</span>
    </div>`;
  }).join('') : `<div class="cat-pop-empty">Nessun suggerimento — digita e premi Invio per una voce nuova.</div>`;
}
export function applyLivelloToKeys(nome){
  const pop=document.getElementById('cat-popover'); if(!pop||pop._livello==null) return;
  nome=(nome||'').trim(); if(!nome) return;
  const keys=pop._keys||[], livello=pop._livello;
  keys.forEach(k=>setCategoriaLivello(k,livello,nome));
  closeCatPopover();
  toast(`${CAT_LIVELLO_LABEL[CAT_LIVELLI[livello]].slice(0,-1)} assegnata${keys.length>1?' a '+keys.length+' voci':''}: ${nome}`,'ok');
}
// Comparatore per raggruppare per categoria: categorizzate prima (alfabetico), le
// non categorizzate sempre in coda (senza intestazione) — niente trucchi Unicode.
export function byCategoriaKey([ka],[kb]){
  const ca=S.categoria[ka]||'', cb=S.categoria[kb]||'';
  if(!ca && !cb) return 0;
  if(!ca) return 1;
  if(!cb) return -1;
  return ca.localeCompare(cb);
}
// ── vista CATEGORIE: pannello sinistro col DATABASE delle categorie (golden
// minato dai computi reali + vocabolario utente, 3 gruppi per livello, chips
// trascinabili) + voci a destra con le 3 chip del percorso. Assegnazione:
// drag&drop dal pannello (sulla chip del livello o sull'intera riga) oppure
// clic sulla chip → digitazione con suggerimenti. ────────────────────────────
export let CAT_PANEL_FILTER='';
export function refreshCatDbGroups(){
  const el=document.getElementById('catdb-groups'); if(el) el.innerHTML=catDbGroupsHtml();
}
// STEP 1: la scrittura inline `CAT_PANEL_FILTER=...` in un attributo non colpirebbe
// la variabile di modulo; il setter lo fa correttamente e resta esposto su window.
export function setCatDbFilter(v){ CAT_PANEL_FILTER = v; refreshCatDbGroups(); }
