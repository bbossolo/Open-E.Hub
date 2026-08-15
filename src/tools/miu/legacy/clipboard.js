/* μ (Prezzi) legacy — copia rapida del computo: popup TSV per il copia-incolla
   in un foglio di calcolo o gestionale esterno.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { buildTSVContent } from './export.js'
import { CART_SEL, S } from './stato.js'
import { collectExportRows, rowsBySearchSel } from './computo-overlay.js'
import { toast } from './index.js'

// Popup copia-incolla RAPIDO: sempre testo TSV piatto (Tariffa/Sintetica/
// Estesa/UM/Prezzo), funziona ovunque (browser puro incluso) — è il metodo
// veloce per voci "opera compiuta" senza scomposizione.
// Se c'è una selezione attiva nei risultati di ricerca (S.searchSel — voci
// NON ancora nel computo) si copia quella, senza doverle prima aggiungere al
// computo; altrimenti, se c'è una selezione nel carrello (CART_SEL), solo
// quella; in assenza di entrambe, tutto il carrello.
export function showCopyPopup(){
  const searchSelRows = S.searchSel.size ? rowsBySearchSel() : null;
  const soloSel = !!searchSelRows || CART_SEL.size>0;
  const rows = searchSelRows || collectExportRows(soloSel);
  if(!rows.length){toast(soloSel?'Nessuna voce selezionata da copiare':'Nessuna voce da copiare','warn');return;}

  const conAnalisi = typeof window.hasAnalisi==='function' && window.hasAnalisi(rows);

  const ta=document.getElementById('copy-textarea');
  const sub=document.getElementById('copy-sub');

  const {content}=buildTSVContent(rows);
  ta.value=content;
  sub.innerHTML='<strong id="copy-count">'+rows.length.toLocaleString('it')
    +'</strong> voci'+(soloSel?' selezionate':'')+' · seleziona tutto, copia e incolla dove ti serve'
    +(conAnalisi?' <em>(copia rapida senza analisi prezzi)</em>':'');

  document.getElementById('copy-overlay').classList.add('open');
  setTimeout(()=>{ ta.focus(); ta.select(); },50);
}
export function closeCopyPopup(){ document.getElementById('copy-overlay').classList.remove('open'); }

export async function copyToClipboard(){
  const ta=document.getElementById('copy-textarea');
  ta.select();
  try{
    await navigator.clipboard.writeText(ta.value);
    toast('Copiato — incollalo nel tuo foglio di calcolo o gestionale','ok');
  }catch(e){
    document.execCommand('copy');
    toast('Copiato','ok');
  }
}
