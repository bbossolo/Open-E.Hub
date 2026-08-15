// μ (Prezzi) legacy — modulo misure.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { S } from './stato.js'
import {
  MIS_OPEN, cartImpCellHtml, cartPatchTotals, cartQtyBadgeHtml, cartRows, elencoKeyOf, esc, fmt,
  parseNum, refreshCartOverlayIfOpen, removeFromCart, setQtyManual, updateCartInfo
} from './index.js'

function misAddRiga(key){
  const idx=misMutAddRiga(key);
  misRerenderPanel(key, `[data-mis-input="${idx}:descrizione"]`);
  updateCartInfo();
}

function misCell(r,key){
  const q=S.qty[elencoKeyOf(r)]; // la misura vive sulla COPIA nell'Elenco Prezzi
  const val=q?String(q.qty).replace('.',','):'';
  const src=q
    ? (q.source==='manual'
        ? `<span class="mis-src man" title="Quantità inserita manualmente">✎</span>`
        : `<span class="mis-src imp" title="Quantità importata da una distinta">⇪</span>`)
    : '';
  return `<input class="qty-in" type="text" inputmode="decimal" value="${esc(val)}" placeholder="—"
            onclick="event.stopPropagation()" ondblclick="event.stopPropagation()"
            onchange="setQtyManual('${esc(key)}',this.value,'${esc(r.um||'')}')"
            title="Quantità per le Misurazioni (Invio per confermare)">${src}`;
}

function misDropRigheVuote(key){
  const q=S.qty[key]; if(!q||!q.misurazioni) return;
  q.misurazioni=q.misurazioni.filter(m=>(m.descrizione||'').trim()||m.l1!=null||m.l2!=null||m.h!=null||m.n!=null);
  if(!q.misurazioni.length) delete q.misurazioni;
  else q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  if(!(q.qty>0) && !(q.misurazioni&&q.misurazioni.length)) delete S.qty[key];
}

function misKeydown(ev, key, idx, campo){
  if(ev.key==='Enter'){
    ev.preventDefault();
    ev.target.blur(); // fa scattare l'onchange (misSetCampo) prima di muovere il focus
    const q=S.qty[key], n=(q&&q.misurazioni)?q.misurazioni.length:0;
    if(idx>=n-1) misAddRiga(key);
    else {
      const panel=misPanelRowEl(key);
      const inp=panel&&panel.querySelector(`[data-mis-input="${idx+1}:${campo}"]`);
      if(inp){ inp.focus(); if(inp.select) inp.select(); }
    }
  } else if(ev.key==='Escape'){
    ev.preventDefault(); ev.stopPropagation();
    if(MIS_OPEN.has(key)) misToggle(key);
    const tr=misVoceRowEl(key);
    const btn=tr&&tr.querySelector('[data-cell="mis"] button');
    if(btn) btn.focus();
  }
}

function misMutAddRiga(key){
  const q=S.qty[key]||{ qty:0, um:'', source:'manual' };
  q.misurazioni=q.misurazioni||[];
  q.misurazioni.push({ descrizione:'', l1:null, l2:null, h:null, n:null, quantita:0 });
  S.qty[key]=q;
  MIS_OPEN.add(key);
  return q.misurazioni.length-1;
}

function misPanelHtml(key){
  if(!MIS_OPEN.has(key)) return '';
  const ek=key.replace(/'/g,"\\'"); // stessa cautela di removeFromCart: chiavi con apostrofi negli onclick
  const q=S.qty[key]||{};
  const righe=q.misurazioni||[];
  const numIn=(idx,campo,val,w,title)=>`<input type="text" inputmode="decimal" value="${val!=null?String(val).replace('.',','):''}"
    data-mis-input="${idx}:${campo}" onfocus="this.select()"
    onclick="event.stopPropagation()" onchange="misSetCampo('${ek}',${idx},'${campo}',this.value)"
    onkeydown="misKeydown(event,'${ek}',${idx},'${campo}')"
    style="width:${w}px;text-align:right;font-size:10px;font-family:var(--mono);padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)"
    ${title?`title="${esc(title)}"`:''}>`;
  const rowsHtml=righe.map((m,i)=>`<tr>
      <td style="padding:2px 4px"><input type="text" value="${esc(m.descrizione||'')}" placeholder="descrizione (es. piano terra)…"
        data-mis-input="${i}:descrizione"
        onclick="event.stopPropagation()" onchange="misSetCampo('${ek}',${i},'descrizione',this.value)"
        onkeydown="misKeydown(event,'${ek}',${i},'descrizione')"
        style="width:100%;font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)"></td>
      <td style="padding:2px 4px">${numIn(i,'n',m.n,38,'Numero di parti uguali — negativo = detrazione')}</td>
      <td style="padding:2px 4px">${numIn(i,'l1',m.l1,44)}</td>
      <td style="padding:2px 4px">${numIn(i,'l2',m.l2,44)}</td>
      <td style="padding:2px 4px">${numIn(i,'h',m.h,44)}</td>
      <td data-mis-qt style="padding:2px 4px;text-align:right;font-family:var(--mono);font-size:10.5px">${fmt(m.quantita||0)}</td>
      <td style="padding:2px 4px"><button class="ehb-btn-fam-danger-ghost" onclick="misRemoveRiga('${ek}',${i})" title="Rimuovi riga"
        style="padding:2px 5px;font-size:11px">✕</button></td>
    </tr>`).join('');
  const tot=window.sommaMisurazioni?window.sommaMisurazioni(righe):0;
  return `<tr class="mis-panel-row" data-mis-key="${esc(key)}"><td colspan="6" style="padding:6px 4px 10px 24px;background:var(--surface2)">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:4px">Computo metrico (N×L1×L2×H)</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="font-size:8.5px;text-transform:uppercase;color:var(--text3)">
          <th style="text-align:left;padding:2px 4px">Descrizione</th><th style="padding:2px 4px">N</th><th style="padding:2px 4px">L1</th><th style="padding:2px 4px">L2</th><th style="padding:2px 4px">H</th><th style="padding:2px 4px">Q.tà</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml||'<tr><td colspan="7" style="color:var(--text3);font-size:10px;padding:4px 2px">Nessuna riga di misura.</td></tr>'}</tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <button class="ehb-btn-fam-create-ghost" onclick="misAddRiga('${ek}')" style="padding:3px 8px;font-size:10px">+ riga di misura</button>
        <span style="font-size:9.5px;color:var(--text3)">Invio = nuova riga · Esc = chiudi</span>
        <span style="font-size:10.5px;color:var(--text3)">Totale: <b data-mis-tot style="color:var(--text)">${fmt(tot)}</b></span>
      </div>
    </td></tr>`;
}

function misPanelRowEl(key){
  for(const el of document.querySelectorAll('.mis-panel-row')) if(el.dataset.misKey===key) return el;
  return null;
}

function misPatchDom(key){
  const q=S.qty[key]||{};
  const righe=q.misurazioni||[];
  const panel=misPanelRowEl(key);
  if(panel){
    panel.querySelectorAll('[data-mis-qt]').forEach((cell,i)=>{ if(righe[i]) cell.textContent=fmt(righe[i].quantita||0); });
    const tot=panel.querySelector('[data-mis-tot]');
    if(tot) tot.textContent=fmt(window.sommaMisurazioni?window.sommaMisurazioni(righe):0);
  }
  const tr=misVoceRowEl(key);
  if(tr){
    const custom=S.custom.get(key);
    const qtyCell=tr.querySelector('[data-cell="qty"]');
    if(qtyCell){
      if(custom){
        const inp=qtyCell.querySelector('input'); // input editabile: mai riscriverlo sotto il cursore
        if(inp && document.activeElement!==inp) inp.value=(q.qty>0)?String(q.qty).replace('.',','):'';
      } else qtyCell.innerHTML=cartQtyBadgeHtml(key);
    }
    const impCell=tr.querySelector('[data-cell="imp"]');
    if(impCell){
      const prezzo=custom?(custom.prezzo||0):((cartRows().get(key)||{}).prezzo||0);
      impCell.innerHTML=cartImpCellHtml(prezzo,q);
    }
    const misWrap=tr.querySelector('[data-cell="mis"]');
    if(misWrap) misWrap.innerHTML=misToggleBtn(key);
  }
  cartPatchTotals();
}

function misRemoveRiga(key, idx){
  const q=S.qty[key]; if(!q||!q.misurazioni) return;
  q.misurazioni.splice(idx,1);
  q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  if(!q.misurazioni.length) delete q.misurazioni;
  if(!(q.qty>0) && !(q.misurazioni&&q.misurazioni.length)) delete S.qty[key];
  misRerenderPanel(key); updateCartInfo();
}

function misRerenderPanel(key, focusSel){
  if(!document.getElementById('cart-ov-tbody')){ refreshCartOverlayIfOpen(); return; }
  const old=misPanelRowEl(key);
  const html=misPanelHtml(key);
  if(old){ if(html) old.outerHTML=html; else old.remove(); }
  else if(html){
    const tr=misVoceRowEl(key);
    if(!tr){ refreshCartOverlayIfOpen(); return; }
    tr.insertAdjacentHTML('afterend', html);
  }
  misPatchDom(key);
  if(focusSel){
    const panel=misPanelRowEl(key);
    const inp=panel&&panel.querySelector(focusSel);
    if(inp){ inp.focus(); if(inp.select) inp.select(); }
  }
}

function misSetCampo(key, idx, campo, value){
  const q=S.qty[key]; if(!q||!q.misurazioni||!q.misurazioni[idx]) return;
  const riga=q.misurazioni[idx];
  if(campo==='descrizione') riga.descrizione=value;
  else { const n=parseNum(value); riga[campo]=isFinite(n)?n:null; }
  riga.quantita=window.calcolaRigaMisurazione?window.calcolaRigaMisurazione(riga):0;
  q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  misPatchDom(key); updateCartInfo();
}

function misToggle(key){
  if(MIS_OPEN.has(key)){
    MIS_OPEN.delete(key);
    misDropRigheVuote(key); // la riga auto-creata lasciata vuota non deve restare
    misRerenderPanel(key);
    updateCartInfo();
  } else {
    MIS_OPEN.add(key);
    const q=S.qty[key];
    if(!(q&&q.misurazioni&&q.misurazioni.length)){
      // pannello pronto da compilare al primo clic: prima riga già creata e a fuoco
      misMutAddRiga(key);
      misRerenderPanel(key, '[data-mis-input="0:descrizione"]');
      updateCartInfo();
    } else {
      // righe già presenti: focus sull'ultima, pronti a continuare/correggere
      misRerenderPanel(key, `[data-mis-input="${q.misurazioni.length-1}:descrizione"]`);
    }
  }
}

function misToggleBtn(key){
  const open=MIS_OPEN.has(key);
  const q=S.qty[key];
  const n=(q&&q.misurazioni)?q.misurazioni.length:0;
  const ek=key.replace(/'/g,"\\'");
  const label=n>0?`Misure (${n})`:'Misure';
  return `<button onclick="event.stopPropagation();misToggle('${ek}')" title="${open?'Chiudi':'Apri'} il computo metrico (righe di misura L1×L2×H×N)"
    style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent-text);display:inline-flex;align-items:center;gap:3px;padding:2px 0;margin-top:3px;font-weight:600">
    <span style="display:inline-block;transition:transform .15s;transform:rotate(${open?'90':'0'}deg)">▸</span>${label}
  </button>`;
}

function misVoceRowEl(key){
  const tbody=document.getElementById('cart-ov-tbody'); if(!tbody) return null;
  for(const el of tbody.querySelectorAll('tr.cm-sel-row')) if(el.dataset.key===key) return el;
  return null;
}

export {
  misAddRiga, misCell, misDropRigheVuote, misKeydown, misMutAddRiga, misPanelHtml, misPanelRowEl, misPatchDom,
  misRemoveRiga, misRerenderPanel, misSetCampo, misToggle, misToggleBtn, misVoceRowEl
}
