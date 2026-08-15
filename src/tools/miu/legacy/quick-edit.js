/* μ (Prezzi) legacy — modifica rapida di una voce del computo, con mini-ricerca sul prezzario.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { cmpEditAnalisiFromCart, cmpEditFromCart } from './compositore.js'
import { phiDescFull } from './import-distinte.js'
import { S } from './stato.js'
import { refreshCartOverlayIfOpen, updateCartInfo } from './computo-overlay.js'
import { commitRowToElencoPrezzi } from './elenco-prezzi.js'
import { esc, fmt, toast } from './index.js'
import { render, rowKey } from './render.js'
// Valorizzazione del carrello = Computo Metrico Estimativo: importo = prezzo × quantità
// ── Ricerca nel Computo Metrico: filtra le righe a video per codice/descrizione/
// categoria senza ricostruire l'overlay (mantiene il focus mentre digiti). I totali
// restano sull'intero computo (la ricerca serve a TROVARE, non a sotto-totalizzare). ──
// Modifica una voce COMPOSTA già nel computo: riapre il Compositore (o l'Analisi
// Prezzi) con la voce caricata; il salvataggio AGGIORNA la stessa voce.
// ── MODIFICA RAPIDA di una voce già nel computo ───────────────────────────────
// L'editor veloce cambia SOLO descrizione/U.M./prezzo della voce inserita, con un
// vero «Salva modifiche» — niente Compositore, niente ricomposizione da zero. Il
// Compositore/Analisi Prezzi restano raggiungibili dal piede per i casi avanzati.
export let _qeKey=null;
export let _qeSearchTimer=null;   // debounce della ricerca inline
export let _qeResults=[];         // risultati correnti della mini-ricerca, indicizzati per qePickRow(j)
export let _qePickedRow=null;     // riga di prezzario scelta, in attesa di conferma su Salva
export function openQuickEdit(key){
  const it=S.custom.get(key);
  if(!it){ toast('Qui si modificano le voci del computo. Le voci di prezzario a listino restano invariate: aggiungile al computo per poterle editare.','warn'); return; }
  closeQuickEdit();
  _qeKey=key;
  const hasAP=!!it.analisiPrezzi;
  const ek=key.replace(/'/g,"\\'");
  const ov=document.createElement('div');
  ov.id='quickedit-overlay'; ov.className='overlay open'; ov.style.zIndex='10060';
  ov.onclick=(e)=>{ if(e.target===ov) closeQuickEdit(); };
  ov.innerHTML=`<div id="qe-box">
    <div class="qe-hd"><h3>✎ Modifica voce</h3>${it.codice?`<span class="qe-code">${esc(it.codice)}</span>`:'<span class="qe-code">composta</span>'}<span class="cmp-sp"></span><button class="cmp-close" onclick="closeQuickEdit()">Esc ✕</button></div>
    <div class="qe-body">
      <label class="qe-f"><span>Descrizione breve</span><input id="qe-breve" value="${esc(it.desc_short||'')}"></label>
      <label class="qe-f"><span>Descrizione estesa</span><textarea id="qe-estesa" rows="6">${esc(it.declaratoria||'')}</textarea></label>
      <div class="qe-row">
        <label class="qe-f qe-sm"><span>U.M.</span><input id="qe-um" value="${esc(it.um||'')}"></label>
        <label class="qe-f qe-sm"><span>Prezzo €</span><input id="qe-prezzo" type="number" step="0.01" min="0" value="${it.prezzo!=null?it.prezzo:''}" ${hasAP?'disabled':''}></label>
      </div>
      ${hasAP?`<div class="qe-note">Il prezzo è calcolato dall'Analisi Prezzi. <button class="qe-link" onclick="closeQuickEdit();cmpEditAnalisiFromCart('${ek}')">Apri Analisi Prezzi →</button></div>`:`
      <div class="qe-f qe-search">
        <span>Cerca nel prezzario (sostituisce i campi sopra)</span>
        <input id="qe-search-q" placeholder="Cerca per codice o descrizione…" oninput="qeSearchInline()">
        <div id="qe-search-res"></div>
      </div>`}
    </div>
    <div class="qe-ft">
      <button class="qe-adv" onclick="closeQuickEdit();cmpEditFromCart('${ek}')" title="Apri il Compositore completo (famiglia, caratteristiche…) per rifare la voce">Compositore…</button>
      <span class="cmp-sp"></span>
      <button class="qe-cancel" onclick="closeQuickEdit()">Annulla</button>
      <button class="qe-save ehb-btn-fam-create" onclick="quickEditSave()">Salva modifiche</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  document.addEventListener('keydown', _qeKeydown, true);
  setTimeout(()=>{ const b=document.getElementById('qe-breve'); if(b){ b.focus(); b.select(); } },0);
}
export function _qeKeydown(e){
  if(e.key==='Escape'){ e.stopPropagation(); closeQuickEdit(); }
  else if((e.ctrlKey||e.metaKey) && e.key==='Enter'){ e.stopPropagation(); quickEditSave(); }
}
export function closeQuickEdit(){
  const ov=document.getElementById('quickedit-overlay'); if(ov) ov.remove();
  document.removeEventListener('keydown', _qeKeydown, true);
  clearTimeout(_qeSearchTimer); _qeSearchTimer=null;
  _qeResults=[]; _qePickedRow=null;
  _qeKey=null;
}
// Mini-ricerca nel prezzario dentro la Modifica rapida: stesso motore (window.searchRows
// su S.allRows) e stesso pattern inline della ricerca nella distinta — il pick NON
// scrive subito in S.custom, riempie solo i campi del modulo: la conferma resta unica
// su «Salva modifiche», così Annulla resta un vero undo anche per un pick.
export function qeSearchInline(){
  clearTimeout(_qeSearchTimer);
  _qeSearchTimer=setTimeout(()=>{
    const inp=document.getElementById('qe-search-q');
    const box=document.getElementById('qe-search-res');
    if(!inp||!box) return;
    const q=inp.value.trim();
    if(!q){ box.innerHTML=''; _qeResults=[]; return; }
    if(!S.allRows || !S.allRows.length){
      box.innerHTML=`<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nessun prezzario caricato: apri un prezzario per cercare qui.</div>`;
      _qeResults=[];
      return;
    }
    const results = window.searchRows ? window.searchRows(S.allRows, q).slice(0,40) : [];
    _qeResults=results;
    if(!results.length){
      box.innerHTML=`<div style="font-size:11px;color:var(--text3);padding:6px 2px">Nessun risultato</div>`;
      return;
    }
    box.innerHTML = `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);padding:4px 2px">${results.length} risultati</div>`+
      `<div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:6px">`+
      results.map((r,j)=>`<div onclick="qePickRow(${j})" style="padding:5px 9px;cursor:pointer;border-bottom:1px solid var(--border);font-size:10.5px"
          onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
          <span style="font-family:var(--mono);color:var(--accent);font-weight:700">${esc(r.codice)}</span>
          ${r.prezzo>0?`<span style="float:right;font-family:var(--mono);color:var(--text2)">€ ${fmt(r.prezzo)}/${esc(r.um||'')}</span>`:''}
          <div style="color:var(--text2);margin-top:1px;line-height:1.3">${esc(phiDescFull(r))}</div>
        </div>`).join('') + `</div>`;
  },180);
}
export function qePickRow(j){
  const row=_qeResults[j];
  if(!row || !_qeKey) return;
  const breveEl=document.getElementById('qe-breve');
  const estesaEl=document.getElementById('qe-estesa');
  const umEl=document.getElementById('qe-um');
  const prezzoEl=document.getElementById('qe-prezzo');
  if(breveEl) breveEl.value = row.desc_short||'';
  if(estesaEl) estesaEl.value = row.declaratoria||row.desc_short||'';
  if(umEl) umEl.value = row.um||'';
  if(prezzoEl && !prezzoEl.disabled) prezzoEl.value = (row.prezzo>0?row.prezzo:'');
  _qePickedRow = row;
  const q=document.getElementById('qe-search-q'); if(q) q.value='';
  const box=document.getElementById('qe-search-res'); if(box) box.innerHTML='';
  toast(`Voce "${row.codice}" caricata nel modulo — premi «Salva modifiche» per confermare`,'ok');
}
export function quickEditSave(){
  const key=_qeKey, it=key&&S.custom.get(key);
  if(!it){ closeQuickEdit(); return; }
  const breve=(document.getElementById('qe-breve').value||'').trim();
  const estesa=(document.getElementById('qe-estesa').value||'').trim();
  const um=(document.getElementById('qe-um').value||'').trim();
  const prezzoEl=document.getElementById('qe-prezzo');
  it.desc_short = breve || it.desc_short;
  it.declaratoria = estesa || breve || it.declaratoria;
  it.um = um;
  if(prezzoEl && !prezzoEl.disabled){ const p=parseFloat(prezzoEl.value); it.prezzo = isFinite(p) ? p : null; }
  // Se l'utente ha scelto una voce dalla mini-ricerca, la voce dell'Elenco Prezzi si aggancia
  // al catalogo esattamente come commitRowToElencoPrezzi (stesso source/_ref): da qui in poi
  // si comporta come una qualunque voce di prezzario. Se non c'è stato nessun pick, il
  // comportamento resta identico a prima (puro editing manuale).
  if(_qePickedRow){
    const row=_qePickedRow;
    it.codice = row.codice;
    it.regione = row.regione;
    it.anno = row.anno;
    it.source = 'prezzario';
    it._ref = rowKey(row);
  }
  S.custom.set(key, it);
  closeQuickEdit();
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
  toast('Voce aggiornata','ok');
}
