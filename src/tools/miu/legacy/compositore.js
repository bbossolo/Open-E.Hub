// μ (Prezzi) legacy — modulo compositore.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { CMP, MIU_LIBRERIA, S, _phiPresetQty, setApRefQ, setApSearchQ, setCMP, setMiuLibreria, setPhiPresetQty } from './stato.js'
import {
  CMP_CANDIDATI, CMP_TYPE_TIMERS, closeComponi, cmpAPAutoSuggestManodopera, cmpAPAutoSuggestMateriale, cmpAPDefault, cmpAPRender, esc,
  nextCustomKey, openComponi, openComponiAnalisi, persistLibreria, refreshCartOverlayIfOpen, renderComponi, renderLibreria, setStep,
  toast, updateCartInfo
} from './index.js'

function cmpAcc(key, label, count, body, openOverride){
  const open = openOverride!=null ? openOverride : !!CMP.acc[key];
  return `<div class="cmp-acc"><div class="cmp-acc-hd" onclick="cmpToggleAcc('${key}')"><span class="cmp-acc-chev">${open?'▾':'▸'}</span> ${esc(label)} <span class="cmp-acc-count">${count}</span></div>`+
    (open?`<div class="cmp-acc-body">${body}</div>`:'')+`</div>`;
}

function cmpAddCustom(name){
  const n=(name||'').trim();
  if(!n) return;
  CMP.fam=null; CMP.custom=n; CMP.misura=null; CMP.materiale=null; CMP.posa=null; CMP.opzioni=[];
  CMP.edBreve=null; CMP.edEstesa=null; CMP.showPicker=false;
  const inp=document.getElementById('cmp-custom-input'); if(inp) inp.value='';
  renderComponi();
}

function cmpAddToCart(btn){
  const breve=((CMP.edBreve!=null&&CMP.edBreve.trim()!=='')?CMP.edBreve:CMP.genBreve||'').trim();
  const estesa=((CMP.edEstesa!=null&&CMP.edEstesa.trim()!=='')?CMP.edEstesa:CMP.genEstesa||'').trim();
  if(!breve && !estesa) return;
  const fr=cmpFrasario();
  const um = fr ? (fr.umTipiche&&fr.umTipiche[0]) || 'cad' : 'cad';
  const famNome = fr ? fr.nome : (CMP.custom||'');
  // se arrivi da «✎ modifica» di una voce del computo, AGGIORNA quella (conserva
  // prezzo/um/quantità già impostati), altrimenti creane una nuova.
  const editing = CMP.editingCartKey && S.custom.has(CMP.editingCartKey);
  const key = editing ? CMP.editingCartKey : nextCustomKey();
  const prev = editing ? S.custom.get(key) : null;
  S.custom.set(key, { desc_short:breve, declaratoria:estesa||breve,
    um: prev ? (prev.um||um) : um, prezzo: prev ? (prev.prezzo??null) : null,
    famigliaId:CMP.fam||null, famNome: famNome || (prev?prev.famNome:'') });
  if(!editing && _phiPresetQty!=null){
    S.qty[key] = { qty:_phiPresetQty, um, source:'phi' };
    setPhiPresetQty(null);
  }
  CMP.editingCartKey=null;
  updateCartInfo();
  cmpClearDraft(); // voce completata: la bozza in corso non serve più
  if(editing){ setStep('misura'); toast('Voce aggiornata nel computo','ok'); return; } // torna al computo
  refreshCartOverlayIfOpen(); // riflette subito la modifica se il computo è a video
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓ aggiunta';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1400); }
}

function cmpApplyLibState(){
  let open=false; try{ open=localStorage.getItem('miu:cmp-lib-open')==='1'; }catch(e){}
  document.getElementById('cmp-body')?.classList.toggle('lib-collapsed', !open);
}

function cmpCandAdd(i, btn){
  if(btn && btn.disabled) return; // doppio click: ignora, evita voci duplicate nel computo
  const p=CMP_CANDIDATI[i]; if(!p) return;
  if(btn) btn.disabled=true;
  const t=cmpPropText(p);
  const key=nextCustomKey();
  S.custom.set(key, { desc_short:t.breve, declaratoria:t.estesa||t.breve, um:p.um||'cad', prezzo:(p.prezzo!=null&&!isNaN(p.prezzo))?Number(p.prezzo):null, famigliaId:p.famigliaId||null, famNome:p.famNome||'',
    caratteristiche:(p.caratteristiche&&p.caratteristiche.length)?p.caratteristiche:undefined, marca:p.marca||undefined, modello:p.modello||undefined, codice_prodotto:p.codice||undefined });
  updateCartInfo();
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓ aggiunta';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; btn.disabled=false; },1200); }
}

function cmpCandLoad(i){
  const p=CMP_CANDIDATI[i]; if(!p) return;
  const t=cmpPropText(p);
  CMP.fam = p.famigliaId||null;
  // se il famigliaId riconosciuto dalla scheda non risolve in una voce del
  // FRASARIO (comparti di nicchia), il compositore resterebbe "senza famiglia
  // scelta" e la sezione "Da scheda tecnica" non si chiuderebbe mai (picked
  // richiede fr||CMP.custom): fallback su una famiglia personalizzata col nome
  // riconosciuto, così la sezione collassa comunque.
  const frOk = CMP.fam && (window.FRASARIO||[]).some(f=>f.famigliaId===CMP.fam);
  CMP.custom = frOk ? null : (p.famNome || t.breve || 'personalizzata');
  if(!frOk) CMP.fam=null;
  CMP.misura = p.misura||null; CMP.materiale = p.materiale||null; CMP.posa = p.posa||null;
  CMP.opzioni = Array.isArray(p.opzioni) ? p.opzioni.slice() : [];
  CMP.edBreve = t.breve; CMP.edEstesa = t.estesa;
  // Flusso "scheda tecnica → descrizione → manodopera/materiale → salva": il
  // PRODOTTO della scheda (marca/modello, prezzo se agganciato a METEL) entra
  // già come riga MATERIALE dell'Analisi Prezzi — niente da ricercare/ridigitare.
  const matDesc = [p.marca, p.modello].filter(Boolean).join(' ') || t.breve;
  if(matDesc){
    CMP.analisi = cmpAPDefault();
    CMP.analisi.um = p.um || CMP.analisi.um;
    CMP.analisi.righe = [{
      tipo:'materiale', descrizione:matDesc, um:p.um||'cad', quantita:1,
      prezzoUnitario:(p.prezzo!=null&&!isNaN(p.prezzo))?Number(p.prezzo):0,
      ...(p.codice ? { fonte:{ codice:p.codice, regione:p.marca||'scheda tecnica', anno:'' } } : {}),
    }];
    CMP.editingLibId = null;
  }
  // manodopera "già pronta per tematica" (elettricista/idraulico…) dalla famiglia
  // riconosciuta nella scheda — l'utente inserisce solo le ore.
  cmpAPAutoSuggestManodopera();
  renderComponi();
  if(matDesc) cmpAPRender(); // pannello Analisi Prezzi sempre in DOM (anche se non visibile ora)
  toast(matDesc?'Voce caricata: materiale già in Analisi Prezzi, rivedi e aggiungi manodopera':'Voce caricata nel compositore: rivedi le caratteristiche e conferma','ok');
}

function cmpCandSave(i, btn){
  if(btn && btn.disabled) return; // doppio click: ignora, evita duplicati in libreria
  const p=CMP_CANDIDATI[i]; if(!p) return;
  if(btn) btn.disabled=true;
  const t=cmpPropText(p);
  MIU_LIBRERIA.unshift({
    id:'lib'+Date.now(),
    nome: t.breve.length>64 ? t.breve.slice(0,61)+'…' : (t.breve||p.famNome||''),
    famigliaId: p.famigliaId||undefined,
    misura: p.misura||undefined, materiale: p.materiale||undefined, posa: p.posa||undefined,
    opzioni: (p.opzioni&&p.opzioni.length)?p.opzioni.slice():undefined,
    um: p.um||'cad',
    breve: t.breve, estesa: t.estesa||t.breve,
  });
  persistLibreria(); renderLibreria();
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; btn.disabled=false; },1400); }
}

function cmpClearDraft(){ try{ localStorage.removeItem('miu:cmp-draft'); }catch(e){} }

function cmpConfLabel(c){ return c>=0.75?{k:'alta',t:'alta'}:c>=0.55?{k:'media',t:'media'}:{k:'bassa',t:'bassa'}; }

function cmpCopy(kind, btn){
  const ed = kind==='breve'?CMP.edBreve:CMP.edEstesa;
  const gen = kind==='breve'?CMP.genBreve:CMP.genEstesa;
  const txt=(ed!=null&&ed.trim()!=='' ? ed : gen).trim();
  if(!txt) return;
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(()=>{});
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓ copiata';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1400); }
}

function cmpCurrentDescrizione(){
  const breve=((CMP.edBreve!=null&&CMP.edBreve.trim()!=='')?CMP.edBreve:CMP.genBreve||'').trim();
  const estesa=((CMP.edEstesa!=null&&CMP.edEstesa.trim()!=='')?CMP.edEstesa:CMP.genEstesa||'').trim();
  return { breve, estesa };
}

function cmpDatasheetPick(){ const inp=document.getElementById('cmp-ds-input'); if(inp){ inp.value=''; inp.click(); } }

function cmpDraftHasContent(d){
  return !!(d && (d.fam || d.custom || d.misura || d.materiale || d.posa ||
    (d.opzioni&&d.opzioni.length) || (d.edBreve&&d.edBreve.trim()) || (d.edEstesa&&d.edEstesa.trim())));
}

function cmpDraftPayload(){
  return { fam:CMP.fam, custom:CMP.custom, misura:CMP.misura, materiale:CMP.materiale,
    posa:CMP.posa, opzioni:CMP.opzioni, edBreve:CMP.edBreve, edEstesa:CMP.edEstesa };
}

function cmpDsInfoToggle(){
  const box=document.getElementById('cmp-ds-info'); if(!box) return;
  if(!box.hidden){ box.hidden=true; return; }
  const marchi=window.MARCHI||[], label=window.SETTORE_LABEL||{};
  const gruppi=new Map(); // settore primario → nomi
  for(const m of marchi){ const s=m.settori[0]; if(!gruppi.has(s)) gruppi.set(s,[]); gruppi.get(s).push(m.nome); }
  const righe=[...gruppi.entries()].map(([s,nomi])=>
    `<div class="cmp-ds-info-row"><span class="cmp-ds-settore">${esc(label[s]||s)}</span> ${nomi.map(esc).join(' · ')}</div>`).join('');
  box.innerHTML=`<div class="cmp-ds-info-head">Riconoscimento ottimizzato per <b>${marchi.length} produttori</b> in ${gruppi.size} comparti (illuminazione, meccanica/frigo, elettrogeni, UPS, ACS, elettrico/EV, TVCC…) <button class="cmp-ds-info-close" onclick="document.getElementById('cmp-ds-info').hidden=true" title="Chiudi">✕</button></div>
    ${righe}
    <div class="cmp-ds-info-foot">Elenco in crescita. Le schede di altri produttori vengono comunque analizzate (famiglia + caratteristiche), senza il riconoscimento marca. I PDF scansionati (solo immagine) non sono leggibili.</div>`;
  box.hidden=false;
}

function cmpEditAnalisiFromCart(key){
  const it=S.custom.get(key);
  if(!it || !it.analisiPrezzi){ toast('Questa voce non ha un\'Analisi Prezzi da modificare','warn'); return; }
  openComponiAnalisi();
  CMP.analisi=JSON.parse(JSON.stringify(it.analisiPrezzi));
  CMP.editingCartKey=key;
  // stessa sorgente unica della descrizione: precompila l'editor ✎
  CMP.edBreve=it.desc_short||''; CMP.edEstesa=it.declaratoria||it.desc_short||'';
  cmpAPRender();
}

function cmpEditFromCart(key){
  const it=S.custom.get(key);
  if(!it){ toast('Qui si modificano le voci composte (✎). Le voci di prezzario restano come da listino.','warn'); return; }
  if(it.analisiPrezzi){ cmpEditAnalisiFromCart(key); return; } // ha un'A.P. → torna all'Analisi Prezzi
  openComponi(); // apre pulito in modalità Descrizione (+ setStep 'componi')
  CMP.editingCartKey=key;
  CMP.fam = it.famigliaId || null;
  CMP.custom = it.famigliaId ? null : (it.famNome||'');
  CMP.edBreve = it.desc_short||'';
  CMP.edEstesa = it.declaratoria||it.desc_short||'';
  cmpSetMode('desc');
  renderComponi();
}

function cmpEditorCopy(kind, btn){
  const txt=((kind==='breve'?CMP.edBreve:CMP.edEstesa)||'').trim();
  if(!txt) return;
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(()=>{});
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓ copiata';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1400); }
}

function cmpEditorInput(kind, value){
  CMP[kind==='breve'?'edBreve':'edEstesa']=value;
  const el=document.getElementById(kind==='breve'?'cmp-ed-breve':'cmp-ed-estesa');
  if(el){
    el.classList.remove('cmp-ed-auto','typing-live'); // ora è testo dell'utente
    // ferma un'eventuale battitura in corso: non deve sovrascrivere ciò che digita
    if(CMP_TYPE_TIMERS[el.id]){ clearInterval(CMP_TYPE_TIMERS[el.id]); delete CMP_TYPE_TIMERS[el.id]; }
    el.dataset.prev=value;
  }
  cmpPersistDraft();
}

function cmpEditorPull(kind){
  if(kind==='breve') CMP.edBreve=null; else CMP.edEstesa=null;
  renderComponi();
}

function cmpFacileSet(){ return new Set((window.FRASARIO||[]).filter(f=>f.facilePrezzario).map(f=>f.famigliaId)); }

function cmpFamSearch(q){ CMP.famQ = q||''; renderComponi(); }

function cmpFlashBtn(btn, label){
  if(!btn) return;
  const old=btn.textContent; btn.classList.add('copied'); btn.textContent=label;
  setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1400);
}

function cmpFrasario(){ return (window.FRASARIO||[]).find(f=>f.famigliaId===CMP.fam) || null; }

function cmpFreeMisura(v){ CMP.misura = (v||'').trim() || null; renderComponi(); }

function cmpKey(e){ if(e.key==='Escape'){ e.stopPropagation(); closeComponi(); } }

function cmpLibAdd(id, btn){
  const v=cmpVocById(id); if(!v) return;
  const key=nextCustomKey();
  if(v.analisiPrezzi){
    const t=window.calcolaAnalisi(v.analisiPrezzi);
    S.custom.set(key, {
      desc_short:v.analisiPrezzi.descrizioneBreve, declaratoria:v.analisiPrezzi.descrizioneEstesa||v.analisiPrezzi.descrizioneBreve,
      um:v.analisiPrezzi.um||'cad', prezzo:t.prezzoUnitario, famigliaId:v.analisiPrezzi.famigliaId||null, famNome:v.nome||'',
      source:'analisi-prezzi', analisiPrezzi: JSON.parse(JSON.stringify(v.analisiPrezzi)),
    });
  } else {
    const t=cmpVocText(v);
    S.custom.set(key, { desc_short:t.breve, declaratoria:t.estesa||t.breve, um:v.um||'cad', prezzo:null, famigliaId:v.famigliaId||null, famNome:v.nome||'' });
  }
  updateCartInfo();
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1200); }
}

function cmpLibDelete(id, group){
  setMiuLibreria(MIU_LIBRERIA.filter(v=>v.id!==id)); persistLibreria(); renderLibreria();
}

function cmpLibEdit(id, group){
  const v=MIU_LIBRERIA.find(x=>x.id===id); if(!v) return;
  cmpLoadVocePronta(id);
  CMP.editingLibId = id;
  CMP.editingLibGroup = group || 'mine';
}

function cmpLibGroupHTML(group, label, items, emptyMsg){
  const open=cmpLibGroupOpen(group);
  const body = items.length
    ? `<div class="cmp-lib-group-list">${items.map(v=>cmpLibItemHTML(v, group)).join('')}</div>`
    : `<div class="cmp-empty">${emptyMsg}</div>`;
  return `<div class="cmp-lib-group${open?'':' collapsed'}">
    <div class="cmp-lib-group-hd" onclick="cmpToggleLibGroup('${group}')" title="Mostra/nascondi">
      <span class="cmp-lib-group-arrow">▾</span>
      <span class="cmp-lib-group-name">${esc(label)} <span class="soft">(${items.length})</span></span>
    </div>
    <div class="cmp-lib-group-body">${body}</div>
  </div>`;
}

function cmpLibGroupOpen(group){
  try{ const v=localStorage.getItem('miu:cmp-lib-group-'+group); return v===null ? true : v==='1'; }catch(e){ return true; }
}

function cmpLibItemHTML(v,group){
  const t=cmpVocText(v);
  const ap = v.analisiPrezzi ? `<span class="cmp-lib-badge ap">Σ analisi</span>` : '';
  // «Modifica»/«Elimina» solo sulle voci PROPRIE: le curate (VOCI_PRONTE) sono un
  // seed condiviso dell'app, non si sovrascrivono — restano solo caricabili come
  // punto di partenza.
  const editable = group==='mine';
  const edit = editable ? `<button class="cmp-lib-edit" title="Modifica questa voce" onclick="event.stopPropagation();cmpLibEdit('${esc(v.id)}','${group}')">✎</button>` : '';
  const del = editable ? `<button class="cmp-lib-x" title="Elimina dalla libreria" onclick="event.stopPropagation();cmpLibDelete('${esc(v.id)}','${group}')">✕</button>` : '';
  return `<div class="cmp-lib-item" onclick="cmpLoadVocePronta('${esc(v.id)}')" title="${esc(t.breve)}">
      <div class="cmp-lib-head">
        <div class="cmp-lib-main"><div class="cmp-lib-name" title="${esc(v.nome||t.breve)}">${esc(v.nome||t.breve)}</div><div class="cmp-lib-sub" title="${esc(t.breve)}">${esc(t.breve)}</div></div>
        ${ap}
      </div>
      <div class="cmp-lib-actions">
        <button class="cmp-lib-add" title="Aggiungi al computo" onclick="event.stopPropagation();cmpLibAdd('${esc(v.id)}',this)">＋</button>
        ${edit}
        ${del}
      </div>
    </div>`;
}

function cmpLibItems(){
  const q=(CMP.famQ||'').toLowerCase();
  const facili=cmpFacileSet();
  const all=[
    ...MIU_LIBRERIA.map(v=>({v,group:'mine'})),
    ...(window.VOCI_PRONTE||[]).map(v=>({v,group:'curate'})),
  ].filter(({v})=>!(v.famigliaId && facili.has(v.famigliaId)));
  if(!q) return all;
  return all.filter(({v})=>(v.nome||'').toLowerCase().includes(q) || (v.famigliaId||'').includes(q));
}

function cmpLoadDraft(){ try{ const d=JSON.parse(localStorage.getItem('miu:cmp-draft')||'null'); return cmpDraftHasContent(d)?d:null; }catch(e){ return null; } }

function cmpLoadVocePronta(id){
  const v=cmpVocById(id); if(!v) return;
  CMP.editingLibId = null;
  if(v.analisiPrezzi){
    CMP.analisi = JSON.parse(JSON.stringify(v.analisiPrezzi));
    // la descrizione è UNICA (cmpCurrentDescrizione): la riporto nell'editor
    // Descrizione così resta coerente anche passando da una scheda all'altra.
    CMP.fam = v.analisiPrezzi.famigliaId || null;
    CMP.edBreve = v.analisiPrezzi.descrizioneBreve || null;
    CMP.edEstesa = v.analisiPrezzi.descrizioneEstesa || v.analisiPrezzi.descrizioneBreve || null;
    CMP.genBreve = ''; CMP.genEstesa = '';
    cmpSetMode('analisi');
    return;
  }
  const t=cmpVocText(v);
  CMP.fam = v.famigliaId || null;
  CMP.custom = v.famigliaId ? null : (v.nome||'');
  CMP.misura = v.misura || null;
  CMP.materiale = v.materiale || null;
  CMP.posa = v.posa || null;
  CMP.opzioni = Array.isArray(v.opzioni) ? v.opzioni.slice() : [];
  CMP.edBreve = t.breve; CMP.edEstesa = t.estesa;
  cmpSetMode('desc');
  renderComponi();
}

function cmpMacroFilter(m){ CMP.macroFilter = (CMP.macroFilter===m)?null:m; renderComponi(); }

function cmpMacroShort(m){ return ({'IMPIANTI ELETTRICI':'Elettrici','ILLUMINAZIONE':'Illuminazione','IMPIANTI SPECIALI':'Speciali','IMPIANTI MECCANICI':'Meccanici','IMPIANTI ANTINCENDIO':'Antincendio'})[m]||m; }

function cmpMetelLookup(codice){
  if(!codice || !S.allRows || !S.allRows.length) return null;
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const key=norm(codice); if(key.length<3) return null;
  for(const r of S.allRows){
    // codice METEL = «MARCA.articolo» (es. 3FF.5066): confronto sia il codice intero
    // sia il solo articolo (la scheda riporta l'articolo senza prefisso marca).
    const parts=String(r.codice||'').split('.');
    const art=norm(parts.length>1?parts.slice(1).join('.'):parts[0]);
    if(norm(r.codice)===key || art===key){
      return { desc:(r.desc_short||r.declaratoria||'').trim(), prezzo:(r.prezzo!=null&&!isNaN(r.prezzo))?Number(r.prezzo):null,
        marca:(r.regione && !/^metel$/i.test(r.regione))?r.regione:null };
    }
  }
  return null;
}

function cmpNewVoce(){ cmpResetVoce(); }

function cmpPersistDraft(){
  const d=cmpDraftPayload();
  try{ if(cmpDraftHasContent(d)) localStorage.setItem('miu:cmp-draft', JSON.stringify(d)); else localStorage.removeItem('miu:cmp-draft'); }catch(e){}
}

function cmpPickFam(id){
  if(CMP.fam===id && !CMP.custom) return;
  CMP.fam=id; CMP.custom=null; CMP.misura=null; CMP.materiale=null; CMP.posa=null; CMP.opzioni=[];
  CMP.edBreve=null; CMP.edEstesa=null; CMP.showPicker=false;
  renderComponi();
}

function cmpPrezzarioMisure(fr){
  if(!fr || !window.searchRows || !S.allRows || !S.allRows.length) return [];
  const pool = window.searchRows(S.allRows, fr.nome).slice(0,40);
  const re = /(⌀\s*\d+(?:[.,]\d+)?\s*mm|DN\s*\d+|\d+\s*[x×]\s*\d+(?:\s*mm)?|\d+(?:[.,]\d+)?\s*(?:mm|cm|kg|kW|W|bar))/gi;
  const existing = new Set((fr.misura&&fr.misura.valori||[]).map(v=>v.toLowerCase()));
  const seen=new Set(); const out=[];
  for(const r of pool){
    const txt=r.desc_short||''; let m;
    re.lastIndex=0;
    while((m=re.exec(txt))){
      const v=m[0].trim(), key=v.toLowerCase();
      if(!existing.has(key) && !seen.has(key)){ seen.add(key); out.push(v); }
      if(out.length>=10) break;
    }
    if(out.length>=10) break;
  }
  return out;
}

function cmpPropText(p){
  // voce DA SCHEDA: usa i valori REALI già composti (non da riscrivere)
  if(p && p.descEstesa){ return { breve: p.descBreve||p.descEstesa, estesa: p.descEstesa }; }
  try{ if(window.componiDescrizione && p.famigliaId) return window.componiDescrizione({ famigliaId:p.famigliaId, misura:p.misura||undefined, materiale:p.materiale||undefined, posa:p.posa||undefined, opzioni:(p.opzioni||[]) }); }catch(e){}
  return { breve:p.famNome||'', estesa:p.famNome||'' };
}

function cmpResetVoce(){
  setCMP({ fam:null, custom:null, misura:null, materiale:null, posa:null, opzioni:[], famQ:CMP.famQ||'', edBreve:null, edEstesa:null, genBreve:'', genEstesa:'', acc:{...CMP_ACC_DEFAULT}, mode:CMP.mode, analisi:null, editingLibId:null });
  cmpClearDraft();
  // ricerche in corso nelle sezioni dell'analisi e nella voce di riferimento ⚗
  setApSearchQ({ manodopera:'', materiale:'', nolo:'', varie:'' });
  setApRefQ('');
  const ref=document.getElementById('cmp-ap-search-ref'); if(ref) ref.value='';
  const inp=document.getElementById('cmp-fam-search'); if(inp) inp.value=CMP.famQ||'';
  renderComponi();
  cmpAPRender();
}

function cmpSaveToLibreria(btn){
  const editingMine = CMP.editingLibGroup==='mine' && CMP.editingLibId;
  const voce=cmpVoceObjectFromCMP(editingMine ? CMP.editingLibId : ('lib'+Date.now()));
  if(!voce){ toast('Niente da salvare: componi prima una voce','warn'); return; }
  if(editingMine){
    const i=MIU_LIBRERIA.findIndex(v=>v.id===CMP.editingLibId);
    if(i>=0) MIU_LIBRERIA[i]=voce; else MIU_LIBRERIA.unshift(voce);
  } else {
    MIU_LIBRERIA.unshift(voce);
  }
  CMP.editingLibId = voce.id; CMP.editingLibGroup = 'mine';
  persistLibreria(); renderLibreria();
  cmpFlashBtn(btn, '✓ salvata');
}

function cmpSet(group, value){
  if(group==='opzioni'){
    const i=CMP.opzioni.indexOf(value);
    if(i>=0) CMP.opzioni.splice(i,1); else CMP.opzioni.push(value);
  }else{
    CMP[group] = (CMP[group]===value) ? null : value;
  }
  renderComponi();
}

function cmpSetMode(mode){
  CMP.mode = mode;
  document.getElementById('cmp-mode-desc')?.classList.toggle('active', mode==='desc');
  document.getElementById('cmp-mode-ap')?.classList.toggle('active', mode==='analisi');
  document.getElementById('cmp-body')?.classList.toggle('mode-analisi', mode==='analisi');
  document.getElementById('cmp-ft-desc')?.toggleAttribute('hidden', mode!=='desc');
  document.getElementById('cmp-ft-ap')?.toggleAttribute('hidden', mode!=='analisi');
  const tag=document.getElementById('cmp-step-tag');
  if(tag) tag.textContent = mode==='analisi' ? 'analisi prezzi' : (CMP.custom ? 'famiglia personalizzata' : 'voce di computo');
  if(mode==='analisi'){ cmpAPAutoSuggestMateriale(); cmpAPAutoSuggestManodopera(); cmpAPRender(); }
}

function cmpShowPicker(){ CMP.showPicker=true; if(cmpFrasario()) CMP.macroFilter=(cmpFrasario().macro||[])[0]||CMP.macroFilter; renderComponi(); }

function cmpToggleAcc(key){ CMP.acc[key]=!CMP.acc[key]; renderComponi(); }

function cmpToggleLib(){
  const b=document.getElementById('cmp-body'); if(!b) return;
  const collapsed=b.classList.toggle('lib-collapsed');
  try{ localStorage.setItem('miu:cmp-lib-open', collapsed?'0':'1'); }catch(e){}
  if(!collapsed) renderLibreria();
}

function cmpToggleLibGroup(group){
  const open=!cmpLibGroupOpen(group);
  try{ localStorage.setItem('miu:cmp-lib-group-'+group, open?'1':'0'); }catch(e){}
  renderLibreria();
}

function cmpTypeValue(el, text){
  const prev=el.dataset.prev||'';
  if(text===prev) return;
  let i=0; const max=Math.min(prev.length,text.length);
  while(i<max && prev[i]===text[i]) i++;
  el.dataset.prev=text;
  if(CMP_TYPE_TIMERS[el.id]){ clearInterval(CMP_TYPE_TIMERS[el.id]); delete CMP_TYPE_TIMERS[el.id]; }
  const tail=text.slice(i);
  if(!text || !tail){ el.value=text; el.classList.remove('typing-live'); return; }
  el.classList.add('typing-live');
  const stepMs=Math.max(4, Math.min(12, 400/tail.length));
  let pos=0;
  CMP_TYPE_TIMERS[el.id]=setInterval(()=>{
    pos+=1;
    el.value=text.slice(0, i+pos);
    if(pos>=tail.length){ clearInterval(CMP_TYPE_TIMERS[el.id]); delete CMP_TYPE_TIMERS[el.id]; el.classList.remove('typing-live'); }
  }, stepMs);
}

function cmpVocById(id){
  return MIU_LIBRERIA.find(v=>v.id===id) || (window.VOCI_PRONTE||[]).find(v=>v.id===id) || null;
}

function cmpVocText(v){ return window.voceProntaText ? window.voceProntaText(v) : {breve:v.nome||'', estesa:v.nome||''}; }

function cmpVoceObjectFromCMP(id){
  const breve=((CMP.edBreve!=null&&CMP.edBreve.trim()!=='')?CMP.edBreve:CMP.genBreve||'').trim();
  const estesa=((CMP.edEstesa!=null&&CMP.edEstesa.trim()!=='')?CMP.edEstesa:CMP.genEstesa||'').trim();
  if(!breve && !estesa) return null;
  const fr=cmpFrasario();
  return {
    id,
    nome: breve.length>64 ? breve.slice(0,61)+'…' : breve,
    famigliaId: CMP.fam||undefined,
    misura: CMP.misura||undefined, materiale: CMP.materiale||undefined, posa: CMP.posa||undefined,
    opzioni: (CMP.opzioni&&CMP.opzioni.length)?CMP.opzioni.slice():undefined,
    um: fr ? ((fr.umTipiche&&fr.umTipiche[0])||'cad') : 'cad',
    macro: fr ? (fr.macro||[]) : undefined,
    breve, estesa: estesa||breve,
  };
}

export {
  cmpAcc, cmpAddCustom, cmpAddToCart, cmpApplyLibState, cmpCandAdd, cmpCandLoad, cmpCandSave, cmpClearDraft,
  cmpConfLabel, cmpCopy, cmpCurrentDescrizione, cmpDatasheetPick, cmpDraftHasContent, cmpDraftPayload, cmpDsInfoToggle, cmpEditAnalisiFromCart,
  cmpEditFromCart, cmpEditorCopy, cmpEditorInput, cmpEditorPull, cmpFacileSet, cmpFamSearch, cmpFlashBtn, cmpFrasario,
  cmpFreeMisura, cmpKey, cmpLibAdd, cmpLibDelete, cmpLibEdit, cmpLibGroupHTML, cmpLibGroupOpen, cmpLibItemHTML,
  cmpLibItems, cmpLoadDraft, cmpLoadVocePronta, cmpMacroFilter, cmpMacroShort, cmpMetelLookup, cmpNewVoce, cmpPersistDraft,
  cmpPickFam, cmpPrezzarioMisure, cmpPropText, cmpResetVoce, cmpSaveToLibreria, cmpSet, cmpSetMode, cmpShowPicker,
  cmpToggleAcc, cmpToggleLib, cmpToggleLibGroup, cmpTypeValue, cmpVocById, cmpVocText, cmpVoceObjectFromCMP
}
