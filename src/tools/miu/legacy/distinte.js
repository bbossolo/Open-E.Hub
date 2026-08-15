/* μ (Prezzi) legacy — distinta materiale importata (lista cavi Ampère): modale di
   abbinamento voce-per-voce prima di versare nel computo, con bozza persistita.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { phiChoiceHtml, phiComponiRow, phiConfirmDistinta, phiDraftKey, phiMatchRows, phiSearchInline } from './import-distinte.js'
import { S } from './stato.js'
import { rowByKey } from './computo-overlay.js'
import { esc, fmt, toast } from './index.js'
import { rowKey } from './render.js'

// La distinta contiene SOLO cavi e condotti → tutta roba elettrica: la ricerca
// e il best-match si limitano alla tematica "Impianti elettrici e speciali".
// Molto più veloce su prezzari da decine di migliaia di voci, e niente rumore
// (es. "listoni in legno 13x10"). Fallback all'intero prezzario se la tematica è
// vuota (prezzario non classificato) o se la ricerca limitata non trova nulla.
export const PHI_TEMA = 'Impianti elettrici e speciali';
// Pool ristretto per tipo di voce (cache per prezzario):
//  - cavo  → tematica "Impianti elettrici e speciali" (i cavi sono classificati lì);
//  - condotto → voci-condotto (isConduit) + tematica elettrica (le passerelle spesso
//    NON sono classificate come elettriche, quindi serve il filtro geometrico).
// Fallback all'intero prezzario se il sottoinsieme è vuoto.
// Token e scoring di una voce di distinta contro le righe del prezzario attivo.
// Cavi → window.scoreCable · condotti → window.scoreConduit (entrambi engine testati).
//
// OPERE COMPIUTE PRIMA. Un computo non mette a prezzo il rame a piè d'opera: mette il cavo
// FORNITO E POSATO, con manodopera, accessori e sfridi dentro. Agganciarlo a un costo
// elementare di materiale è un errore di computo — il prezzo esce basso e la voce non è
// appaltabile (è quello che succedeva coi cavi da Ampère sul Veneto).
// Ma è una PREFERENZA, non una condanna: se fra le opere compiute non c'è nulla che
// somigli a questo cavo, meglio una voce di materiale che nessuna voce. (Provato: su
// Campania, Friuli e Trento il filtro secco avrebbe restituito «nessun match».)

export let _phiMatches=[];   // per ogni item: suggeriti auto (best-match)
export let _phiResults=[];   // per ogni item: lista risultati correntemente mostrati
export let _phiChoice=[];    // per ogni item: voce di prezzario scelta (row) o null
// Sorgente della distinta a video (oggi: la lista cavi Ampère, con le lunghezze Lc).
// Il modale e il matcher sono generici — cambiano solo l'intestazione e il `source`
// scritto in S.qty, così agganciare una nuova sorgente non richiede un secondo modale.
export let _distItems=[], _distMeta={ source:'', glyph:'', accent:'#22d3ee', title:'Distinta materiale', sub:'' };
export let _distGroups=[]; // ELENCO PREZZI TEMPORANEO: una riga per MATERIALE (identità), quantità sommata sui quadri
// Identità di COSA è una riga di distinta, a prescindere da DOVE (quadro):
// kind+sigla+sezione+descrizione. Il quadro resta nel membro,
// non nell'identità — è lui che deve poter restare raggruppato per il match e diviso nel computo.
export function distItemId(it){ return [it.kind||'',it.sigla||'',it.sezione||'',it.desc||''].join('|'); }
// Raggruppa per IDENTITÀ: lo stesso cavo posato in due quadri diversi è la stessa voce di
// prezzario — il best-match si fa una volta sola sull'elenco prezzi temporaneo, non ripetuto
// per ogni quadro. Editare il match di un gruppo vale per tutte le occorrenze per costruzione.
export function groupPhiItems(items){
  const byKey=new Map(), order=[]
  items.forEach((it,i)=>{
    const k=distItemId(it)
    if(!byKey.has(k)){ byKey.set(k,{ key:k, rep:it, quantita:0, membri:[] }); order.push(k) }
    const g=byKey.get(k)
    g.quantita += (it.qty||0)
    g.membri.push(i)
  })
  return order.map(k=>byKey.get(k))
}
export function savePhiDraft(){
  if(!_distMeta) return;
  const choicesByKey={}
  _distGroups.forEach((g,gi)=>{ if(_phiChoice[gi]) choicesByKey[g.key]=rowKey(_phiChoice[gi]) })
  try{ localStorage.setItem(phiDraftKey(_distMeta.source), JSON.stringify({ choicesByKey, ts:Date.now() })); }catch(e){}
}
export function clearPhiDraft(source){ try{ localStorage.removeItem(phiDraftKey(source)); }catch(e){} }
export function loadPhiDraft(source){ try{ return JSON.parse(localStorage.getItem(phiDraftKey(source))||'null'); }catch(e){ return null; } }
// Lista cavi da un export Ampère: stesse voci-distinta (kind 'cavo'), quantità = Lc [m].
export function openAmpereDistinta(items, fileName){
  if(!items || !items.length){ toast('Nessun cavo con lunghezza (Lc) riconosciuto nel file Ampère','warn'); return; }
  const tot=items.reduce((s,it)=>s+(it.qty||0),0);
  const uni=items.filter(it=>it.unipolare).length;
  openDistintaModal(items, { source:'ampere', glyph:'⇪', accent:'#f59e0b',
    title:'Lista cavi da Ampère',
    sub:`${esc(fileName||'export Ampère')} · ${items.length} tipi di cavo · <b>${fmt(tot)} m</b> totali${uni?` · ${uni} unipolari: i metri sono già moltiplicati per i conduttori`:''} — best-match automatico, correggi la voce di prezzario dove serve` });
}
export function openDistintaModal(items, meta){
  if(!S.allRows || !S.allRows.length){
    toast('Carica/seleziona un prezzario prima di importare la distinta','warn');
    return;
  }
  _distItems = items;
  _distMeta = meta;
  _distGroups = groupPhiItems(items);
  _phiMatches = _distGroups.map(g=>phiMatchRows(g.rep));
  _phiResults = _phiMatches.map(c=>c.slice());
  _phiChoice  = _phiMatches.map(c=>c.length?c[0]:null);
  // RIPRENDI la bozza di prima, se c'è: chiudere la
  // finestra per sbaglio prima di confermare non deve buttare via i match corretti a mano.
  const draftPhi = loadPhiDraft(meta.source);
  if(draftPhi && draftPhi.choicesByKey){
    let ripresiPhi=0;
    _distGroups.forEach((g,gi)=>{
      const k=draftPhi.choicesByKey[g.key]; if(!k) return;
      const row=rowByKey(k); if(!row) return;
      _phiChoice[gi]=row; ripresiPhi++;
    });
    if(ripresiPhi) toast(`Ripresa la revisione di prima: ${ripresiPhi} vo${ripresiPhi===1?'ce già scelta':'ci già scelte'}`,'ok');
  }

  // Badge per i nuovi kind (cassette di derivazione, allacci utenza),
  // stesso stile di CAVO/TUBO ma colore neutro (non hanno una tematica propria).
  const KIND_BADGE = {
    cavo: `<span style="background:rgba(34,211,238,.15);color:#22d3ee;border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700">CAVO</span>`,
    tubo: `<span style="background:rgba(8,145,178,.15);color:var(--accent);border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700">TUBO</span>`,
    cassetta: `<span style="background:var(--warn-light);color:var(--warn);border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700">CASSETTA</span>`,
    'allaccio-utenza': `<span style="background:var(--warn-light);color:var(--warn);border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700">ALLACCIO</span>`,
  };
  // MISURAZIONI (sola lettura): una riga per OCCORRENZA misurata — quantità e quadro/circuito
  // di provenienza. Niente editing qui: si corregge sotto in Elenco Prezzi.
  const misureRowsHtml = items.map(it=>`
    <div class="ep-row" style="grid-template-columns:110px 1fr 90px">
      <span class="ep-code">${KIND_BADGE[it.kind]||KIND_BADGE.tubo}</span>
      <span class="ep-desc">${esc(it.desc)}${it.quadro?` <span style="color:var(--text4)">▤ ${esc(it.quadro)}</span>`:''}</span>
      <span class="ep-price" style="text-align:right;font-family:var(--mono)">${fmt(it.qty)} ${esc(it.um)}</span>
    </div>`).join('') || '<div class="ep-empty">Nessuna misurazione.</div>';

  // ELENCO PREZZI TEMPORANEO (editabile): una riga per GRUPPO/materiale — qui, e SOLO qui,
  // si sceglie/corregge il match.
  const rowsHtml = _distGroups.map((g,i)=>{
    const it=g.rep;
    const kindBadge = KIND_BADGE[it.kind] || KIND_BADGE.tubo;
    const quadri=[...new Set(g.membri.map(mi=>items[mi].quadro).filter(Boolean))]
    const quadroBadge = quadri.length
      ? `<span style="background:var(--accent-soft);color:var(--accent-text,var(--accent));border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700;margin-left:6px" title="${esc(quadri.join(', '))}">▤ ${quadri.length} quadr${quadri.length===1?'o':'i'}</span>`
      : ''
    return `<div class="ep-row" style="grid-template-columns:1fr auto;align-items:start;padding-block:8px">
      <div style="min-width:0">
        <label style="display:inline-flex;align-items:center;gap:5px;font-weight:600">
          <input type="checkbox" class="phi-chk" data-i="${i}" ${_phiChoice[i]?'checked':''}>
          ${kindBadge} ${esc(it.desc)}
        </label>
        ${quadroBadge}
        <span style="color:var(--text4);margin-left:6px;font-family:var(--mono)">${fmt(g.quantita)} ${esc(it.um)}</span>
        <div class="phi-choice" data-i="${i}" style="margin-top:5px">${phiChoiceHtml(_phiChoice[i])}</div>
        <input class="phi-q" data-i="${i}" placeholder="⌕ cerca un'altra voce nel prezzario…"
               oninput="phiSearchInline(${i})" onfocus="phiSearchInline(${i})"
               style="width:100%;margin-top:6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 9px;font-size:12px;color:var(--text)">
        <div class="phi-res" data-i="${i}" style="margin-top:4px"></div>
      </div>
      <button onclick="phiComponiRow(${i})" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;color:var(--text2)" title="Componi la voce nel compositore, con quantità già impostata">✎ Componi</button>
    </div>`;
  }).join('');

  const ov=document.createElement('div');
  ov.id='phi-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:1100px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-family:var(--mono);font-size:20px;font-weight:700;color:${meta.accent}">${meta.glyph}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${meta.title}</div>
          <div style="font-size:11px;color:var(--text3)">${meta.sub}</div>
        </div>
        <button onclick="closePhiDistinta()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
      </div>
      <div style="overflow:auto;padding:8px 20px;flex:1">
        <div class="ep-panel">
          <div class="ep-hd">▱ Misurazioni <span class="ep-sub">— ${items.length} occorrenz${items.length===1?'a':'e'} misurate · sola lettura, si corregge sotto</span></div>
          <div class="ep-rows" style="max-height:180px">${misureRowsHtml}</div>
        </div>
      </div>
      <div style="flex:none;padding:0 20px 8px">
        <div class="ep-panel">
          <div class="ep-hd">▤ Elenco Prezzi <span class="ep-sub">— temporaneo · ${_distGroups.length} materiali, uno per tipo (quantità già sommate)</span></div>
          <div class="ep-rows" style="max-height:320px">${rowsHtml}</div>
        </div>
      </div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <span style="font-size:11px;color:var(--text3);flex:1">Le voci spuntate con una voce associata vengono aggiunte al computo con la quantità, pronta per l'export.</span>
        <button onclick="closePhiDistinta()" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 14px;font-size:12px;cursor:pointer;color:var(--text2)">Annulla</button>
        <button onclick="phiConfirmDistinta()" style="background:${meta.accent};border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:600;color:#fff;cursor:pointer">Aggiungi al computo</button>
      </div>
    </div>`;
  ov.addEventListener('click',e=>{ if(e.target===ov) closePhiDistinta(); });
  document.body.appendChild(ov);
}
// Descrizione PIENA di una voce per la distinta: prodotto (testa declaratoria,
// senza boilerplate di posa) + variante (desc_short). Così si legge COSA è la
// voce trovata, non solo la sua sezione (es. "Passerella portacavi… — mm 65x50").
// HTML della voce attualmente scelta per un materiale
// Ricerca libera (o suggeriti se vuoto) nel prezzario attivo, per un materiale
// Seleziona una voce dai risultati per il materiale i
export function closePhiDistinta(){
  const ov=document.getElementById('phi-overlay');
  if(ov) ov.remove();
}
// «Componi» per una riga di distinta — cassette/allacci utenza non hanno sempre un match
// di prezzario certo (niente sigla/sezione da confrontare). Ognuno ha ora una
// famiglia guidata nel thesaurus: cassetta→scatola-derivazione, allaccio utenza
// →allaccio-utenza-elettrica (fuori prezzario, ROUND 6). I kind senza famiglia
// nota si aprono come voce PERSONALIZZATA precompilata (cmpAddCustom).
export const PHI_KIND_FAMIGLIA = { cassetta: 'scatola-derivazione', 'allaccio-utenza': 'allaccio-utenza-elettrica' };
