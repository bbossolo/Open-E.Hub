/* μ (Prezzi) legacy — computi SALVATI: più computi per progetto, con menu di scelta.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { S } from './stato.js'
import { commitRowToElencoPrezzi } from './elenco-prezzi.js'
import { esc, toast } from './index.js'
import { render, rowKey } from './render.js'
// ── CARRELLI ALTERNATIVI (salva/carica) ─────────────────────────────────────
// Sorgenti diverse (distinta importata, selezione manuale, prezzari diversi) → carrelli
// distinti, salvabili e richiamabili. Persistiti in localStorage.
export function loadCarts(){ try{ return JSON.parse(localStorage.getItem('miu:carts')||'[]'); }catch(e){ return []; } }
export function persistCarts(){ try{ localStorage.setItem('miu:carts', JSON.stringify(MIU_CARTS)); }catch(e){} }
export let MIU_CARTS = loadCarts();
// Le voci composte (S.custom) vengono serializzate insieme alle reali.
// Estratta da saveCurrentCart perché serve anche in automatico (import di una
// distinta): lì non c'è un campo nome da leggere dal DOM.
export function pushCart(name){
  MIU_CARTS.push({ id:'c'+Date.now(), name, sel:[...S.sel], qty:JSON.parse(JSON.stringify(S.qty)),
    custom:[...S.custom.entries()], categoria:JSON.parse(JSON.stringify(S.categoria)), n:S.sel.size+S.custom.size, ts:Date.now() });
  persistCarts(); renderCartsList();
}
export function saveCurrentCart(){
  if(!S.sel.size && !S.custom.size){ toast('Computo vuoto: niente da salvare','warn'); return; }
  const inp=document.getElementById('cart-save-name');
  const name=((inp&&inp.value)||'').trim() || ('Computo '+(MIU_CARTS.length+1));
  pushCart(name);
  if(inp) inp.value=''; toast('Computo salvato: '+name,'ok');
}
export function loadCartById(id){
  const c=MIU_CARTS.find(x=>x.id===id); if(!c) return;
  S.qty=JSON.parse(JSON.stringify(c.qty||{}));
  S.custom=new Map(JSON.parse(JSON.stringify(c.custom||[])));
  S.categoria=JSON.parse(JSON.stringify(c.categoria||{}));
  S.sel=new Set();               // il computo è tutto nell'Elenco Prezzi (S.custom)
  migrateLegacySel(c);           // computi salvati prima del modello Elenco Prezzi: sel → copie
  render(); closeCartsMenu(); toast('Computo caricato: '+c.name,'ok');
}
// Converte le voci REFERENZIATE (vecchi sel: array di rowKey + qty/categoria a chiave
// rowKey, dai .ehub/computi salvati o dagli import legacy) in COPIE dell'Elenco Prezzi
// (S.custom, chiave 'ep:'). Così l'intero computo è uniforme e modificabile.
export function migrateLegacySel(src){
  const sel=(src&&src.sel)||[];
  if(!sel.length) return;
  const byKey=new Map();
  for(const r of ((src&&src.rows)||[])) if(r) byKey.set(rowKey(r), r);
  for(const it of S.archive){ if(it.loaded===true) for(const r of it.rows){ const rk=rowKey(r); if(!byKey.has(rk)) byKey.set(rk,r); } }
  sel.forEach(rk=>{
    const r=byKey.get(rk); if(!r) return;
    const ek=commitRowToElencoPrezzi(r);
    if(S.qty[rk]){ S.qty[ek]=S.qty[rk]; delete S.qty[rk]; }
    if(S.categoria[rk]){ S.categoria[ek]=S.categoria[rk]; delete S.categoria[rk]; }
  });
}
export function deleteCartById(id){
  const idx=MIU_CARTS.findIndex(x=>x.id===id); const removed=MIU_CARTS[idx];
  MIU_CARTS=MIU_CARTS.filter(x=>x.id!==id); persistCarts(); renderCartsList();
  if(removed) window.ehbFeedback?.undoToast(`Computo «${removed.name}» eliminato`, ()=>{
    MIU_CARTS.splice(idx,0,removed); persistCarts(); renderCartsList();
  });
}
export function renderCartsList(){
  const box=document.getElementById('carts-list'); if(!box) return;
  if(!MIU_CARTS.length){ box.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px 2px">Nessun computo salvato.</div>'; return; }
  box.innerHTML=MIU_CARTS.slice().sort((a,b)=>b.ts-a.ts).map(c=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-top:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
        <div style="font-size:10px;color:var(--text3)">${c.n||(c.sel?c.sel.length:0)} voci · ${new Date(c.ts).toLocaleDateString('it')}</div>
      </div>
      <button onclick="loadCartById('${c.id}')" style="background:var(--accent);border:none;color:var(--accent-text,#fff);border-radius:6px;padding:5px 11px;font-size:11px;cursor:pointer">Carica</button>
      <button onclick="deleteCartById('${c.id}')" title="Elimina" style="background:var(--danger-light);border:1px solid var(--danger);color:var(--danger);border-radius:6px;width:26px;height:26px;font-size:13px;cursor:pointer">✕</button>
    </div>`).join('');
}
export function openCartsMenu(){
  closeCartsMenu();
  const ov=document.createElement('div'); ov.id='carts-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:520px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <div style="flex:1"><div style="font-weight:700;font-size:15px">Computi alternativi</div>
      <div style="font-size:11px;color:var(--text3)">Salva il computo attuale o caricane uno salvato</div></div>
      <button onclick="closeCartsMenu()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)">×</button>
    </div>
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;gap:8px">
      <input id="cart-save-name" placeholder="Nome computo (es. Variante A, Prezzario 2026…)" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px">
      <button onclick="saveCurrentCart()" style="background:var(--accent);border:none;color:var(--accent-text,#fff);border-radius:7px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Salva attuale</button>
    </div>
    <div id="carts-list" style="overflow:auto;padding:6px 20px 16px"></div>
  </div>`;
  ov.addEventListener('click',e=>{ if(e.target===ov) closeCartsMenu(); });
  document.body.appendChild(ov); renderCartsList();
}
export function closeCartsMenu(){ const o=document.getElementById('carts-overlay'); if(o) o.remove(); }
