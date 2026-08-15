/* μ (Prezzi) legacy — archivio dei prezzari (caricamento, parsing XLSX/XML, riconoscimento
   regione/anno) e ricerca: filtri a cascata, macro-categorie, ordinamento.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { S } from './stato.js'
import { openAmpereDistinta } from './distinte.js'
import { esc, fmt, hideState, normSearch, showState, toast } from './index.js'
import { render } from './render.js'
import { renderSidebar } from './sidebar.js'

// ══════════════════════════════════════════════════════════════
// REGION / YEAR MAP
// ══════════════════════════════════════════════════════════════
export const REGIONS = {
  LOM:'Lombardia', VEN:'Veneto', TOS:'Toscana', LAZ:'Lazio',
  PIE:'Piemonte', LIG:'Liguria', EMR:'Emilia-Romagna', MAR:'Marche',
  UMB:'Umbria',   ABR:'Abruzzo', MOL:'Molise', CAM:'Campania',
  PUG:'Puglia',   BAS:'Basilicata', CAL:'Calabria', SIC:'Sicilia',
  SAR:'Sardegna', FRI:'Friuli V.G.', TN:'Trento', BZ:'Bolzano', VDA:"Valle d'Aosta"
};
export const REG_COLORS = {
  'Lombardia':'#2563eb','Veneto':'#0891b2','Toscana':'#059669','Lazio':'#7c3aed',
  'Piemonte':'#b45309','Liguria':'#0f766e','Emilia-Romagna':'#dc2626','Marche':'#6d28d9',
  'Umbria':'#0369a1','Abruzzo':'#047857','Molise':'#9333ea','Campania':'#b45309',
  'Puglia':'#0284c7','Basilicata':'#065f46','Calabria':'#be185d','Sicilia':'#d97706',
  'Sardegna':'#7c2d12','Friuli V.G.':'#3730a3','Trento':'#166534','Bolzano':'#15803d',"Valle d'Aosta":'#92400e'
};

export function regColor(r){ return REG_COLORS[r]||'#6b7280'; }

export function regBadge(r){
  const c=regColor(r);
  return `<span class="reg-badge" style="background:${c}22;color:${c}">${r}</span>`;
}

export function discBadge(d){
  if(!d) return '';
  const dl=d.toLowerCase();
  let cls='gen',lbl=d.split(' ')[0];
  if(dl.includes('meccan')){cls='mec';lbl='Meccanica';}
  else if(dl.includes('elettr')&&!dl.includes('tron')){cls='ele';lbl='Elettrica';}
  else if(dl.includes('idrau')){cls='idr';lbl='Idraulica';}
  else if(dl.includes('antinc')){cls='ant';lbl='Antinc.';}
  else if(dl.includes('tron')||dl.includes('ict')){cls='ict';lbl='ICT';}
  return `<span class="disc-badge disc-${cls}">${lbl}</span>`;
}

export function matBadge(r){
  if(!window.isMaterialeRow || !window.isMaterialeRow(r)) return '';
  return `<span class="mat-badge" title="Costo elementare di materiale (non opera compiuta)">Materiale</span>`;
}

export function detectFromFilename(fn){
  const u=fn.toUpperCase();
  let regione='Sconosciuta', anno='—';
  const ym=u.match(/20\d{2}/); if(ym) anno=ym[0];
  for(const [code,name] of Object.entries(REGIONS)){
    if(u.includes(code)){regione=name;break;}
  }
  if(regione==='Sconosciuta'){
    const kw={'LOMBARDIA':'Lombardia','VENETO':'Veneto','TOSCANA':'Toscana','LAZIO':'Lazio',
      'PIEMONTE':'Piemonte','SICILIA':'Sicilia','CAMPANIA':'Campania','PUGLIA':'Puglia',
      'LIGURIA':'Liguria','EMILIA':'Emilia-Romagna','MARCHE':'Marche','UMBRIA':'Umbria',
      'ABRUZZO':'Abruzzo','CALABRIA':'Calabria','SARDEGNA':'Sardegna','FRIULI':'Friuli V.G.',
      'FVG':'Friuli V.G.','TRENTINO':'Trento','TRENTO':'Trento','BOLZANO':'Bolzano','ALTO ADIGE':'Bolzano','VALLE':"Valle d'Aosta"};
    for(const [k,v] of Object.entries(kw)) if(u.includes(k)){regione=v;break;}
  }
  return {regione,anno};
}

// Sniff leggero: legge solo l'inizio del file per rilevare regione/anno
// dal contenuto, senza parsare tutto (mantiene il lazy load).
export async function sniffRegion(handle, fmt){
  try{
    const file=await handle.getFile();
    let detReg=null, detAnno=null;

    if(fmt==='xml'){
      // Leggi i primi 64KB come testo: contiene <prezzario cod> e i primi codici
      const slice=file.slice(0,65536);
      const txt=await slice.text();
      // anno da prezzario cod o ovunque nei primi codici
      const ym=txt.match(/20\d{2}/); if(ym) detAnno=ym[0];
      // regione: prova prefisso da attributo cod="XXX" (struttura prezzario/settore)
      // oppure da elemento <Codice>XXX (struttura dataroot/Access)
      const candidates=[];
      (txt.match(/cod="([A-Z]{3})/g)||[]).forEach(c=>candidates.push(c.replace('cod="','')));
      (txt.match(/<Codice>([A-Z]{3})/g)||[]).forEach(c=>candidates.push(c.replace('<Codice>','')));
      for(const c of candidates){
        const pfx=c.toUpperCase();
        if(REGIONS[pfx]){ detReg=REGIONS[pfx]; break; }
      }
    } else {
      // XLSX: leggi solo la prima colonna delle prime righe.
      // Per evitare di caricare l'intero foglio, leggiamo il file ma
      // limitiamo il parse con sheetRows.
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array',sheetRows:8});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      for(const row of raw){
        const cod=String(row[0]||'').trim();
        if(cod.length>=3){
          const pfx=cod.substring(0,3).toUpperCase();
          if(REGIONS[pfx]){ detReg=REGIONS[pfx]; }
          const ym=cod.match(/20(\d{2})/); if(ym) detAnno='20'+ym[1];
        }
        if(detReg) break;
      }
    }
    return {regione:detReg, anno:detAnno};
  }catch(e){ return {regione:null, anno:null}; }
}

// ══════════════════════════════════════════════════════════════
// FOLDER OPEN
// ══════════════════════════════════════════════════════════════
export async function openFolder(){
  try{
    const handle=await window.showDirectoryPicker({mode:'read'});

    const files=[];
    for await(const e of handle.values()){
      if(e.kind!=='file') continue;
      const n=e.name.toLowerCase();
      if(n.endsWith('.xlsx')||n.endsWith('.xls')||n.endsWith('.xml')) files.push(e);
    }
    if(!files.length){toast('Nessun file .xlsx o .xml trovato','warn');return;}

    // AGGIUNGE al database della sessione: i prezzari interni e quelli già
    // caricati restano. Dedup per nome file (come il drag&drop).
    const added=[];
    let dup=0;
    for(const e of files){
      if(S.archive.some(a=>a.filename===e.name)){ dup++; continue; }
      const fmt=e.name.toLowerCase().endsWith('.xml')?'xml':'xlsx';
      const {regione,anno}=detectFromFilename(e.name);
      const item={filename:e.name,regione,anno,format:fmt,loaded:false,rows:[],handle:e};
      S.archive.push(item);
      added.push(item);
    }

    // Mostra subito la lista (rilevamento rapido da nome file)
    renderSidebar();
    showState('idle');
    if(!added.length){ toast('Tutti i file erano già nel database della sessione','warn'); return; }
    toast(`${added.length} file aggiunti${dup?` · ${dup} già presenti`:''} — rilevamento regioni…`,'ok');

    // Rilevamento approfondito dal contenuto (in background, solo i nuovi)
    (async()=>{
      let changed=false;
      for(const item of added){
        const sn=await sniffRegion(item.handle,item.format);
        if(sn.regione && sn.regione!==item.regione){ item.regione=sn.regione; changed=true; }
        if(sn.anno && (item.anno==='—'||!item.anno)){ item.anno=sn.anno; changed=true; }
        if(changed){ renderSidebar(); }
      }
      if(changed) toast('Regioni rilevate dal contenuto dei file','ok');
    })();
  }catch(e){ if(e.name!=='AbortError') toast('Errore: '+e.message,'err'); }
}

// ══════════════════════════════════════════════════════════════
// DRAG & DROP / FILE INPUT (singolo file o più file)
// ══════════════════════════════════════════════════════════════
// Etichetta fornitore da un nome file di listino METEL (es. "LCFLSP.txt" → "LCFLSP").
export function metelSupplierFromName(fn){
  return String(fn).replace(/\.[^.]+$/,'').replace(/[_-]*lsp$/i,'').trim().toUpperCase() || 'METEL';
}
// ── IMPORT AMPÈRE (lista cavi già computata) ──────────────────────────────────
// Un export utenze Ampère è un .xls MA NON è un prezzario: si riconosce dalla riga
// di codici campo <$NNNN>/#MODE.H (isAmpereMatrix). Ogni utenza porta Designazione,
// Formazione e Lc [m]: μ ne ricava i cavi aggregati coi metri e li aggancia alle voci
// di prezzario col matcher cavi già esistente. Ingressi: bottone «⇪ Ampère» e drop.
export function pickAmpere(){ const i=document.getElementById('ampere-input'); if(i) i.click(); }
export async function ampereFilePicked(ev){
  const f=ev.target.files && ev.target.files[0];
  ev.target.value='';
  if(!f) return;
  const ok=await tryAmpereFile(f);
  if(!ok) toast('Non sembra un export utenze Ampère (manca l\'intestazione dei codici <$…>)','warn');
}
// Legge il file come matrice e, SE è un export Ampère, apre l'import. Ritorna true
// se l'ha gestito (così addFiles non lo tratta come prezzario).
export async function tryAmpereFile(file){
  let matrix=null;
  try{
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    // il foglio delle utenze si chiama "Utenze del progetto"; fallback al primo
    const name=(wb.SheetNames||[]).find(n=>/utenz/i.test(n)) || (wb.SheetNames||[])[0];
    if(!name) return false;
    matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
  }catch(e){ return false; }
  if(!matrix || !(window.isAmpereMatrix && window.isAmpereMatrix(matrix))) return false;
  importAmpereMatrix(matrix, file.name);
  return true;
}
export function importAmpereMatrix(matrix, fileName){
  if(!window.caviDaAmpere){ toast('Motore Ampère non disponibile','warn'); return; }
  if(!S.allRows || !S.allRows.length){
    toast('Carica un prezzario prima di importare la lista cavi Ampère','warn');
    return;
  }
  const res=window.caviDaAmpere(matrix);
  if(!res.items.length){
    toast('Nessun cavo con lunghezza (Lc) riconosciuto nel file Ampère','warn');
    return;
  }
  openAmpereDistinta(res.items, fileName);
  const notes=[];
  if(res.senzaLunghezza) notes.push(`${res.senzaLunghezza} utenze senza Lc`);
  if(res.nonInterpretati) notes.push(`${res.nonInterpretati} con formazione non interpretata`);
  if(notes.length) toast('Ampère: '+notes.join(' · ')+' — escluse','warn');
}

export async function addFiles(fileList){
  const all=[...fileList].filter(f=>{
    const n=f.name.toLowerCase();
    return n.endsWith('.xlsx')||n.endsWith('.xls')||n.endsWith('.xml')||n.endsWith('.txt');
  });
  if(!all.length){ toast('Trascina .xlsx, .xml o un listino METEL .txt','warn'); return; }
  // un export Ampère trascinato qui NON va caricato come prezzario: intercettalo
  const files=[];
  for(const f of all){
    const n=f.name.toLowerCase();
    if((n.endsWith('.xls')||n.endsWith('.xlsx')) && await tryAmpereFile(f)) continue;
    files.push(f);
  }
  if(!files.length) return;

  let firstNewIdx=null;
  for(const file of files){
    // evita doppioni per nome
    if(S.archive.some(a=>a.filename===file.name)){
      toast(`"${file.name}" già presente`,'warn');
      continue;
    }
    const ln=file.name.toLowerCase();
    const isTxt=ln.endsWith('.txt');
    const fmt=isTxt?'metel':(ln.endsWith('.xml')?'xml':'xlsx');
    // handle finto: getFile() restituisce direttamente il File trascinato
    const fakeHandle={ getFile: async()=>file };
    const item={ filename:file.name, format:fmt, loaded:false, rows:[], handle:fakeHandle };
    if(isTxt){ item.tipo='metel'; item.regione=metelSupplierFromName(file.name); item.anno='—'; item._sniffed=true; }
    else { const d=detectFromFilename(file.name); item.regione=d.regione; item.anno=d.anno; }
    S.archive.push(item);
    if(firstNewIdx===null) firstNewIdx=S.archive.length-1;
  }

  renderSidebar();
  showState('idle');

  // rilevamento regione dal contenuto in background
  (async()=>{
    let changed=false;
    for(const item of S.archive){
      if(item.loaded===true||item._sniffed) continue;
      item._sniffed=true;
      const sn=await sniffRegion(item.handle,item.format);
      if(sn.regione && sn.regione!==item.regione){ item.regione=sn.regione; changed=true; }
      if(sn.anno && (item.anno==='—'||!item.anno)){ item.anno=sn.anno; changed=true; }
      if(changed){ renderSidebar(); }
    }
  })();

  // carica e attiva subito il primo file aggiunto
  if(firstNewIdx!==null){ loadItem(firstNewIdx); }
}

export function handleFileInput(ev){
  const files=ev.target.files;
  if(files&&files.length) addFiles(files);
  ev.target.value=''; // reset per ricaricare lo stesso file se serve
}

export function initDropZone(){
  const dz=document.getElementById('drop-zone');
  if(dz){
    ['dragenter','dragover'].forEach(evt=>{
      dz.addEventListener(evt,e=>{ e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover'); });
    });
    ['dragleave','drop'].forEach(evt=>{
      dz.addEventListener(evt,e=>{ e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover'); });
    });
    dz.addEventListener('drop',e=>{
      const dt=e.dataTransfer;
      if(dt&&dt.files&&dt.files.length) addFiles(dt.files);
    });
  }

  // DROP SULL'INTERA FINESTRA. La zona #drop-zone vive dentro il popover
  // "⋯ Altro": all'avvio non è nemmeno a schermo, quindi il gesto naturale
  // (trascinare il prezzario sulla schermata iniziale) deve funzionare ovunque.
  // Prima qui c'era un preventDefault globale e basta: sopprimeva l'apertura
  // del file da parte del browser SENZA che nessuno raccogliesse i file —
  // il trascinamento sembrava semplicemente ignorato.
  // Si reagisce solo ai trascinamenti di FILE: i drag interni di μ (chip
  // categoria, voci verso il computo) usano tipi text/* e restano ai loro
  // handler.
  const isFileDrag=dt=>!!dt&&Array.from(dt.types||[]).includes('Files');
  window.addEventListener('dragover',e=>{
    if(!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    document.body.classList.add('file-dragover');
  });
  window.addEventListener('dragleave',e=>{
    if(!e.relatedTarget) document.body.classList.remove('file-dragover');
  });
  window.addEventListener('drop',e=>{
    document.body.classList.remove('file-dragover');
    if(!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    const files=e.dataTransfer.files;
    if(files&&files.length) addFiles(files);
  });
}
export async function loadItem(idx){
  const item=S.archive[idx];
  if(item.loaded==='loading') return;
  if(item.loaded===true){
    // già caricato: rendilo semplicemente il prezzario attivo a video
    S.active=idx;
    rebuildRows();
    renderSidebar();
    buildFilters();
    doFilter();
    return;
  }

  item.loaded='loading';
  renderSidebar();
  showState('loading',`Caricamento ${item.filename}…`,0);

  try{
    if(item.format==='internal'){
      // prezzario INTERNO: caricato a richiesta (script-inject + decompressione) da main.ts
      item.rows=await window.__pricelistLoadRows(item.slug,p=>showState('loading',`Caricamento ${item.filename}…`,p));
    } else {
    const file=await item.handle.getFile();
    const onP=p=>showState('loading',`Parsing ${item.filename}…`,p);

    if(item.format==='metel'){
      // listino METEL LSP: testo ISO-8859-1, parser dall'engine
      const text=new TextDecoder('iso-8859-1').decode(await file.arrayBuffer());
      if(window.isMetel && !window.isMetel(text)){ toast(`"${item.filename}" non è un listino METEL`,'warn'); }
      const res=window.parseMetel?window.parseMetel(text,{regione:item.regione,anno:item.anno}):{rows:[]};
      item.rows=res.rows;
    }
    else if(item.format==='xlsx') item.rows=await parseXLSX(file,item.regione,item.anno,onP);
    else item.rows=await parseXML(file,item.regione,item.anno,onP);
    }

    // apply detected region/anno from content
    if(item.rows.length>0){
      const r0=item.rows[0];
      if(r0._reg){item.regione=r0._reg; item.rows.forEach(r=>r.regione=r0._reg);}
      if(r0._anno&&item.anno==='—'){item.anno=r0._anno; item.rows.forEach(r=>r.anno=r0._anno);}
      item.rows.forEach(r=>{delete r._reg;delete r._anno;});
    }

    // Prezzario senza voci leggibili: marcalo come vuoto e non attivarlo
    if(item.rows.length===0){
      item.loaded='empty';
      renderSidebar();
      hideState();
      // se non c'è nulla a video, mostra lo stato idle
      if(S.active==null) showState('idle');
      toast(`"${item.filename}": nessuna voce riconosciuta — formato non compatibile`,'warn');
      return;
    }

    item.loaded=true;
    S.active=idx;   // il prezzario appena caricato diventa quello attivo
    rebuildRows();
    renderSidebar();
    hideState();
    buildFilters();
    doFilter();
    toast(`${item.filename}: ${item.rows.length.toLocaleString('it')} voci`,'ok');
  }catch(e){
    item.loaded=false;
    renderSidebar();
    hideState();
    toast('Errore parsing: '+e.message,'err');
    console.error(e);
  }
}

export function rebuildRows(){
  // Mostra a video SOLO il prezzario attivo (uno alla volta), per chiarezza.
  S.allRows=[];
  if(S.active!=null && S.archive[S.active] && S.archive[S.active].loaded===true){
    S.allRows=S.archive[S.active].rows;
    // indice trigrammi in background (lossless): le ricerche funzionano subito
    // per scansione e accelerano appena l'indice è pronto
    if(window.prewarmSearchIndexAsync && S.allRows.length){
      // subito, non in idle/500ms: buildTextIndexAsync è già chunked (yield ogni
      // 2000 righe), l'attesa extra allargava solo la finestra in cui la prima
      // ricerca su un prezzario grande girava a scansione lineare sincrona (1-3s)
      window.prewarmSearchIndexAsync(S.allRows).catch(()=>{});
    }
  }
  document.getElementById('tot-voci').textContent=S.allRows.length.toLocaleString('it');
  const n=S.archive.filter(a=>a.loaded===true).length;
  document.getElementById('tot-loaded').textContent=n>0?`${n} caricati`:'';
  updateActiveBanner();
}

export function updateActiveBanner(){
  const banner=document.getElementById('active-banner');
  if(!banner) return;
  if(S.active!=null && S.archive[S.active]){
    const it=S.archive[S.active];
    const c=regColor(it.regione);
    banner.style.display='flex';
    banner.innerHTML=`
      <span class="ab-dot" style="background:${c}"></span>
      <span class="ab-label">Stai consultando:</span>
      <span class="ab-region" style="color:${c}">${it.regione}${it.anno!=='—'?' '+it.anno:''}</span>
      <span class="ab-file">${esc(it.filename)}</span>
      <span class="ab-count">${it.rows.length.toLocaleString('it')} voci</span>`;
  } else {
    banner.style.display='none';
  }
}

// ══════════════════════════════════════════════════════════════
// PARSE XLSX
// ══════════════════════════════════════════════════════════════
export async function parseXLSX(file,regF,annoF,onP){
  return new Promise((res,rej)=>{
    const rd=new FileReader();
    rd.onload=e=>{
      try{
        onP(20);
        const wb=XLSX.read(e.target.result,{type:'binary'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        onP(50);
        const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        onP(70);
        if(raw.length<2){res([]);return;}

        // normalizza intestazione per confronto: minuscolo, no accenti, no punteggiatura
        const normH=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

        // alias per ogni campo logico (in ordine di priorità)
        const ALIAS={
          cod:['codice','cod','codicevoce','codicearticolo'],
          // descrizione lunga/estesa
          decl:['declaratoria','descrizioneestesa','descrizionelunga','descrizionecompleta','descestesa'],
          // descrizione breve (fallback se manca la lunga)
          descbreve:['descrizionebreve','descrizionesintetica','descbreve','descrizione','denominazione','oggetto'],
          um:['um','desum','descum','unitadimisura','unitamisura','umisura','udm'],
          prez:['prezzo','prezzounitario','prezzo1','importo','prezzoeuro'],
          netto:['importosenzasgeui','importonetto','prezzonetto','importosenzasg'],
          ru:['rapportoru','man','manodopera','costomanodopera','incidenzamanodopera','perman'],
          l1:['descrliv1','descrizioneliv1','livello1','categoria'],
          l2:['descrliv2','descrizioneliv2','livello2','sottocategoria'],
          l3:['descrliv3','descrizioneliv3','livello3'],
          l4:['descrliv4','descrizioneliv4','livello4'],
          materia:['materia','materiale'],
          disc:['disciplina'],
          sis:['sistema'],
          att:['attivita','attività'],
          set:['settoremerceologico','settore','capitolo'],
          kw:['keywords','parolechiave','keyword'],
          tip:['tipologia'],
        };

        // trova la riga di intestazione: quella che contiene più alias riconosciuti
        let hi=0, bestScore=0;
        const scanRows=Math.min(10,raw.length);
        for(let i=0;i<scanRows;i++){
          const cellsN=raw[i].map(normH);
          let score=0;
          for(const key in ALIAS){
            if(cellsN.some(c=>ALIAS[key].includes(c))) score++;
          }
          if(score>bestScore){ bestScore=score; hi=i; }
        }

        const hdrN=raw[hi].map(normH);
        // trova indice colonna dal primo alias che combacia
        const find=key=>{
          for(const a of ALIAS[key]){
            const idx=hdrN.indexOf(a);
            if(idx!==-1) return idx;
          }
          return -1;
        };
        const C={};
        for(const key in ALIAS) C[key]=find(key);

        const get=(r,key)=>C[key]>=0?String(r[C[key]]||'').trim():'';

        // Spezza un codice nei suoi segmenti gerarchici progressivi.
        // Es. "VEN25-10.05.03.a" → ["VEN25-10","VEN25-10.05","VEN25-10.05.03","VEN25-10.05.03.a"]
        // Gestisce separatori misti: primo "-" poi "." (e ".-" finale della Lombardia).
        const codeLevels=cod=>{
          const c=cod.replace(/\.-$/,'');               // togli ".-" finale (Lombardia)
          const parts=c.split(/[-.]/).filter(Boolean);  // spezza su - e .
          const levels=[]; let acc='';
          for(let k=0;k<parts.length;k++){
            // ricostruisci il prefisso usando il separatore originale
            if(k===0){ acc=parts[0]; }
            else {
              // trova il separatore reale tra parts[k-1] e parts[k] nel codice originale
              const sep=c.charAt(acc.length); // carattere subito dopo l'accumulato
              acc=acc+(sep==='-'||sep==='.'?sep:'.')+parts[k];
            }
            levels.push(acc);
          }
          return levels;
        };

        // PRIMO PASSO: costruisci l'albero dei capitoli.
        // - parentDesc: codice → descrizione (per ereditarietà descrizione, formato FVG e Veneto)
        // - chapterTree: codice-capitolo (riga SENZA prezzo) → descrizione categoria (formato Veneto)
        // - floatingDesc: righe senza codice ma con testo (es. Veneto: la riga estesa
        //   sotto al titolo capitolo, con col[0] vuota e testo in qualunque colonna)
        const parentDesc={};
        const chapterTree={};
        // pre-scan: associa righe-testo libere (senza codice) al codice che le precede
        {
          let lastCod='';
          for(let i=hi+1;i<raw.length;i++){
            const r=raw[i];
            const cod=get(r,'cod');
            if(cod){ lastCod=cod; continue; }
            // riga senza codice: cerca testo in qualsiasi cella
            const rowText=r.map(v=>String(v||'').trim()).filter(Boolean).join(' ').trim();
            if(rowText && lastCod && !parentDesc[lastCod]){
              parentDesc[lastCod]=rowText;
            }
          }
        }
        for(let i=hi+1;i<raw.length;i++){
          const r=raw[i];
          const cod=get(r,'cod'); if(!cod) continue;
          const ext=get(r,'decl');
          const breve=get(r,'descbreve');
          const prz=parseFloat(get(r,'prez').replace(',','.'))||0;
          // descrizione estesa ricca per ereditarietà (FVG): sovrascrive il floating solo se più lunga
          if(ext && ext.length>60){
            if(!parentDesc[cod]||ext.length>parentDesc[cod].length) parentDesc[cod]=ext;
          }
          // riga-capitolo: senza prezzo, con una descrizione → nodo categoria (Veneto)
          if(prz===0){
            const catDesc=(ext||breve).trim();
            if(catDesc) chapterTree[cod]=catDesc;
          }
        }

        // verifica se il prezzario ha già colonne categoria esplicite (Lombardia)
        const hasExplicitCats = C.disc>=0 || C.sis>=0 || C.set>=0;

        // funzione: trova la descrizione del padre risalendo il codice
        const findParentDesc=cod=>{
          let c=cod;
          for(let k=0;k<6;k++){
            const cut=c.replace(/[._\-\s][^._\-\s]*$/,'');
            if(cut===c||!cut) break;
            c=cut;
            if(parentDesc[c]) return parentDesc[c];
          }
          return '';
        };

        // funzione: deriva disciplina/sistema/settore dall'albero capitoli (per prezzari piatti)
        const deriveCats=cod=>{
          const levels=codeLevels(cod);
          // raccogli le descrizioni-capitolo disponibili lungo la gerarchia (esclusa la voce stessa)
          const descs=[];
          for(let k=0;k<levels.length-1;k++){    // -1: l'ultimo è la voce con prezzo
            const d=chapterTree[levels[k]];
            if(d) descs.push(d);
          }
          if(!descs.length) return {disc:'',sis:'',set:''};
          const disc=descs[0];                          // radice = Disciplina
          const set=descs.length>1?descs[descs.length-1]:''; // ultimo padre = Settore
          const sis=descs.length>2?descs[descs.length-2]:(descs.length===2?'':''); // intermedio = Sistema
          // se ci sono esattamente 2 livelli (disc+set), sistema resta vuoto
          // se 3+, sistema = penultimo
          let sistema='';
          if(descs.length>=3) sistema=descs[descs.length-2];
          return {disc, sis:sistema, set};
        };


        const rows=[]; let detReg=null,detAnno=null;
        for(let i=hi+1;i<raw.length;i++){
          const r=raw[i];
          const cod=get(r,'cod'); if(!cod) continue;
          const p=parseFloat(get(r,'prez').replace(',','.'))||0;
          if(p===0) continue;   // salta voci senza prezzo (sezioni/titoli/padri)

          if(!detReg&&cod.length>=3){
            const pfx=cod.substring(0,3).toUpperCase();
            if(REGIONS[pfx]) detReg=REGIONS[pfx];
          }
          if(!detAnno){ const m=cod.match(/20(\d{2})/); if(m) detAnno='20'+m[1]; }

          const um=get(r,'um').replace(/^[0-9\s]+/,'').trim();
          const declLong=get(r,'decl');
          const descBreve=get(r,'descbreve');
          // se la voce non ha estesa propria, eredita quella del padre (formato gerarchico)
          const inherited=(!declLong||declLong.length<60)?findParentDesc(cod):'';
          // anteprima breve: preferisci la breve specifica della variante
          let ds;
          const baseForOpera=declLong||descBreve;
          const om=baseForOpera.match(/OPERA:\s*([^\n\r]+)/);
          if(om){
            ds=om[1].trim().replace(/\s+/g,' ');
          } else if(descBreve){
            ds=descBreve.replace(/\s+/g,' ');
          } else {
            const firstLine=(declLong||'').split(/[\n\r]/)[0].trim();
            ds=firstLine.length>220?firstLine.substring(0,220)+'…':firstLine;
          }
          // declaratoria completa. Voce figlia "parziale" (descrizione propria corta —
          // es. solo un delta di diametro/sezione): anteponi il CONTESTO DEL PADRE, così
          // la voce resta leggibile da sola → "descrizione padre + variante".
          let decl=declLong||inherited||descBreve||'';
          const own=(declLong||descBreve||'').trim();
          if(inherited && inherited.length>=60 && own && own.length<80
             && !inherited.toLowerCase().includes(own.toLowerCase())){
            decl=inherited+'\n\n— '+own;
          } else if(inherited && descBreve && !declLong
             && !inherited.toLowerCase().includes(descBreve.toLowerCase())){
            decl=inherited+'\n\n— '+descBreve;
          }

          // categorie: usa le colonne esplicite se presenti (Lombardia),
          // altrimenti derivale dall'albero capitoli (Veneto e simili)
          let disc=get(r,'disc'), sis=get(r,'sis'), set=get(r,'set');
          if(!hasExplicitCats){
            const d=deriveCats(cod);
            disc=disc||d.disc; sis=sis||d.sis; set=set||d.set;
          }

          rows.push({
            codice:cod, declaratoria:decl, desc_short:ds||cod, um,
            prezzo:p,
            importo_netto:parseFloat(get(r,'netto').replace(',','.'))||0,
            ru:parseFloat(get(r,'ru').replace(',','.'))||0,
            liv1:get(r,'l1'), liv2:get(r,'l2'),
            materia:get(r,'materia'),
            liv3:get(r,'l3'), liv4:get(r,'l4'),
            disciplina:disc,
            sistema:sis,
            attivita:get(r,'att'),
            settore:set,
            keywords:get(r,'kw'),
            tipologia:get(r,'tip'),
            regione:regF, anno:annoF,
            _reg:detReg, _anno:detAnno||annoF,
          });
        }
        // Macro-tematica + macrocategorie impianti per ogni voce (classificatori condivisi da main.ts)
        if(window.classifyTematica) for(const r of rows) r.tematica=window.classifyTematica(r);
        if(window.macrocategorieFor) for(const r of rows) r.macro=window.macrocategorieFor(r);
        onP(100); res(rows);
      }catch(err){rej(err);}
    };
    rd.onerror=()=>rej(new Error('Errore lettura file'));
    rd.readAsBinaryString(file);
  });
}

// ══════════════════════════════════════════════════════════════
// PARSE XML
// ══════════════════════════════════════════════════════════════
export async function parseXML(file,regF,annoF,onP){
  return new Promise((res,rej)=>{
    const rd=new FileReader();
    rd.onload=e=>{
      try{
        onP(20);
        const doc=new DOMParser().parseFromString(e.target.result,'text/xml');
        onP(40);
        const root=doc.querySelector('prezzario');
        let detAnno=annoF;
        if(root){const c=root.getAttribute('cod')||''; const m=c.match(/20\d{2}/); if(m) detAnno=m[0];}

        let detReg=regF;
        const rows=[]; const sets=doc.querySelectorAll('settore');
        let done=0;
        sets.forEach(s=>{
          const l1=s.getAttribute('desc')||'';
          const sc=s.getAttribute('cod')||'';
          if(sc.length>=3&&detReg===regF){const pfx=sc.substring(0,3).toUpperCase();if(REGIONS[pfx])detReg=REGIONS[pfx];}
          s.querySelectorAll('capitolo').forEach(cap=>{
            const l2=cap.getAttribute('desc')||'';
            cap.querySelectorAll('paragrafo').forEach(para=>{
              const sint=para.querySelector('sint')?.textContent?.trim()||'';
              const est=para.querySelector('estesa')?.textContent?.trim()||'';
              para.querySelectorAll('prezzo').forEach(p=>{
                const val=parseFloat(p.getAttribute('val')||'0'); if(!val) return;
                const cod=p.getAttribute('cod')||'';
                const umi=p.getAttribute('umi')||'';
                const man=parseFloat(p.getAttribute('man')||'0');
                const desc=p.textContent?.trim()||sint;
                rows.push({
                  codice:cod, declaratoria:est||sint, desc_short:sint||desc.substring(0,130),
                  um:umi, prezzo:val, importo_netto:0, ru:man,
                  liv1:l1, liv2:l2, liv3:'', liv4:'',
                  materia:'',
                  disciplina:'', sistema:'', attivita:'', settore:l2,
                  keywords:'', tipologia:'',
                  regione:detReg, anno:detAnno,
                  _reg:detReg, _anno:detAnno,
                });
              });
            });
          });
          done++; onP(40+Math.round(done/sets.length*55));
        });
        // Macro-tematica + macrocategorie impianti per ogni voce (classificatori condivisi da main.ts)
        if(window.classifyTematica) for(const r of rows) r.tematica=window.classifyTematica(r);
        if(window.macrocategorieFor) for(const r of rows) r.macro=window.macrocategorieFor(r);
        onP(100); res(rows);
      }catch(err){rej(err);}
    };
    rd.onerror=()=>rej(new Error('Errore XML'));
    rd.readAsText(file,'utf-8');
  });
}

// ══════════════════════════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════════════════════════
export const FILTER_ORDER=['reg','anno','tema','disc','sis','mat','att','um'];
export const FILTER_FIELD={'reg':'regione','anno':'anno','tema':'tematica','disc':'disciplina','sis':'sistema','mat':'materia','att':'attivita','um':'um'};
export const FILTER_LABEL={'reg':'Tutte','anno':'Tutti','tema':'Tutte','disc':'Tutte','sis':'Tutti','mat':'Tutti','att':'Tutte','um':'Tutte'};

// ── MACROCATEGORIE IMPIANTI — chip a monte: restringono voci e opzioni dei menu ──
export const MACRO_KEY='pricelist:macro';
export function macroSel(){ return sessionStorage.getItem(MACRO_KEY)||''; }
export function macroPool(rows){
  const m=macroSel();
  return m?rows.filter(r=>(r.macro||[]).includes(m)):rows;
}
export function buildMacroChips(){
  const wrap=document.getElementById('macro-chips'); if(!wrap) return;
  const cur=macroSel();
  wrap.innerHTML=(window.MACROCATEGORIE||[]).map(m=>
    `<button class="macro-chip${m===cur?' active':''}" data-macro="${m}" onclick="toggleMacro(this.dataset.macro)" title="Mostra solo i capitoli di: ${m}">${m}</button>`
  ).join('');
}
export function toggleMacro(m){
  if(macroSel()===m) sessionStorage.removeItem(MACRO_KEY); else sessionStorage.setItem(MACRO_KEY,m);
  buildMacroChips(); buildFilters(); doFilter();
}

export function buildFilters(){
  buildMacroChips();
  FILTER_ORDER.forEach(id=>populateSel(id,macroPool(S.allRows)));
}

export function populateSel(id,pool){
  const sel=document.getElementById('f-'+id);
  if(!sel) return;
  const cur=sel.value;
  const field=FILTER_FIELD[id];
  let vals=[...new Set(pool.map(r=>r[field]).filter(v=>v&&v!=='—'&&v!=='nd'&&v!==''))];
  // La Tematica segue l'ordine ufficiale (window.TEMATICHE), il resto è alfabetico
  if(id==='tema' && Array.isArray(window.TEMATICHE)){
    const ord=v=>{const i=window.TEMATICHE.indexOf(v); return i<0?9999:i;}; // ignote ("Varie") in fondo
    vals.sort((a,b)=>ord(a)-ord(b));
  } else vals.sort();
  sel.innerHTML=`<option value="">${FILTER_LABEL[id]}</option>`;
  vals.forEach(v=>{
    const o=document.createElement('option');
    o.value=v; o.textContent=v; if(v===cur) o.selected=true;
    sel.appendChild(o);
  });
}

// Catena gerarchica a senso unico: Disciplina → Sistema → Settore.
// Selezionare un livello ripopola SOLO i livelli sotto di esso.
export const HIER=['tema','disc','sis'];

export function cascade(changed){
  const q=document.getElementById('search-input').value.toLowerCase().trim();

  // Se il filtro modificato fa parte della gerarchia, azzera e ripopola i livelli a valle
  // (per 'search' questo ramo non esegue mai: evitiamo di ricalcolare qui il pool
  // macro+ricerca, tanto lo fa già doFilter — una sola scansione, non due)
  const hIdx=HIER.indexOf(changed);
  if(hIdx!==-1){
    // pool di base ristretto dalla macrocategoria e dalla ricerca libera
    // (motore con thesaurus quando disponibile, AND letterale come fallback)
    let base=macroPool(S.allRows);
    if(q){
      if(window.searchRows) base=window.searchRows(base,q);
      else base=base.filter(r=>{
        const h=normSearch(r.codice+' '+r.desc_short+' '+r.declaratoria+' '+r.keywords+' '+r.settore+' '+r.materia+' '+r.tipologia);
        return q.split(/\s+/).every(t=>h.includes(normSearch(t)));
      });
    }
    // pool ristretto dai livelli gerarchici fino a quello modificato (incluso)
    let pool=base;
    for(let i=0;i<=hIdx;i++){
      const v=document.getElementById('f-'+HIER[i]).value;
      if(v) pool=pool.filter(r=>r[FILTER_FIELD[HIER[i]]]===v);
    }
    // azzera e ripopola i livelli sotto
    for(let i=hIdx+1;i<HIER.length;i++){
      document.getElementById('f-'+HIER[i]).value='';
      populateSel(HIER[i],pool);
    }
  }

  doFilter();
}

export let _filterTimer=null;
export function debouncedFilter(){
  clearTimeout(_filterTimer);
  _filterTimer=setTimeout(()=>{cascade('search');},220);
}


export function doFilter(){
  const fv=id=>document.getElementById('f-'+id).value;
  const pmin=parseFloat(document.getElementById('f-pmin').value)||0;
  const pmax=parseFloat(document.getElementById('f-pmax').value)||Infinity;
  const q=document.getElementById('search-input').value.toLowerCase().trim();

  const macro=macroSel();
  // Con query attiva il pool parte dal motore rankizzato (thesaurus +
  // rilevanza). Al CAMBIO di query la PERTINENZA comanda: il sort per colonna
  // (default «codice») viene azzerato, altrimenti seppellirebbe i risultati
  // migliori a pagina 2; l'utente può sempre ri-ordinare cliccando l'intestazione.
  // Query svuotata ⇒ si torna all'ordine del prezzario.
  if(q!==S._lastQuery){
    S._lastQuery=q;
    S.sortCol=q?null:'codice';
    S.sortDir=1;
    document.querySelectorAll('th.sortable').forEach(t=>t.classList.remove('sort-asc','sort-desc'));
  }
  let pool=S.allRows;
  if(q){
    if(window.searchRows) pool=window.searchRows(S.allRows,q);
    else pool=S.allRows.filter(r=>{
      // haystack normalizzato: rimuove spazi multipli per matchare "fg16or16 6mm" anche se scritto diverso
      const h=normSearch(r.codice+' '+r.desc_short+' '+r.declaratoria+' '+r.keywords+' '+r.settore+' '+r.materia+' '+r.tipologia);
      return q.split(/\s+/).every(t=>h.includes(normSearch(t)));
    });
  }
  S.filtered=pool.filter(r=>{
    if(macro&&!(r.macro||[]).includes(macro)) return false;
    if(fv('reg')&&r.regione!==fv('reg')) return false;
    if(fv('anno')&&r.anno!==fv('anno')) return false;
    if(fv('tema')&&r.tematica!==fv('tema')) return false;
    if(fv('disc')&&r.disciplina!==fv('disc')) return false;
    if(fv('sis')&&r.sistema!==fv('sis')) return false;
    if(fv('mat')&&r.materia!==fv('mat')) return false;
    if(fv('att')&&r.attivita!==fv('att')) return false;
    if(fv('um')&&r.um!==fv('um')) return false;
    if(r.prezzo<pmin||r.prezzo>pmax) return false;
    return true;
  });

  if(S.sortCol){
    const col=S.sortCol,dir=S.sortDir;
    S.filtered.sort((a,b)=>{
      let av=a[col],bv=b[col];
      if(typeof av==='number') return(av-bv)*dir;
      return String(av||'').localeCompare(String(bv||''),'it')*dir;
    });
  }
  // Selezione = "carrello" persistente: NON rimuovere mai automaticamente.
  // Le voci restano selezionate anche cambiando prezzario o filtro;
  // si tolgono solo deselezionandole esplicitamente.
  S.page=1; render();
  updateFiltriBtnLabel();
}

// Conta i filtri attivi (macro, solo materiale, i campi della griglia, il prezzo)
// per l'etichetta del bottone "Filtri ▾" — così il drawer può restare chiuso di
// default senza nascondere ALL'UTENTE quanti filtri sta applicando.
export function countActiveFiltri(){
  let n=0;
  if(macroSel()) n++;
  FILTER_ORDER.forEach(id=>{ const el=document.getElementById('f-'+id); if(el && el.value) n++; });
  const pmin=document.getElementById('f-pmin'), pmax=document.getElementById('f-pmax');
  if((pmin&&pmin.value)||(pmax&&pmax.value)) n++;
  return n;
}
export function updateFiltriBtnLabel(){
  const btn=document.getElementById('filtri-btn');
  if(!btn) return;
  const n=countActiveFiltri();
  btn.textContent = n>0 ? `Filtri · ${n} attiv${n===1?'o':'i'} ▾` : 'Filtri ▾';
  btn.classList.toggle('has-active', n>0);
}

export function resetFilters(){
  sessionStorage.removeItem(MACRO_KEY); // macrocategoria compresa nel reset
  FILTER_ORDER.forEach(id=>document.getElementById('f-'+id).value='');
  document.getElementById('f-pmin').value='';
  document.getElementById('f-pmax').value='';
  document.getElementById('search-input').value='';
  const mini=document.getElementById('filter-mini-search');
  if(mini){ mini.value=''; filterMiniSearch(''); }
  buildFilters(); doFilter();
}

// Mini-ricerca dentro i filtri: nasconde i gruppi il cui nome non combacia
export function filterMiniSearch(q){
  const nq=normSearch(q);
  document.querySelectorAll('#filter-bar .fg').forEach(fg=>{
    const label=normSearch(fg.querySelector('label')?.textContent||'');
    const fname=normSearch(fg.dataset.fname||'');
    const match=!nq || label.includes(nq) || fname.includes(nq);
    fg.classList.toggle('hidden-filter',!match);
  });
}


// ══════════════════════════════════════════════════════════════
// SIDEBAR RENDER
// ══════════════════════════════════════════════════════════════
export function itemTipo(item){
  // un prezzario è "privato" se esplicitamente marcato, o se la regione non è riconosciuta
  if(item.tipo) return item.tipo;
  return (item.regione && item.regione!=='Sconosciuta') ? 'pubblico' : 'privato';
}

// Etichetta della striscia sidebar COLLASSATA: mostra il prezzario attivo (non
// più il generico "Prezzari") — così si vede su cosa si sta lavorando anche a
// sidebar chiusa, senza doverla riaprire.
export function activePrezzarioLabel(){
  const item=S.archive[S.active];
  if(!item) return 'Prezzari';
  if(item.regione && item.regione!=='Sconosciuta') return item.anno&&item.anno!=='—'?`${item.regione} ${item.anno}`:item.regione;
  return item.filename||'Prezzari';
}
