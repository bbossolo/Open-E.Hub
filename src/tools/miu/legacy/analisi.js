// μ (Prezzi) legacy — modulo analisi.js (STEP 2 split). Import circolari
// verso index.js: sicuri, i nomi si usano solo nei corpi funzione (live-binding ESM).
import { AP_JUST_ADDED, AP_REF_Q, AP_SEARCH_Q, AP_TIPO_LETTERA, CMP, MIU_LIBRERIA, S, setApJustAdded, setApRefQ } from './stato.js'
import {
  AP_MAT_SUGGESTED, AP_MO_SUGGESTED, AP_TIPI, AP_TIPO_LABEL, apBuildSheet, apMoLabel, cmpCurrentDescrizione, cmpEditAnalisiFromCart,
  cmpFlashBtn, cmpResetVoce, cmpSetMode, esc, nextCustomKey, persistLibreria, refreshCartOverlayIfOpen, render,
  renderLibreria, setStep, toast, updateCartInfo
} from './index.js'

function cmpAPAddRigaCustom(tipo){
  const a=cmpAPEnsure();
  const descInp=document.getElementById('cmp-ap-custom-desc-'+tipo);
  const umInp=document.getElementById('cmp-ap-custom-um-'+tipo);
  const prezzoInp=document.getElementById('cmp-ap-custom-prezzo-'+tipo);
  const descrizione=(descInp&&descInp.value||'').trim();
  const um=(umInp&&umInp.value||'').trim()||'cad';
  const prezzoUnitario=parseFloat(prezzoInp&&prezzoInp.value)||0;
  if(!descrizione) return;
  a.righe.push({ tipo, descrizione, um, quantita:1, prezzoUnitario });
  setApJustAdded(a.righe.length-1);
  cmpAPRender();
  // Invio o + non deve interrompere l'inserimento di più voci custom in sequenza
  const nuovoDescInp=document.getElementById('cmp-ap-custom-desc-'+tipo);
  if(nuovoDescInp) nuovoDescInp.focus();
}

function cmpAPAddToCart(btn){
  const a=cmpAPSnapshot();
  if(!a.descrizioneBreve){ toast('Componi prima la descrizione (scheda ✎ Descrizione)','warn'); return; }
  if(!a.righe.length){ toast('Aggiungi almeno una riga (manodopera/materiale/noli/varie)','warn'); return; }
  const t=window.calcolaAnalisi(a);
  const editing=CMP.editingCartKey && S.custom.has(CMP.editingCartKey);
  const key=editing ? CMP.editingCartKey : nextCustomKey();
  const prevFamNome=editing ? (S.custom.get(key).famNome||'') : '';
  S.custom.set(key, {
    desc_short:a.descrizioneBreve, declaratoria:a.descrizioneEstesa||a.descrizioneBreve, um:a.um||'cad',
    prezzo:t.prezzoUnitario, famigliaId:a.famigliaId||null, famNome:prevFamNome,
    source:'analisi-prezzi', analisiPrezzi: JSON.parse(JSON.stringify(a)),
  });
  CMP.editingCartKey=null;
  updateCartInfo();
  if(editing){ setStep('misura'); toast('Analisi Prezzi aggiornata nel computo','ok'); return; } // torna al computo
  refreshCartOverlayIfOpen();
  if(btn){ const old=btn.textContent; btn.classList.add('copied'); btn.textContent='✓ aggiunta';
    setTimeout(()=>{ btn.classList.remove('copied'); btn.textContent=old; },1400); }
}

function cmpAPAutoSuggestManodopera(){
  const a=cmpAPEnsure();
  if(AP_MO_SUGGESTED.has(a.id)) return;
  if(a.righe.some(r=>r.tipo==='manodopera')) return;
  if(!window.suggestManodoperaPerMacro || !S.allRows || !S.allRows.length) return;
  const suggeriti=window.suggestManodoperaPerMacro(S.allRows, cmpAPCurrentMacro());
  if(suggeriti.length) AP_MO_SUGGESTED.add(a.id);
  for(const r of suggeriti){
    a.righe.push({ tipo:'manodopera', descrizione:r.desc_short||r.codice, um:r.um||'h', quantita:0, prezzoUnitario:r.prezzo||0,
      fonte:{ codice:r.codice, regione:r.regione||'', anno:r.anno||'' } });
  }
}

function cmpAPAutoSuggestMateriale(){
  const a=cmpAPEnsure();
  if(AP_MAT_SUGGESTED.has(a.id)) return;
  if(a.righe.some(r=>r.tipo==='materiale')) return;
  const d=cmpCurrentDescrizione();
  if(!d.breve) return;
  AP_MAT_SUGGESTED.add(a.id);
  a.righe.push({ tipo:'materiale', descrizione:d.breve, um:a.um||'cad', quantita:1, prezzoUnitario:0 });
}

function cmpAPByCodice(){
  if(!window.indicePerCodice) return undefined;
  if(S._byCodiceOf!==S.allRows){ S._byCodice=window.indicePerCodice(S.allRows||[]); S._byCodiceOf=S.allRows; }
  return S._byCodice;
}

function cmpAPCurrentMacro(){
  // FrasarioFamiglia porta già il proprio campo `macro` (curato a mano nel
  // thesaurus) — macrocategorieFor() è per le RIGHE di prezzario (disciplina/
  // sistema/settore), non si applica qui: usarlo su una famiglia dava sempre
  // macro vuoto e faceva ripiegare sempre sul generico anche per l'elettrico.
  const fr=(window.FRASARIO||[]).find(f=>f.famigliaId===CMP.fam);
  return (fr && fr.macro && fr.macro[0]) || undefined;
}

function cmpAPCustomRowBlur(tipo){
  setTimeout(()=>{
    const row=document.getElementById('cmp-ap-custom-desc-'+tipo)?.closest('.cmp-ap-custom-row');
    if(row && !row.contains(document.activeElement)) cmpAPAddRigaCustom(tipo);
  },0);
}

function cmpAPDefault(){
  return {
    id:'ap'+Date.now(), codice:'', descrizioneBreve:'', um:'cad', righe:[],
    speseGeneraliPct: window.DEFAULT_SPESE_GENERALI_PCT!=null ? window.DEFAULT_SPESE_GENERALI_PCT : 15,
    utileImpresaPct: window.DEFAULT_UTILE_IMPRESA_PCT!=null ? window.DEFAULT_UTILE_IMPRESA_PCT : 10,
  };
}

function cmpAPDescDiretta(v){ CMP.edBreve=v; CMP.edEstesa=v; cmpSaveDraft&&cmpSaveDraft(); }

function cmpAPDuplicaRiga(idx){
  const a=cmpAPEnsure(); const r=a.righe[idx]; if(!r) return;
  const clone={ ...r, fonte: r.fonte ? { ...r.fonte } : undefined };
  a.righe.splice(idx+1, 0, clone);
  setApJustAdded(idx+1);
  cmpAPRender();
}

function cmpAPEnsure(){ if(!CMP.analisi) CMP.analisi = cmpAPDefault(); return CMP.analisi; }

function cmpAPExportExcel(){
  const a=cmpAPSnapshot();
  if(!a.descrizioneBreve){ toast('Componi prima la descrizione (scheda ✎ Descrizione)','warn'); return; }
  if(!window.analisiPrezziAOA || typeof XLSX==='undefined'){ toast('Modulo Excel non pronto, riprova tra un attimo','warn'); return; }
  const aoa=window.analisiPrezziAOA(a);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, apBuildSheet(aoa, [4,5], [3]), 'Analisi Prezzi');
  XLSX.writeFile(wb, window.analisiPrezziFileName(a));
}

function cmpAPExportPdf(){
  const a=cmpAPSnapshot();
  if(!a.descrizioneBreve){ toast('Componi prima la descrizione (scheda ✎ Descrizione)','warn'); return; }
  if(typeof window.miuAnalisiPrezziReport!=='function'){ toast('Modulo report non pronto, riprova tra un attimo','warn'); return; }
  const html=window.miuAnalisiPrezziReport(a);
  const w=window.open('', '_blank');
  if(!w){ toast('Finestra bloccata: consenti i popup per aprire il report','warn'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function cmpAPImportScomposizione(r){
  if(!(r&&r.risorse&&r.risorse.length) || !window.scomposizioneToRighe){
    toast('Questa voce non porta una scomposizione ufficiale nel prezzario','warn');
    return false;
  }
  const a=cmpAPEnsure();
  if(a.righe.length && !confirm('Sostituire le righe attuali dell\'analisi con la scomposizione ufficiale della voce di riferimento?')) return false;
  a.righe = window.scomposizioneToRighe(r, cmpAPByCodice());
  if(!a.um) a.um = r.um||'';
  // per coerenza il codice è quello del prezzario di riferimento (non un AP01 di fantasia)
  if(!a.codice) a.codice = r.codice||'';
  // descrizione: se non ne hai già composta una, arriva dalla voce di riferimento
  const d=cmpCurrentDescrizione();
  if(!d.breve){ CMP.edBreve=r.desc_short||''; CMP.edEstesa=r.declaratoria||r.desc_short||''; }
  // la scomposizione reale è la base: l'euristica non deve rientrarci sopra
  AP_MO_SUGGESTED.add(a.id); AP_MAT_SUGGESTED.add(a.id);
  cmpAPRender();
  // confronto informativo col prezzo di listino: SG/UI regionali possono differire
  // dai default 15/10 — nessuna forzatura, solo trasparenza
  if(window.calcolaAnalisi){
    const t=window.calcolaAnalisi(a);
    toast(`Scomposizione importata (${a.righe.length} componenti) — analisi € ${t.prezzoUnitario.toFixed(2)} · listino € ${(r.prezzo||0).toFixed(2)}`);
  }
  return true;
}

function cmpAPMoMenuToggle(idx, btn){
  document.querySelectorAll('.cmp-ap-mo-menu').forEach(m=>m.remove());
  if(btn._open){ btn._open=false; return; }
  document.querySelectorAll('.cmp-ap-row-swap').forEach(b=>b._open=false);
  const pool=(S.allRows&&window.isManodoperaRow)?S.allRows.filter(window.isManodoperaRow).slice(0,30):[];
  if(!pool.length){ toast('Apri un prezzario per scegliere le tariffe manodopera','warn'); return; }
  const menu=document.createElement('div');
  menu.className='cmp-ap-search-results cmp-ap-mo-menu';
  menu.style.display='block';
  menu.innerHTML=pool.map((r,i)=>{
    const lbl=apMoLabel(r.desc_short||'');
    return `<div class="cmp-ap-search-item" onclick="cmpAPMoReplace(${idx},${i})">
      <span class="prz">€ ${(r.prezzo||0).toFixed(2)}</span>
      <b>${esc(lbl||r.desc_short||r.codice)}</b><br>
      <span class="um">${esc(lbl?(r.desc_short||''):r.codice)}${lbl?' · ':''}${esc(r.codice)} · ${esc(r.um||'h')} · ${esc(r.regione||'')} ${esc(r.anno||'')}</span>
    </div>`;
  }).join('');
  menu._rows=pool;
  const row=btn.closest('.cmp-ap-row');
  row.style.position='relative';
  menu.style.top='100%'; menu.style.right='0'; menu.style.left='auto';
  row.appendChild(menu);
  btn._open=true;
}

function cmpAPMoReplace(idx, i){
  const menu=document.querySelector('.cmp-ap-mo-menu'); const r=menu&&menu._rows&&menu._rows[i]; if(!r) return;
  const a=cmpAPEnsure(); const riga=a.righe[idx]; if(!riga) return;
  riga.descrizione=r.desc_short||r.codice; riga.um=r.um||'h'; riga.prezzoUnitario=r.prezzo||0;
  riga.fonte={ codice:r.codice, regione:r.regione||'', anno:r.anno||'' };
  cmpAPRender();
}

function cmpAPNewVoce(){ cmpResetVoce(); }

function cmpAPRefPick(i){
  const wrap=document.getElementById('cmp-ap-search-res-ref');
  const rows=(wrap&&wrap._rows) || cmpAPRefResults();
  const r=rows[i]; if(!r) return;
  if(cmpAPImportScomposizione(r)){
    setApRefQ(''); const inp=document.getElementById('cmp-ap-search-ref'); if(inp) inp.value='';
    if(wrap){ wrap.innerHTML=''; wrap.style.display='none'; }
  }
}

function cmpAPRefResults(){
  const q=AP_REF_Q.trim();
  if(!q || !S.allRows || !S.allRows.length || !window.searchRows) return [];
  // SOLO voci con scomposizione ufficiale: qui si sceglie la base dell'analisi,
  // una voce senza componenti non è importabile (rilievo utente)
  const pool=S.allRows.filter(r=>r.risorse&&r.risorse.length);
  if(!pool.length) return [];
  return window.searchRows(pool, q).slice(0,20);
}

function cmpAPRefSearchInput(q){ setApRefQ(q||''); cmpAPRenderRefResults(); }

function cmpAPRemoveRiga(idx){
  const a=cmpAPEnsure();
  a.righe.splice(idx,1);
  cmpAPRender();
}

function cmpAPRender(){
  const a=cmpAPEnsure();
  const codI=document.getElementById('cmp-ap-codice'); if(codI && document.activeElement!==codI) codI.value=a.codice||'';
  const umI=document.getElementById('cmp-ap-um'); if(umI && document.activeElement!==umI) umI.value=a.um||'';
  const descWrap=document.getElementById('cmp-ap-desc-shared');
  if(descWrap){
    // DOPPIO INPUT (rilievo utente): la descrizione resta UNICA (stessa sorgente
    // dell'editor ✎), ma qui è editabile direttamente — e si precompila
    // dall'import della voce di riferimento ⚗. Sempre la ESTESA (la breve qui
    // verrebbe tagliata/incompleta).
    const d=cmpCurrentDescrizione();
    const ta=document.getElementById('cmp-ap-desc-input');
    if(ta && document.activeElement===ta){ /* non ricreare la textarea sotto le dita */ }
    else {
      descWrap.innerHTML = `<div class="cmp-ap-desc-label">Descrizione <button class="cmp-tbtn" onclick="cmpSetMode('desc')" title="Componi o rifinisci la descrizione col compositore (frasario, scheda tecnica PDF…)">✎ componi</button></div>
        <textarea class="cmp-ap-desc-input" id="cmp-ap-desc-input" rows="3" placeholder="Scrivi la descrizione della voce qui, importala con la voce di riferimento ⚗, oppure componila con ✎…" oninput="cmpAPDescDiretta(this.value)"></textarea>`;
      const nuovo=document.getElementById('cmp-ap-desc-input');
      if(nuovo) nuovo.value = d.estesa||d.breve||'';
    }
  }
  const sec=document.getElementById('cmp-ap-sections');
  if(sec) sec.innerHTML = AP_TIPI.map(cmpAPSezioneHTML).join('');
  setApJustAdded(null); // consumato: non deve riapparire ai prossimi render non correlati
  for(const tipo of AP_TIPI) cmpAPRenderSearchResults(tipo);
  cmpAPRenderSectionTotals();
  cmpAPRenderTotals();
  // editor a posteriori (cmpEditAnalisiFromCart): il bottone dice esplicitamente
  // che sta AGGIORNANDO la voce nel computo, non aggiungendone una nuova.
  const addBtn=document.getElementById('cmp-ap-addcart-btn');
  if(addBtn){
    const editing=!!(CMP.editingCartKey && S.custom.has(CMP.editingCartKey));
    addBtn.textContent = editing ? '✓ Aggiorna nel computo' : '+ Aggiungi al computo';
    addBtn.title = editing
      ? 'Aggiorna questa Analisi Prezzi nella voce già presente nel computo (non ne crea una nuova)'
      : 'Aggiunge l\'Analisi Prezzi al computo come voce a sé, col prezzo unitario calcolato';
  }
}

function cmpAPRenderRefResults(){
  const wrap=document.getElementById('cmp-ap-search-res-ref'); if(!wrap) return;
  const rows=cmpAPRefResults();
  if(!rows.length){ wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='block';
  wrap.innerHTML = rows.map((r,i)=>`<div class="cmp-ap-search-item" onclick="cmpAPRefPick(${i})">
    <span class="prz">€ ${(r.prezzo||0).toFixed(2)}</span>
    <b>${r.risorse&&r.risorse.length?'⚗ ':''}${esc(r.desc_short||r.codice)}</b><br>
    <span class="um">${esc(r.codice)} · ${esc(r.um||'')} · ${esc(r.regione||'')} ${esc(r.anno||'')}${r.risorse&&r.risorse.length?` · scomposizione ufficiale (${r.risorse.length} componenti)`:''}</span>
  </div>`).join('');
  wrap._rows = rows;
}

function cmpAPRenderSearchResults(tipo){
  const wrap=document.getElementById('cmp-ap-search-res-'+tipo); if(!wrap) return;
  const rows=cmpAPSearchResults(tipo);
  if(!rows.length){ wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='block';
  wrap.innerHTML = rows.map((r,i)=>{
    const lbl = tipo==='manodopera' ? apMoLabel(r.desc_short||'') : null;
    return `<div class="cmp-ap-search-item" onclick="cmpAPSearchPick('${tipo}',${i})">
    <span class="prz">€ ${(r.prezzo||0).toFixed(2)}</span>
    <b>${esc(lbl||r.desc_short||r.codice)}</b><br>
    <span class="um">${lbl?esc(r.desc_short||'')+' · ':''}${esc(r.codice)} · ${esc(r.um||'')} · ${esc(r.regione||'')} ${esc(r.anno||'')}</span>
  </div>`;}).join('');
  wrap._rows = rows; // cache per il pick (evita di ri-cercare con lo stesso indice)
}

function cmpAPRenderSectionTotals(){
  const a=cmpAPEnsure();
  if(!window.calcolaAnalisi) return;
  const t=window.calcolaAnalisi(a);
  const map={manodopera:t.totManodopera, materiale:t.totMateriali, nolo:t.totNoli, varie:t.totVarie};
  for(const tipo of AP_TIPI){
    const el=document.getElementById('cmp-ap-sec-tot-'+tipo);
    if(el) el.textContent = `Totale (${AP_TIPO_LETTERA[tipo]})  € `+(map[tipo]||0).toFixed(2);
  }
}

function cmpAPRenderTotals(){
  const a=cmpAPEnsure();
  const sg=document.getElementById('cmp-ap-sg'); if(sg && document.activeElement!==sg) sg.value=a.speseGeneraliPct;
  const ui=document.getElementById('cmp-ap-ui'); if(ui && document.activeElement!==ui) ui.value=a.utileImpresaPct;
  const wrap=document.getElementById('cmp-ap-totals'); if(!wrap || !window.calcolaAnalisi) return;
  const t=window.calcolaAnalisi(a);
  const lettere=AP_TIPI.filter(tp=>a.righe.some(r=>r.tipo===tp)).map(tp=>AP_TIPO_LETTERA[tp]);
  const somma=lettere.length?lettere.join('+'):'A+B+C+D';
  const incMO=t.prezzoUnitario>0?(t.totManodopera/t.prezzoUnitario*100):0;
  wrap.innerHTML = `<table class="dtable-like">
    <tr class="tot"><td>Totale costi elementari (${somma})</td><td>€ ${t.costoDiretto.toFixed(2)}</td></tr>
    <tr><td>Spese Generali (${a.speseGeneraliPct}%)</td><td>€ ${t.speseGenerali.toFixed(2)}</td></tr>
    <tr class="tot"><td>Totale</td><td>€ ${t.subtotale.toFixed(2)}</td></tr>
    <tr><td>Utile d'Impresa (${a.utileImpresaPct}%)</td><td>€ ${t.utileImpresa.toFixed(2)}</td></tr>
    <tr class="final"><td>Prezzo di applicazione (€/${esc(a.um||'cad')})</td><td>€ ${t.prezzoUnitario.toFixed(2)}</td></tr>
    <tr class="inc"><td>Incidenza manodopera</td><td>${incMO.toFixed(2).replace('.',',')}%</td></tr>
  </table>`;
}

function cmpAPSaveToLibreria(btn){
  const a=cmpAPSnapshot();
  if(!a.descrizioneBreve){ toast('Componi prima la descrizione (scheda ✎ Descrizione)','warn'); return; }
  const editingMine = CMP.editingLibGroup==='mine' && CMP.editingLibId;
  const voce = {
    id: editingMine ? CMP.editingLibId : ('lib'+Date.now()),
    nome: a.codice ? `${a.codice} — ${a.descrizioneBreve}` : a.descrizioneBreve,
    um: a.um||'cad', breve:a.descrizioneBreve, estesa:a.descrizioneEstesa||a.descrizioneBreve,
    analisiPrezzi: JSON.parse(JSON.stringify(a)),
  };
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

function cmpAPSearchInput(tipo, q){
  AP_SEARCH_Q[tipo] = q||'';
  cmpAPRenderSearchResults(tipo);
}

function cmpAPSearchPick(tipo, i){
  const wrap=document.getElementById('cmp-ap-search-res-'+tipo);
  const rows=(wrap&&wrap._rows) || cmpAPSearchResults(tipo);
  const r=rows[i]; if(!r) return;
  const a=cmpAPEnsure();
  a.righe.push({
    tipo, descrizione:r.desc_short||r.codice, um:r.um||'cad', quantita:1, prezzoUnitario:r.prezzo||0,
    fonte:{ codice:r.codice, regione:r.regione||'', anno:r.anno||'' },
  });
  // NON richiude il dropdown né svuota la query (rilievo utente: pick multipli in
  // sequenza sulla stessa ricerca, es. più sezioni cavo, senza ridigitare ogni volta)
  setApJustAdded(a.righe.length-1);
  cmpAPRender();
}

function cmpAPSearchResults(tipo){
  const q=(AP_SEARCH_Q[tipo]||'').trim();
  if(!S.allRows || !S.allRows.length) return [];
  // «manodopera»: SOLO tariffe orarie CCNL (search.ts, isManodoperaRow) — mai
  // voci di opera compiuta (scavo, posa…), anche digitando una sola lettera.
  // Pool già piccolo/curato: si mostra anche a campo vuoto (focus), non solo
  // dopo aver digitato — prima la lista compariva solo a query non vuota.
  // il dropdown appare SOLO dopo una ricerca digitata (rilievo utente: il pool
  // a campo vuoto si riapriva da solo, anche al rientro nella finestra)
  if(!q) return [];
  if(tipo==='manodopera' && window.searchManodoperaRows){
    return window.searchManodoperaRows(S.allRows, q).slice(0,30);
  }
  // «noli»: SOLO capitolo noleggi (NOLO/NOLEGGIO in testa alla descrizione)
  if(tipo==='nolo' && window.searchNoloRows){
    return window.searchNoloRows(S.allRows, q).slice(0,30);
  }
  // «materiali»: costi elementari — esclusi «in opera», manodopera e noli.
  if(tipo==='materiale' && window.searchMaterialeRows){
    return window.searchMaterialeRows(S.allRows, q).slice(0,20);
  }
  if(!window.searchRows) return [];
  return window.searchRows(S.allRows, q).slice(0,20);
}

function cmpAPSetField(field, value){ cmpAPEnsure()[field] = value; }

function cmpAPSetPct(field, value){ cmpAPEnsure()[field] = parseFloat(value)||0; cmpAPRenderTotals(); }

function cmpAPSetRigaPrezzo(idx, value){
  const a=cmpAPEnsure(); const r=a.righe[idx]; if(!r) return;
  r.prezzoUnitario = parseFloat(value)||0;
  cmpAPUpdateRowImp(idx, r); cmpAPRenderSectionTotals(); cmpAPRenderTotals();
}

function cmpAPSetRigaQty(idx, value){
  const a=cmpAPEnsure(); const r=a.righe[idx]; if(!r) return;
  r.quantita = parseFloat(value)||0;
  cmpAPUpdateRowImp(idx, r); cmpAPRenderSectionTotals(); cmpAPRenderTotals();
}

function cmpAPSetRigaUm(idx, value){
  const a=cmpAPEnsure(); const r=a.righe[idx]; if(!r) return;
  r.um = String(value||'').trim() || 'cad';
}

function cmpAPSezioneHTML(tipo){
  const a=cmpAPEnsure();
  const righeConIdx = a.righe.map((r,idx)=>({r,idx})).filter(x=>x.r.tipo===tipo);
  const rowsHtml = righeConIdx.map(({r,idx})=>{
    const moLabel = tipo==='manodopera' ? apMoLabel(r.descrizione) : null;
    const descHtml = moLabel
      ? `<b class="cmp-ap-mo-primario">${esc(moLabel)}</b><span class="cmp-ap-row-fonte">${esc(r.descrizione)}${r.fonte?` — ${esc(r.fonte.codice)} · ${esc(r.fonte.regione)} ${esc(r.fonte.anno)}`:''}</span>`
      : `${esc(r.descrizione)}${r.fonte?`<span class="cmp-ap-row-fonte">${esc(r.fonte.codice)} · ${esc(r.fonte.regione)} ${esc(r.fonte.anno)}</span>`:''}`;
    const tendina = tipo==='manodopera'
      ? `<button class="cmp-ap-row-swap" title="Correggi il match: scegli un'altra tariffa manodopera" onclick="cmpAPMoMenuToggle(${idx},this)">▾</button>`
      : '';
    return `<div class="cmp-ap-row ${tipo==='manodopera'?'mo':''}${idx===AP_JUST_ADDED?' just-added':''}" data-idx="${idx}">
      <div class="cmp-ap-row-top">
        <div class="cmp-ap-row-desc">${descHtml}</div>
        <div class="cmp-ap-row-actions">
          ${tendina}
          <button class="cmp-ap-row-dup" title="Duplica riga (stessa voce, quantità/prezzo da rifinire)" onclick="cmpAPDuplicaRiga(${idx})">⧉</button>
          <button class="cmp-ap-row-rm" title="Rimuovi riga" onclick="cmpAPRemoveRiga(${idx})">✕</button>
        </div>
      </div>
      <div class="cmp-ap-row-fields">
        <label>U.M.<input class="cmp-ap-row-um" type="text" value="${esc(r.um||'')}" onchange="cmpAPSetRigaUm(${idx},this.value)"></label>
        <label>Q.tà<input class="cmp-ap-row-qty" type="number" step="any" value="${r.quantita}" onchange="cmpAPSetRigaQty(${idx},this.value)"></label>
        <label>Prezzo<input class="cmp-ap-row-prezzo" type="number" step="any" value="${r.prezzoUnitario}" onchange="cmpAPSetRigaPrezzo(${idx},this.value)"></label>
        <span class="cmp-ap-row-imp-wrap">Importo<span class="cmp-ap-row-imp" id="cmp-ap-imp-${idx}" title="Importo = quantità × prezzo">€ ${(r.quantita*r.prezzoUnitario).toFixed(2)}</span></span>
      </div>
    </div>`;
  }).join('');
  return `<div class="cmp-ap-sec">
    <div class="cmp-ap-sec-hd"><span class="cmp-ap-sec-lettera">${AP_TIPO_LETTERA[tipo]}</span> ${esc(AP_TIPO_LABEL[tipo])} <span class="cmp-ap-sec-tot" id="cmp-ap-sec-tot-${tipo}"></span></div>
    <div class="cmp-ap-rows" id="cmp-ap-rows-${tipo}">${rowsHtml || '<div class="cmp-empty">Nessuna riga.</div>'}</div>
    <div class="cmp-ap-sec-add">
      <div class="cmp-ap-search-wrap">
        <input class="cmp-ap-search" id="cmp-ap-search-${tipo}" placeholder="${tipo==='manodopera'?'Cerca operaio… (solo tariffe orarie manodopera)':tipo==='nolo'?'Cerca nolo… (solo capitolo noleggi)':tipo==='materiale'?'Cerca materiale… (solo costi elementari, no «in opera»)':'Cerca in prezzario…'}" oninput="cmpAPSearchInput('${tipo}',this.value)" onfocus="cmpAPRenderSearchResults('${tipo}')">
        <div class="cmp-ap-search-results" id="cmp-ap-search-res-${tipo}" style="display:none"></div>
      </div>
      <div class="cmp-ap-custom-row">
        <input id="cmp-ap-custom-desc-${tipo}" placeholder="voce personalizzata… (Invio per aggiungere)"
          onkeydown="if(event.key==='Enter')cmpAPAddRigaCustom('${tipo}')" onblur="cmpAPCustomRowBlur('${tipo}')">
        <input id="cmp-ap-custom-um-${tipo}" placeholder="UM" style="max-width:44px"
          onkeydown="if(event.key==='Enter')cmpAPAddRigaCustom('${tipo}')" onblur="cmpAPCustomRowBlur('${tipo}')">
        <input id="cmp-ap-custom-prezzo-${tipo}" type="number" step="any" placeholder="€" style="max-width:60px"
          onkeydown="if(event.key==='Enter')cmpAPAddRigaCustom('${tipo}')" onblur="cmpAPCustomRowBlur('${tipo}')">
        <button class="cmp-tbtn cmp-tbtn--create cmp-ap-custom-add" title="Aggiungi la voce personalizzata alla scomposizione (o premi Invio, o esci dal campo)" onclick="cmpAPAddRigaCustom('${tipo}')">+ Aggiungi</button>
      </div>
    </div>
  </div>`;
}

function cmpAPSnapshot(){
  const a=cmpAPEnsure();
  const d=cmpCurrentDescrizione();
  return { ...a, descrizioneBreve:d.breve, descrizioneEstesa:d.estesa, famigliaId:CMP.fam||a.famigliaId||undefined };
}

function cmpAPUpdateRowImp(idx, r){
  const el=document.getElementById('cmp-ap-imp-'+idx);
  if(el) el.textContent='€ '+(r.quantita*r.prezzoUnitario).toFixed(2);
}

export {
  cmpAPAddRigaCustom, cmpAPAddToCart, cmpAPAutoSuggestManodopera, cmpAPAutoSuggestMateriale, cmpAPByCodice, cmpAPCurrentMacro, cmpAPCustomRowBlur, cmpAPDefault,
  cmpAPDescDiretta, cmpAPDuplicaRiga, cmpAPEnsure, cmpAPExportExcel, cmpAPExportPdf, cmpAPImportScomposizione, cmpAPMoMenuToggle, cmpAPMoReplace,
  cmpAPNewVoce, cmpAPRefPick, cmpAPRefResults, cmpAPRefSearchInput, cmpAPRemoveRiga, cmpAPRender, cmpAPRenderRefResults, cmpAPRenderSearchResults,
  cmpAPRenderSectionTotals, cmpAPRenderTotals, cmpAPSaveToLibreria, cmpAPSearchInput, cmpAPSearchPick, cmpAPSearchResults, cmpAPSetField, cmpAPSetPct,
  cmpAPSetRigaPrezzo, cmpAPSetRigaQty, cmpAPSetRigaUm, cmpAPSezioneHTML, cmpAPSnapshot, cmpAPUpdateRowImp
}
