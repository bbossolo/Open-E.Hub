// μ (Prezzi) legacy — modulo import-distinte.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { S, _phiSearchTimer, setPhiPresetQty, setPhiSearchTimer } from './stato.js'
import {
  PHI_KIND_FAMIGLIA, PHI_TEMA, _distGroups, _distItems, _distMeta, _phiChoice, _phiMatches, _phiResults,
  clearPhiDraft, closePhiDistinta, cmpAPByCodice, cmpAddCustom, commitRowToElencoPrezzi, esc, fmt, normSearch,
  openComponi, refreshCartOverlayIfOpen, render, savePhiDraft, toast, updateCartInfo
} from './index.js'

function phiChoiceHtml(row){
  if(!row) return `<span style="color:var(--danger);font-size:11.5px;font-style:italic">nessuna voce — cerca qui sotto</span>`;
  return `<div style="background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.3);border-radius:6px;padding:5px 8px">
    <span style="font-family:var(--mono);font-size:10.5px;color:#22d3ee;font-weight:700">${esc(row.codice)}</span>
    ${row.prezzo>0?`<span style="float:right;font-family:var(--mono);font-size:10.5px;color:var(--text2)">€ ${fmt(row.prezzo)}/${esc(row.um||'')}</span>`:''}
    <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.3">${esc(phiDescFull(row))}</div>
  </div>`;
}

function phiComponiRow(i){
  // i = indice di GRUPPO: si compone con la quantità TOTALE del gruppo (tutti i quadri),
  // non solo del primo misurato.
  const g=_distGroups[i]; if(!g) return;
  const item={ ...g.rep, qty:g.quantita };
  closePhiDistinta();
  const famigliaId = PHI_KIND_FAMIGLIA[item.kind];
  if(famigliaId){
    openComponi(null, famigliaId);
  } else {
    openComponi(null, null);
    cmpAddCustom(item.desc);
  }
  setPhiPresetQty((item.qty>0)?item.qty:null);
}

function phiConfirmDistinta(){
  clearPhiDraft(_distMeta.source) // entrata nel computo: la bozza di revisione ha fatto il suo lavoro
  // MERGE nel computo attivo: le occorrenze si sommano per chiave/quadro (non si sovrascrivono
  // più), e il match si sceglie una volta per materiale (raggruppamento sopra). Chi vuole un
  // computo a sé per questo import può sempre svuotare/salvare prima («Salva» / «Svuota»).
  let added=0, skipped=0, occorrenze=0;
  document.querySelectorAll('#phi-overlay .phi-chk').forEach(chk=>{
    if(!chk.checked) return;
    const gi=+chk.dataset.i;
    const g=_distGroups[gi];
    const row=_phiChoice[gi];
    if(!row || !g){ skipped++; return; }
    // Un GRUPPO = un materiale, ma nel computo torna a essere una riga per QUADRO: il match
    // si è scelto una volta, la quantità resta divisa per quadro (Sottocategoria).
    g.membri.forEach(mi=>{
      const item=_distItems[mi];
      // Le linee Ampère portano il QUADRO da cui derivano: ogni quadro è una voce a sé
      // (scope) e diventa la SOTTOCATEGORIA, così il computo resta raggruppato per quadro
      // invece di essere un listone unico.
      const quadro=(item.quadro||'').trim();
      const key=commitRowToElencoPrezzi(row, null, quadro||undefined);
      // Più occorrenze dello stesso quadro sommano la quantità invece di scartarsi a vicenda.
      const prima=(S.qty[key]&&S.qty[key].qty)||0;
      S.qty[key]={ qty:prima+item.qty, um:item.um, source:_distMeta.source };
      if(quadro) setCategoriaLivello(key, 2, quadro); // Sottocategoria = quadro elettrico
      occorrenze++;
    });
    added++;
  });
  closePhiDistinta();
  if(added){
    const src = _distMeta.source==='ampere' ? 'da Ampère' : 'dalla distinta';
    updateCartInfo(); refreshCartOverlayIfOpen(); render();
    const quadri = new Set(_distItems.map(it=>(it&&it.quadro||'').trim()).filter(Boolean));
    const perQuadro = quadri.size ? ` · raggruppate in ${quadri.size} quadr${quadri.size===1?'o':'i'} (Sottocategoria)` : '';
    toast(`${added} voci (${occorrenze} occorrenze) aggiunte al computo ${src}${perQuadro}${skipped?` · ${skipped} senza voce, saltate`:''}`,'ok');
  } else {
    toast('Nessuna voce con prezzario associato selezionata','warn');
  }
}

function phiDescFull(r){
  const short=String(r.desc_short||'').replace(/[\r\n]+/g,' ').trim();
  let decl=String(r.declaratoria||'').replace(/[\s]+/g,' ').trim();
  const m=decl.search(/\b(forni|posa|compres|installazion|in opera|dato in opera)/i);
  if(m>0) decl=decl.slice(0,m).trim().replace(/[ .,;:–—-]+$/,'');
  if(decl.length>140) decl=decl.slice(0,138).replace(/[ .,;:]+\S*$/,'')+'…'; // niente muri di testo
  if(short && decl){
    const ls=short.toLowerCase(), ld=decl.toLowerCase();
    if(ls.includes(ld)) return short;          // la breve contiene già il prodotto
    if(ld.includes(ls)) return decl;           // il prodotto contiene già la breve
    return decl+' — '+short;                    // prodotto + variante
  }
  return short||decl;
}

function phiDraftKey(source){ return 'miu:phi-draft:'+source; }

function phiMatchRows(item){
  const tutto = phiPool(item);
  if(!tutto || !tutto.length) return [];
  const opere = window.isOperaCompiutaRow ? tutto.filter(r => window.isOperaCompiutaRow(r)) : [];
  const trovate = opere.length ? phiScore(item, opere) : [];
  return trovate.length ? trovate : phiScore(item, tutto);
}

function phiPick(i,j){
  const row=_phiResults[i] && _phiResults[i][j];
  if(!row) return;
  _phiChoice[i]=row;
  const ch=document.querySelector(`#phi-overlay .phi-choice[data-i="${i}"]`);
  if(ch) ch.innerHTML=phiChoiceHtml(row);
  const inp=document.querySelector(`#phi-overlay .phi-q[data-i="${i}"]`);
  if(inp) inp.value='';
  const box=document.querySelector(`#phi-overlay .phi-res[data-i="${i}"]`);
  if(box) box.innerHTML='';
  const chk=document.querySelector(`#phi-overlay .phi-chk[data-i="${i}"]`);
  if(chk) chk.checked=true;
  savePhiDraft();
}

function phiPool(item){
  const all = S.allRows || [];
  if(S._phiPoolSrc !== all){ S._phiPoolSrc = all; S._phiElec = null; S._phiCond = null; }
  if(item && item.kind === 'cavo'){
    if(!S._phiElec){ const e = all.filter(r => r.tematica === PHI_TEMA); S._phiElec = e.length ? e : all; }
    return S._phiElec;
  }
  if(!S._phiCond){
    const c = all.filter(r => r.tematica === PHI_TEMA ||
      (window.isConduit && window.isConduit((r.desc_short||'')+' '+(r.declaratoria||''))));
    S._phiCond = c.length ? c : all;
  }
  return S._phiCond;
}

function phiScore(item, pool){
  // Cassette/allacci utenza non hanno sigla/sezione da confrontare — stesso
  // ricerca testuale generica sulla descrizione.
  if(item.kind!=='cavo' && item.kind!=='tubo'){
    return window.searchRows ? window.searchRows(pool, item.desc).slice(0,8) : [];
  }
  const isLenUm=u=>/^(m|ml|mt|mtl)$/.test(String(u||'').trim().toLowerCase());
  const scored=[];
  for(const r of pool){
    let score=0;
    if(item.kind==='cavo'){
      // scorer cavi dall'engine (testato): sezione tollerante agli spazi ("3 x 10"),
      // sigla fuzzy (FG16OR16≡FG16OR) e penalità per cavi di TIPO diverso.
      score = window.scoreCable ? window.scoreCable(item, r) : 0;
      if(score<=0) continue;
    } else {
      // tubo / cavidotto / passerella — scorer condotti dall'engine (testato):
      // lavora sul testo-PRODOTTO (no boilerplate di posa, no campi categoria),
      // scarta i cavi e premia l'accordo di famiglia + dimensione.
      score = window.scoreConduit ? window.scoreConduit(item, r) : 0;
      if(score<=0) continue;
    }
    scored.push({r, score});
  }
  scored.sort((a,b)=> b.score-a.score || (b.r.prezzo>0?1:0)-(a.r.prezzo>0?1:0) || String(a.r.desc_short).length-String(b.r.desc_short).length);
  return scored.slice(0,8).map(x=>x.r);
}

function phiSearchInline(i){
  clearTimeout(_phiSearchTimer);
  setPhiSearchTimer(setTimeout(()=>{
    const inp=document.querySelector(`#phi-overlay .phi-q[data-i="${i}"]`);
    const box=document.querySelector(`#phi-overlay .phi-res[data-i="${i}"]`);
    if(!inp||!box) return;
    const q=inp.value.trim().toLowerCase();
    let results;
    if(!q){
      results=_phiMatches[i]||[]; // suggeriti automatici
    } else {
      const toks=q.split(/\s+/).map(t=>normSearch(t)).filter(Boolean);
      const run=(pool)=>pool.filter(r=>{
        const h=normSearch(r.codice+' '+r.desc_short+' '+r.declaratoria+' '+r.keywords+' '+r.settore+' '+r.materia+' '+r.tipologia);
        return toks.every(t=>h.includes(t));
      }).map(r=>{
        // i token trovati nel testo-PRODOTTO (desc + testa declaratoria) contano
        // di più: così "passerella" come prodotto batte "passerella" citata nella posa.
        const prod=window.productText?window.productText(r.desc_short,r.declaratoria):normSearch(r.desc_short+' '+r.declaratoria);
        const ph=toks.filter(t=>prod.includes(t)).length;
        return {r,ph,len:String(r.desc_short||'').length};
      }).sort((a,b)=> b.ph-a.ph || a.len-b.len).map(x=>x.r); // nessun limite: è un mini price-list
      // Cerca prima nel pool ristretto per tipo voce (veloce); se non trova, tutto.
      const it = (_distGroups[i] && _distGroups[i].rep) || null;
      const pool = phiPool(it);
      results = run(pool);
      var _phiSearchAll = false;
      if(!results.length && pool !== S.allRows){ results = run(S.allRows); _phiSearchAll = true; }
    }
    _phiResults[i]=results;
    if(!results.length){
      box.innerHTML=`<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nessun risultato${q?'':' — il best-match non ha trovato candidati, prova a cercare'}</div>`;
      return;
    }
    const scope = q ? (_phiSearchAll ? ' · tutto il prezzario' : ' · cavi e condotti') : '';
    const head = q
      ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);padding:4px 2px">${results.length} risultati${scope}</div>`
      : `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);padding:4px 2px">Suggeriti automatici</div>`;
    box.innerHTML = head + `<div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:6px">`+
      results.map((r,j)=>`<div onclick="phiPick(${i},${j})" style="padding:5px 9px;cursor:pointer;border-bottom:1px solid var(--border);font-size:10.5px"
          onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
          <span style="font-family:var(--mono);color:#22d3ee;font-weight:700">${esc(r.codice)}</span>
          ${r.prezzo>0?`<span style="float:right;font-family:var(--mono);color:var(--text2)">€ ${fmt(r.prezzo)}/${esc(r.um||'')}</span>`:''}
          <div style="color:var(--text2);margin-top:1px;line-height:1.3">${esc(phiDescFull(r))}</div>
        </div>`).join('') + `</div>`;
  },180));
}

export {
  phiChoiceHtml, phiComponiRow, phiConfirmDistinta, phiDescFull, phiDraftKey, phiMatchRows, phiPick, phiPool,
  phiScore, phiSearchInline
}
