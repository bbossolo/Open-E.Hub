/* μ (Prezzi) legacy — dettaglio della voce e ciò che ne discende: compositore, libreria di
   studio, voci candidate e fascicolo delle Analisi Prezzi.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { cmpAPSnapshot } from './analisi.js'
import { cmpApplyLibState, cmpCandAdd, cmpCandLoad, cmpCandSave, cmpClearDraft, cmpConfLabel, cmpFlashBtn, cmpFrasario, cmpFreeMisura, cmpKey, cmpLibGroupHTML, cmpLibItems, cmpMacroFilter, cmpMacroShort, cmpMetelLookup, cmpPersistDraft, cmpPickFam, cmpPrezzarioMisure, cmpSet, cmpSetMode, cmpShowPicker, cmpTypeValue, cmpVoceObjectFromCMP } from './compositore.js'
import { cartAnalisi } from './computo.js'
import { CMP, CMP_ACC_DEFAULT, MIU_LIBRERIA, S, setCMP, setPhiPresetQty } from './stato.js'
import { updateCartInfo } from './computo-overlay.js'
import { commitRowToElencoPrezzi, elencoKeyOf, isInElencoPrezzi } from './elenco-prezzi.js'
import { esc, fmt, toast } from './index.js'
import { render, rowKey } from './render.js'

// ══════════════════════════════════════════════════════════════
// DETAIL PANEL
// ══════════════════════════════════════════════════════════════
export let _detailRow = null;
export let _detailVals = [];   // valori raw dei campi mostrati (per i pulsanti copia)
// Esposto su window via GETTER: l'handler generato `copyField(this, _detailVals[i])` legge
// sempre il valore corrente, senza un mirror manuale da tenere in sync a ogni riassegnazione.
Object.defineProperty(window, '_detailVals', { get: () => _detailVals, configurable: true });

export function openDetail(r){
  _detailRow = r;
  document.getElementById('detail-code').textContent = r.codice;

  // costruisce i campi
  const fields = [
    ['Descrizione breve', r.desc_short, false],
    ['Declaratoria completa', r.declaratoria, false],
    ['Regione', r.regione, false],
    ['Anno', r.anno, false],
    ['Disciplina', r.disciplina, false],
    ['Sistema', r.sistema, false],
    ['Settore', r.settore, false],
    ['Materiale', r.materia, false],
    ['Attività', r.attivita, false],
    ['Tipologia', r.tipologia, false],
    ['Categoria', r.liv1 ? [r.liv1, r.liv2, r.liv3].filter(Boolean).join(' › ') : '', false],
    ['U.M.', r.um, false],
    ['Prezzo unitario', r.prezzo ? '€ ' + fmt(r.prezzo) : '', true],
    ['Importo netto', r.importo_netto ? '€ ' + fmt(r.importo_netto) : '', false],
    ['R.U. / % Manodopera', r.ru ? String(r.ru) : '', false],
    ['Keywords', r.keywords, false],
    ['Codice', r.codice, false],
  ];

  // valori raw dei campi per la copia: passati per INDICE, mai inlineati
  // nell'attributo onclick (le virgolette/apostrofi delle descrizioni
  // romperebbero l'attributo e il click non copierebbe nulla)
  const visible = fields.filter(([,v]) => v && String(v).trim());
  _detailVals = visible.map(([,v]) => String(v));
  document.getElementById('detail-body').innerHTML = visible
    .map(([l, v, isPrice], i) => {
      const safeV = esc(String(v));
      const cls = isPrice ? 'price' : (l === 'Codice' ? 'mono' : '');
      return `<div class="df">
        <div class="df-label">${l}
          <button class="df-copy" onclick="copyField(this, _detailVals[${i}])" title="Copia">⎘</button>
        </div>
        <div class="df-val ${cls}">${safeV}</div>
      </div>`;
    }).join('');

  // aggiorna il pulsante carrello
  updateDetailCartBtn();

  document.getElementById('detail-panel').classList.add('open');

  // evidenzia la riga/scheda attiva in qualunque vista (via data-key)
  const key = rowKey(r);
  document.querySelectorAll('[data-key]').forEach(el => el.classList.toggle('active-detail', el.dataset.key===key));
}

export function closeDetail(){
  document.getElementById('detail-panel').classList.remove('open');
  document.querySelectorAll('.active-detail').forEach(el => el.classList.remove('active-detail'));
  _detailRow = null;
}

export function updateDetailCartBtn(){
  if(!_detailRow) return;
  const btn = document.getElementById('detail-add-cart');
  const inCart = isInElencoPrezzi(_detailRow); // copia nell'Elenco Prezzi, non più S.sel
  btn.textContent = inCart ? '✕ Rimuovi dal computo' : '+ Aggiungi al computo';
  btn.id = 'detail-add-cart';
  btn.className = inCart ? 'detail-remove-cart' : '';
  btn.style.background = inCart ? 'var(--danger-light)' : 'var(--accent)';
  btn.style.color = inCart ? 'var(--danger)' : '#fff';
  btn.style.border = inCart ? '1px solid var(--danger)' : 'none';
}

export function detailCartAction(){
  if(!_detailRow) return;
  // aggiungere = salva una COPIA nell'Elenco Prezzi (modificabile a posteriori);
  // rimuovere = elimina la copia. Nessun legame con la selezione della ricerca.
  const k=elencoKeyOf(_detailRow);
  if(S.custom.has(k)){ S.custom.delete(k); if(S.qty[k]) delete S.qty[k]; if(S.categoria[k]) delete S.categoria[k]; }
  else commitRowToElencoPrezzi(_detailRow);
  updateDetailCartBtn();
  updateCartInfo(); render();
}

// ══════════════════════════════════════════════════════════════
// COMPONI DESCRIZIONE — modal sul motore puro (window.FRASARIO,
// window.componiDescrizione, window.verificaCoerenza da main.ts).
// Regola «se non c'è non si menziona»: slot deselezionati = assenti.
// ══════════════════════════════════════════════════════════════
// edBreve/edEstesa: testo dell'editor (punto 4) — null finché l'utente non lo popola
// (digitando), poi resta suo finché non cambia famiglia («↺ rigenera» lo riaggancia).
// acc: stato aperto/chiuso delle categorie di suggerimenti (accordion, punto 2)
// Gruppi famiglia (macrotema) CHIUSI di default: con ~50 chip il picker era
// un muro di testo all'apertura — l'utente sceglie il macrotema che gli serve
// e lo espande lui, invece di scorrere tutto. Le altre categorie (misura/
// materiali/caratteristiche) restano aperte: sono per la famiglia già scelta.



// presetFamigliaId apre il compositore già sulla famiglia NOTA (es. da una riga
// di distinta importata) — bypassa suggerisciFamiglia, che resta il solo meccanismo
// di suggerimento da un TESTO di voce di prezzario (row), mai certo al 100%.
export function openComponi(row, presetFamigliaId, initialMode){
  setCMP({ fam:null, custom:null, misura:null, materiale:null, posa:null, opzioni:[], famQ:'', edBreve:null, edEstesa:null, genBreve:'', genEstesa:'', acc:{...CMP_ACC_DEFAULT}, mode:initialMode||'desc', analisi:null, editingLibId:null, editingCartKey:null });
  // Ogni apertura riparte pulita — un preset di quantità lasciato da una sessione
  // precedente (es. l'utente ha chiuso senza aggiungere al carrello) non deve
  // contaminare la prossima composizione.
  setPhiPresetQty(null);
  if(presetFamigliaId){
    CMP.fam = presetFamigliaId;
  } else if(row && window.suggerisciFamiglia){
    // famiglia proposta dalla descrizione della voce (solo suggerimento, nessun aggancio persistente)
    CMP.fam = window.suggerisciFamiglia((row.desc_short||'')+' '+(row.declaratoria||''));
  } else {
    // apertura DA ZERO (non da distinta) → voce VUOTA: nessun ripristino automatico
    // della bozza (l'utente vuole partire pulito). La bozza stale viene azzerata.
    cmpClearDraft();
  }
  const inp=document.getElementById('cmp-fam-search'); if(inp) inp.value='';
  // Il Compositore è un MODALE sopra la vista corrente (Cerca o il Computo): il
  // suo z-index è più alto di tutto, quindi galleggia senza dover chiudere il
  // computo sotto (così l'edit «Σ/✎ modifica» dal computo può tornarci sotto).
  document.getElementById('componi-overlay').classList.add('open');
  cmpApplyLibState();
  document.addEventListener('keydown', cmpKey, true);
  cmpSetMode(initialMode||'desc');
  renderComponi();
}
// Ingresso diretto alla scheda Σ Analisi Prezzi (bottone dedicato in header, a
// fianco di "Compositore di descrizione"): stesso overlay/motore, apre già in modalità
// 'analisi' invece di passare da 'desc' e cambiare modalità a mano.
export function openComponiAnalisi(row, presetFamigliaId){
  openComponi(row, presetFamigliaId, 'analisi');
}
// Editor Analisi Prezzi A POSTERIORI: riapre in modifica un'Analisi Prezzi già
// aggiunta al computo (badge "Σ modifica" sulla voce, customRowsHtml). Carica
// lo snapshot in CMP.analisi e marca CMP.editingCartKey — cmpAPAddToCart lo
// controlla e AGGIORNA la stessa voce invece di duplicarla (funzione mancante,
// prima un'Analisi Prezzi nel computo era congelata per sempre).
// Libreria = pannello a scomparsa a sinistra: collassato di default (pulisce la UI
// dalle tante famiglie), lo stato aperto/chiuso è ricordato tra le aperture.
export function openComponiFromDetail(){ if(_detailRow) openComponi(_detailRow); }
export function closeComponi(){
  document.getElementById('componi-overlay').classList.remove('open');
  document.removeEventListener('keydown', cmpKey, true);
}
// macro-filtro orizzontale + breadcrumb: etichette brevi, filtro a chip,
// «cambia» riapre il picker senza perdere la famiglia corrente.

// selezione famiglia: singola; il cambio famiglia azzera le caratteristiche E l'editor
// (il testo modificato apparteneva a un componente diverso, non ha senso trascinarlo)
// famiglia PERSONALIZZATA: poche categorie nel thesaurus, a volte serve una voce ad hoc
// non nel motore — genera un punto di partenza generico, poi si rifinisce nell'editor.
// chip caratteristica: singola per gruppo (ri-clic = deseleziona), multipla per opzioni
// «Dal prezzario aperto» (opzionale): misure REALI viste nelle voci caricate della stessa
// famiglia — usa lo stesso motore di ricerca, non un secondo algoritmo. Se non c'è un
// prezzario caricato, o niente matcha, la sezione semplicemente non compare.
// Anteprima "a compilazione": il segmento NUOVO (rispetto al testo precedente) entra con
// un flash, il prefisso invariato resta fermo — dà la sensazione di veder comporre la voce
// a ogni click su un suggerimento, invece di un cambio di testo istantaneo.
// Battitura «carattere per carattere» sulla VOCE mentre si scelgono i chip:
// anima solo la coda nuova (il prefisso comune resta fermo), un timer per campo,
// interrotto se arriva un nuovo render. Agisce su input/textarea via .value —
// SOLO quando il campo è in sync live (testo automatico), mai sul testo utente.
export const CMP_TYPE_TIMERS = {};


// ordine coerente coi chip macrocategoria di μ; chiave accordion = 'macro_<slug>'
export const CMP_MACRO_ORDER = ['IMPIANTI ELETTRICI','ILLUMINAZIONE','IMPIANTI SPECIALI','IMPIANTI MECCANICI','IMPIANTI ANTINCENDIO'];
export const cmpMacroKey = m => 'macro_'+m.toLowerCase().replace(/[^a-z]+/g,'_');

export function renderComponi(){
  // il compositore serve alle voci NON già a listino: le famiglie «facili a
  // prezzario» (cavi/condotti) restano nel thesaurus per la ricerca ma non nel picker.
  const fras = (window.FRASARIO||[]).filter(f=>!f.facilePrezzario);
  const fr = cmpFrasario();
  // — 1: FAMIGLIA — picker ordinato (macro-filtro orizzontale + griglia allineata)
  // oppure, quando la famiglia è scelta, breadcrumb compatto (il picker collassa).
  const q = (CMP.famQ||'').toLowerCase();
  const vis = fras.filter(f=>!q || f.nome.toLowerCase().includes(q) || f.famigliaId.includes(q));
  document.getElementById('cmp-fam-count').textContent = `— thesaurus μ (${fras.length})`;
  const famChip = f => `<span class="cmp-fam-chip${f.famigliaId===CMP.fam?' active':''}" data-fam="${esc(f.famigliaId)}" title="${esc(f.nome)}" onclick="cmpPickFam('${esc(f.famigliaId)}')">${esc(f.nome)}</span>`;
  const byName=(a,b)=>a.nome.localeCompare(b.nome,'it');
  const pickerEl=document.getElementById('cmp-fam-picker'), crumbEl=document.getElementById('cmp-fam-crumb');
  const picked = (fr || CMP.custom) && !CMP.showPicker;
  if(picked){
    pickerEl.hidden=true; crumbEl.hidden=false;
    const macroLbl = fr ? cmpMacroShort((fr.macro||[])[0]||'') : 'personalizzata';
    const nome = fr ? fr.nome : CMP.custom;
    crumbEl.innerHTML = `<span class="cmp-crumb-ic">✎</span>`+
      `<span class="cmp-crumb-path">μ ${macroLbl?`▸ <b>${esc(macroLbl)}</b> `:''}▸ <b>${esc(nome)}</b></span>`+
      `<span class="cmp-sp"></span>`+
      `<button class="cmp-crumb-edit" onclick="cmpShowPicker()">↺ cambia</button>`;
  }else{
    pickerEl.hidden=false; crumbEl.hidden=true;
    const present = CMP_MACRO_ORDER.filter(m=>fras.some(f=>(f.macro||[]).includes(m)));
    document.getElementById('cmp-macrobar').innerHTML = present.map(m=>
      `<span class="cmp-macro-chip${CMP.macroFilter===m?' on':''}" onclick="cmpMacroFilter('${esc(m)}')">${esc(cmpMacroShort(m))}</span>`).join('');
    let famHtml='';
    if(q){
      const list=[...vis].sort(byName);
      famHtml = list.length ? `<div class="cmp-fam-grid">${list.map(famChip).join('')}</div>` : `<span class="cmp-empty">Nessuna famiglia per «${esc(CMP.famQ)}»</span>`;
    }else if(CMP.macroFilter){
      const list=vis.filter(f=>(f.macro||[]).includes(CMP.macroFilter)).sort(byName);
      famHtml = `<div class="cmp-fam-grid">${list.map(famChip).join('')}</div>`;
    }else{
      famHtml = `<div class="cmp-empty">Scegli una macrocategoria qui sopra, oppure cerca per nome.</div>`;
    }
    document.getElementById('cmp-fam-grid-wrap').innerHTML = famHtml;
  }

  // — 2: caratteristiche a RIGHE piatte (mockup Livia): una riga «label | chip» per
  // slot (misura/materiale/posa/opzioni + eventuali misure dal prezzario). Niente
  // accordion: la voce respira ed è tutta a vista.
  const chip=(group,val,on)=>`<span class="cmp-opt-chip${on?' on':''}" data-group="${group}" onclick="cmpSet('${group}',${JSON.stringify(String(val)).replace(/"/g,'&quot;')})">${esc(val)}</span>`;
  const charRow=(label,body)=>`<div class="cmp-char-row"><label>${label}</label><div class="cmp-opt-chips">${body}</div></div>`;
  let chars='';
  if(fr){
    const note=(fr.fuoriPrezzario&&fr.nota)?`<div class="cmp-rule-note cmp-fuori-prezzario">⚠ ${esc(fr.nota)}</div>`:'';
    let rows='';
    if(fr.misura){
      const et=(fr.misura.etichetta||'misura'); const lbl=et.charAt(0).toUpperCase()+et.slice(1);
      rows += charRow(esc(lbl), `${fr.misura.valori.map(v=>chip('misura',v,CMP.misura===v)).join('')}<input class="cmp-char-input" id="cmp-misura-free" placeholder="altra…" value="${fr.misura.valori.includes(CMP.misura)?'':esc(CMP.misura||'')}" onchange="cmpFreeMisura(this.value)">`);
    }
    if(fr.materiale) rows += charRow('Materiale', fr.materiale.map(v=>chip('materiale',v,CMP.materiale===v)).join(''));
    if(fr.posa) rows += charRow('Posa', fr.posa.map(v=>chip('posa',v,CMP.posa===v)).join(''));
    if(fr.opzioni) rows += charRow('Opzioni <span class="opt">(multiple)</span>', fr.opzioni.map(v=>chip('opzioni',v,CMP.opzioni.includes(v))).join(''));
    // misure reali minate dal prezzario aperto (opzionale)
    const daPrz = cmpPrezzarioMisure(fr);
    if(daPrz.length){
      const it=(S.active!=null&&S.archive[S.active])?S.archive[S.active]:null;
      const nomePrz = it ? `${it.regione}${it.anno&&it.anno!=='—'?' '+it.anno:''}` : 'prezzario aperto';
      rows += charRow(`Dal prezzario <span class="opt">${esc(nomePrz)}</span>`, daPrz.map(v=>chip('misura',v,CMP.misura===v)).join(''));
    }
    chars = note + (rows || `<div class="cmp-empty">Nessuna caratteristica guidata per questa famiglia — componi nell'editor.</div>`);
  }else if(CMP.custom){
    chars=`<div class="cmp-empty">Famiglia personalizzata «${esc(CMP.custom)}»: nessuna caratteristica guidata — componi liberamente nell'editor qui sotto.</div>`;
  }else{
    chars=`<div class="cmp-empty">Scegli una famiglia per vederne le caratteristiche.</div>`;
  }
  document.getElementById('cmp-chars').innerHTML=chars;
  // il blocco «Da scheda tecnica» è una porta d'ingresso: si mostra solo a voce
  // vuota (State A), sparisce quando stai componendo una famiglia (State B).
  const dsSec=document.getElementById('cmp-ds-sec'); if(dsSec) dsSec.hidden = !!picked;

  // — composizione live (motore puro; per una famiglia personalizzata, generico locale)
  let breve='', estesa='';
  if(fr && window.componiDescrizione){
    const d=window.componiDescrizione({famigliaId:CMP.fam, misura:CMP.misura||undefined, materiale:CMP.materiale||undefined, posa:CMP.posa||undefined, opzioni:CMP.opzioni});
    breve=d.breve; estesa=d.estesa;
  }else if(CMP.custom){
    const nome=CMP.custom;
    breve=nome.charAt(0).toUpperCase()+nome.slice(1);
    estesa=`Fornitura e posa in opera di ${nome.toLowerCase()}, inclusi accessori di fissaggio e quota parte di sfridi, in opera a regola d'arte.`;
  }
  CMP.genBreve=breve; CMP.genEstesa=estesa;

  // — 3: la voce di computo (unica superficie: si compone live ed è modificabile)
  const tag=document.getElementById('cmp-step-tag');
  tag.textContent = CMP.custom ? 'famiglia personalizzata' : 'voce di computo';
  // Finché l'utente non l'ha toccato (edBreve/edEstesa null), l'editor MOSTRA
  // live il testo generato (classe .cmp-ed-auto = leggermente attenuato): la
  // voce autoritativa è sempre e solo qui. Al primo input diventa testo
  // dell'utente e resta suo
  // (stessa precedenza di sempre in cmpCurrentDescrizione: editor > generata).
  const edB=document.getElementById('cmp-ed-breve'), edE=document.getElementById('cmp-ed-estesa');
  const showB=CMP.edBreve??CMP.genBreve??'', showE=CMP.edEstesa??CMP.genEstesa??'';
  if(CMP.edBreve==null) cmpTypeValue(edB, showB);
  else if(edB.value!==showB){ edB.value=showB; edB.dataset.prev=showB; }
  if(CMP.edEstesa==null) cmpTypeValue(edE, showE);
  else if(edE.value!==showE){ edE.value=showE; edE.dataset.prev=showE; }
  edB.classList.toggle('cmp-ed-auto', CMP.edBreve==null);
  edE.classList.toggle('cmp-ed-auto', CMP.edEstesa==null);

  // — libreria voci pronte (filtrata dalla stessa mini-ricerca) + salvataggio bozza
  renderLibreria();
  renderCandidati();
  cmpPersistDraft();
}

// «rigenera»: scarta le modifiche manuali e torna alla sincronizzazione live col
// testo composto dalle scelte (azione esplicita — non cancella nulla da sola).

// Copia dal footer: preferisce l'editor (la «voce editata») se l'utente l'ha popolato,
// altrimenti ripiega sul testo generato dalle scelte.

// Porta la descrizione composta nel carrello come voce a sé, SENZA bisogno
// di una voce di prezzario a cui agganciarla — l'utente valorizza il prezzo dopo,
// nell'overlay Carrello. Il modal resta aperto: si possono comporre più voci di fila.


// ── LIBRERIA VOCI PRONTE ──────────────────────────────────────────────────────
// Due livelli: seed curato (window.VOCI_PRONTE, minato dai computi golden —
// engine libreria.ts) + voci PERSONALI dell'utente («Salva in libreria»),
// persistite in localStorage con lo stesso schema VocePronta. Un click carica
// la voce nel compositore (chip preselezionati + editor precompilato); «＋»
// la aggiunge diretta al carrello.
export function loadLibreria(){ try{ return JSON.parse(localStorage.getItem('miu:libreria')||'[]'); }catch(e){ return []; } }
export function persistLibreria(){ try{ localStorage.setItem('miu:libreria', JSON.stringify(MIU_LIBRERIA)); }catch(e){} }

// famiglie «facili a prezzario» (cavi/condotti): escluse anche dalla Libreria
// voci pronte, coerente col picker (il compositore serve alle voci fuori listino).
// Le due categorie si mostrano in menu SEPARATI e a scomparsa indipendente
// («tue» in cima, quelle che l'utente controlla di più; «curate» in fondo):
// lo stato aperto/chiuso di ciascun gruppo è ricordato tra le aperture.
export function renderLibreria(){
  const wrap=document.getElementById('cmp-lib-wrap'); if(!wrap) return;
  const items=cmpLibItems();
  const cnt=document.getElementById('cmp-lib-count');
  if(cnt){
    cnt.textContent = `— ${(window.VOCI_PRONTE||[]).length} curate${MIU_LIBRERIA.length?` · ${MIU_LIBRERIA.length} tue`:''}`;
  }
  if(!items.length){ wrap.innerHTML=`<div class="cmp-empty">Nessuna voce pronta${CMP.famQ?` per «${esc(CMP.famQ)}»`:''}. Componi una voce e «★ Salva in libreria» per ritrovarla qui.</div>`; return; }
  const mine=items.filter(({group})=>group==='mine').map(({v})=>v);
  const curate=items.filter(({group})=>group==='curate').map(({v})=>v);
  wrap.innerHTML =
    cmpLibGroupHTML('mine', 'Le tue voci', mine, `Nessuna voce tua salvata${CMP.famQ?` per «${esc(CMP.famQ)}»`:''}. Componi una voce e «★ Salva in libreria» per ritrovarla qui.`) +
    cmpLibGroupHTML('curate', 'Voci curate', curate, `Nessuna voce curata${CMP.famQ?` per «${esc(CMP.famQ)}»`:''}.`);
}
// Carica una voce pronta come PUNTO DI PARTENZA (una copia): salvare di nuovo crea
// una voce NUOVA. Per modificare quella esistente in-place vedi cmpLibEdit.
// Carica una voce PROPRIA per MODIFICARLA: il prossimo salvataggio (nello
// stesso gruppo) aggiorna questa voce invece di crearne una nuova.
// Elimina una voce TUA dalla libreria personale.

// ── IMPORT SCHEDA TECNICA (PDF) → VOCI CANDIDATE ──────────────────────────────
// Adapter pdf.js (window.importDatasheetPDF, in main.ts) → engine puro
// estraiVociDaScheda. Le candidate sono EFFIMERE (non persistite in bozza né
// nel .ehub): l'utente le carica nel compositore per rifinirle, le aggiunge al
// computo, o le salva in libreria. PDF scansionati/senza testo ⇒ nessuna voce.
export let CMP_CANDIDATI = [];
export let _dsBusy = false;
// il pannello ⓘ si chiude al clic fuori (non deve restare persistente a schermo)
document.addEventListener('click',(e)=>{
  const box=document.getElementById('cmp-ds-info');
  if(box && !box.hidden && !e.target.closest('#cmp-ds-info') && !e.target.closest('.cmp-ds-info-link')) box.hidden=true;
}, true);
// Pannello ⓘ: comparti e produttori per cui il riconoscimento è OTTIMIZZATO,
// generato dalla KB reale (window.MARCHI/SETTORE_LABEL) — mai da aggiornare a
// mano: cresce da solo quando la KB cresce. Le schede fuori elenco vengono
// comunque analizzate (thesaurus + caratteristiche), solo senza il boost marca.
// Cross-reference METEL: se il codice della scheda combacia con una riga del
// listino caricato (S.allRows), ne prende marca/descrizione/prezzo ufficiali.
// Match ESATTO sul codice normalizzato (evita falsi agganci).
export async function cmpDatasheetFile(input){
  const file = input && input.files && input.files[0]; if(!file) return;
  input.value='';
  if(!window.importDatasheetPDF){ toast('Lettura PDF non disponibile in questa build','warn'); return; }
  // un secondo import scelto mentre il primo è ancora in elaborazione
  // sovrascriverebbe silenziosamente CMP_CANDIDATI a fine corsa (il più lento
  // vince per ultimo), con l'effetto percepito di un elenco che "raddoppia" o
  // cambia da solo: si rifiuta finché il precedente non è concluso.
  if(_dsBusy){ toast('Lettura di un\'altra scheda già in corso: attendi che finisca','warn'); return; }
  _dsBusy=true; CMP_CANDIDATI=[]; renderCandidati();
  try{
    const voci = await window.importDatasheetPDF(file);
    CMP_CANDIDATI = Array.isArray(voci) ? voci : [];
    // aggancio METEL su TUTTI i codici disponibili (codice catalogo + EAN), non
    // solo sul primo candidato: primo match esatto vince
    let metel = null;
    for(const c of [...new Set(CMP_CANDIDATI.flatMap(p=>[p.codice,p.ean]).filter(Boolean))]){
      metel = cmpMetelLookup(c); if(metel) break;
    }
    if(metel) CMP_CANDIDATI.forEach(p=>{
      p.metel=true; p.prezzo=metel.prezzo; if(metel.marca) p.marca=metel.marca; if(metel.desc) p.modello=p.modello||metel.desc;
      // senza ricalcolare, marca/modello arricchiti da METEL non arrivavano MAI al
      // testo mostrato/caricato nel compositore (descBreve/descEstesa restavano
      // quelli della sola estrazione PDF, generici se lì marca/modello mancavano).
      const rid=window.rideriveDescrizione&&window.rideriveDescrizione(p);
      if(rid){ p.descBreve=rid.breve; p.descEstesa=rid.estesa; }
    });
    _dsBusy=false; renderCandidati();
    if(!CMP_CANDIDATI.length) toast('Nessuna voce riconosciuta: la scheda potrebbe essere scansionata (solo immagine) o non coperta — componi manualmente','warn');
    else toast(`${CMP_CANDIDATI.length} voce/i proposte${metel?' · trovato nel listino METEL caricato ✓':''}`,'ok');
  }catch(e){
    _dsBusy=false; CMP_CANDIDATI=[]; renderCandidati();
    toast('Impossibile leggere il PDF: '+((e&&e.message)||e),'warn');
  }
}
export function renderCandidati(){
  const wrap=document.getElementById('cmp-ds-wrap'); if(!wrap) return;
  if(_dsBusy){ wrap.innerHTML=`<div class="cmp-empty">Lettura del PDF in corso…</div>`; return; }
  if(!CMP_CANDIDATI.length){ wrap.innerHTML=`<div class="cmp-empty">Importa una scheda tecnica PDF: μ propone qui le voci riconosciute (famiglia + caratteristiche), da caricare nel compositore o aggiungere al computo.</div>`; return; }
  wrap.innerHTML = CMP_CANDIDATI.map((p,i)=>{
    // valori REALI letti dalla scheda (se assenti, i chip generici del FRASARIO)
    const carats=(p.caratteristiche||[]).map(c=>c.valore);
    const chipArr = carats.length ? carats : [p.misura,p.materiale,p.posa,...(p.opzioni||[])].filter(Boolean);
    const chips=chipArr.map(c=>`<span class="cmp-ds-chip">${esc(c)}</span>`).join('') || `<span class="cmp-ds-chip">nessuna caratteristica riconosciuta — completa nel compositore</span>`;
    const cl=cmpConfLabel(p.confidenza||0);
    const ev=(p.evidenze||[]).join(' · ');
    const SETTORI={illuminazione:'Illuminazione',idronica:'Meccanica',frigo:'Frigo',elettrogeno:'Elettrogeno',ups:'UPS',acs:'ACS',elettrico:'Elettrico'};
    const settore=p.settore&&SETTORI[p.settore]?`<span class="cmp-ds-settore" title="comparto impiantistico riconosciuto">${esc(SETTORI[p.settore])}</span>`:'';
    const marcaTxt=p.marca?(p.marcaNota?`<span class="cmp-ds-marca" title="produttore riconosciuto dalla knowledge base">${esc(p.marca)} ✓</span>`:esc(p.marca)):'';
    const ident=[marcaTxt, esc(p.modello||''), p.codice?esc('cod. '+p.codice):''].filter(Boolean).join(' · ');
    const prezzo=(p.prezzo!=null&&!isNaN(p.prezzo))?` · € ${Number(p.prezzo).toFixed(2)}`:'';
    const identLine=ident?`<div class="cmp-ds-ident">${ident}${esc(prezzo)}${p.metel?' <span class="cmp-ds-metel">METEL ✓</span>':''}</div>`:'';
    return `<div class="cmp-lib-item cmp-ds-item" title="${esc(ev)}">
      <div class="cmp-ds-head">
        <div class="cmp-lib-main"><div class="cmp-lib-name" title="${esc(p.famNome||'')}">${esc(p.famNome||'')}</div><div class="cmp-lib-sub" title="U.M. ${esc(p.um||'cad')}">U.M. ${esc(p.um||'cad')}</div></div>
        ${settore}<span class="cmp-conf ${cl.k}" title="confidenza del riconoscimento">${cl.t}</span>
      </div>
      ${identLine}
      <div class="cmp-ds-chips">${chips}</div>
      <div class="cmp-ds-acts">
        <button class="cmp-tbtn" onclick="cmpCandLoad(${i})" title="Precompila il compositore con questa voce, per rivederla e rifinirla">Carica nel compositore</button>
        <button class="cmp-tbtn" onclick="cmpCandAdd(${i},this)" title="Aggiungi subito la voce al computo">+ Al computo</button>
        <button class="cmp-tbtn" onclick="cmpCandSave(${i},this)" title="Salva la voce nella tua libreria personale">★</button>
      </div>
    </div>`;
  }).join('');
}

// ── PERSISTENZA BOZZA COMPOSITORE (C1) ────────────────────────────────────────
// Lo stato in lavorazione (CMP) è salvato a ogni modifica: chiudere il modal o
// ricaricare la pagina NON perde l'editing. Alla riapertura DA ZERO (non da una
// distinta importata) la bozza viene ripristinata. Si azzera aggiungendo la voce al
// carrello o con «Nuova voce».
/**
 * Riparte da zero: descrizione, famiglia, accessori E Analisi Prezzi. La voce è
 * UNA (la descrizione è condivisa fra le due schede, vedi cmpCurrentDescrizione),
 * quindi anche l'azzeramento deve essere uno solo — con due reset separati le
 * righe dell'analisi precedente sopravvivevano alla «Nuova voce» e la descrizione
 * precedente alla «Nuova analisi».
 * Si conservano solo la scheda attiva e il testo di ricerca famiglia: sono la
 * posizione dell'utente nella UI, non contenuto della voce.
 */

// ══════════════════════════════════════════════════════════════
// ANALISI PREZZI (Σ) — manodopera/materiale/noli/varie + SG%/UI% (engine puro
// in src/shared/compositore/analisi-prezzi.ts, esposto da main.ts su window).
// Le righe manodopera/materiale/noli si pescano dalla STESSA ricerca prezzario
// di μ (window.searchRows su S.allRows — ogni prezzario ha già un capitolo di
// tariffe orarie manodopera) oppure sono custom (descrizione/UM/prezzo liberi).
// ══════════════════════════════════════════════════════════════
export const AP_TIPI = ['manodopera','materiale','nolo','varie'];
export const AP_TIPO_LABEL = { manodopera:'Manodopera', materiale:'Materiali', nolo:'Noli', varie:'Varie' };
 // schema analisi nuovi prezzi


// Macrocategoria dell'impianto della voce in composizione (dalla famiglia scelta
// nella scheda Descrizione) — guida la manodopera disciplinare da proporre.
// «già pronte per tematica»: se la manodopera è ancora vuota e c'è un prezzario
// aperto, propone 1-2 righe manodopera coerenti con la disciplina dell'impianto
// (elettricista per elettrici/illuminazione, idraulico/termoidraulico per
// meccanici — cercate per TESTO nel prezzario aperto, mai sigle di livello
// fisse) — l'utente inserisce solo le ore. Non sovrascrive scelte già fatte.
export const AP_MO_SUGGESTED = new Set(); // analisi già arricchite: se l'utente TOGLIE la manodopera, non rientra
// La VOCE composta in ✎ Descrizione entra in B·Materiali come riga editabile
// (um/qta/prezzo) appena si passa a Σ — prima accadeva SOLO importando da
// scheda PDF (cmpCandLoad): componendo a mano le sezioni restavano vuote.
export const AP_MAT_SUGGESTED = new Set();
// Descrizione UNICA della voce: la stessa dell'editor «✎ Descrizione» (prima
// Analisi Prezzi aveva un campo descrizione SEPARATO da ricompilare a mano;
// ora si compone UNA volta sola, anche da scheda tecnica PDF, e si riusa qui).
// Stessa precedenza di cmpAddToCart/cmpCopy: editor modificato > anteprima generata.
// Istantanea dell'Analisi Prezzi CON la descrizione condivisa incorporata — usata
// per calcolo/carrello/libreria/export, mai per l'editing live (CMP.analisi non
// porta descrizione propria: la legge sempre dall'editor Descrizione).
// Descrizione digitata DIRETTAMENTE nella scheda Σ: scrive sull'editor condiviso
// (stessa precedenza «editor modificato > anteprima generata»), così resta una
// sorgente unica e la si ritrova identica nella scheda ✎ Descrizione.

// Rete di sicurezza contro il rilievo utente: digitare in "voce personalizzata…" e
// uscire dal campo SENZA premere Invio o «+» perdeva silenziosamente il testo (si
// pensava fosse già inserito). Al blur, se il focus è uscito dall'intera riga
// custom (non semplicemente passato al campo UM/prezzo accanto), la riga si
// aggiunge da sola quando la descrizione non è vuota — nessun dato scritto va perso.
// i dropdown dell'Analisi Prezzi si chiudono al clic FUORI (rilievo utente:
// la lista manodopera suggerita restava aperta in modo persistente)
document.addEventListener('click', (e)=>{
  if(e.target.closest('.cmp-ap-search-wrap') || e.target.closest('.cmp-ap-mo-menu') || e.target.closest('.cmp-ap-row-swap')) return;
  document.querySelectorAll('.cmp-ap-search-results:not(.cmp-ap-mo-menu)').forEach(el=>{ el.style.display='none'; });
  document.querySelectorAll('.cmp-ap-mo-menu').forEach(m=>m.remove());
  document.querySelectorAll('.cmp-ap-row-swap').forEach(b=>b._open=false);
}, true);
// ── Voce di riferimento: importa la scomposizione UFFICIALE ──
// Le voci in opera di Lombardia/EASY portano r.risorse (componenti reali con
// quantità/prezzi): l'import le mette in A/B/C con fonte tracciata; l'euristica
// resta il fallback quando la scomposizione non c'è.

// indice della riga appena aggiunta/duplicata (per il flash di conferma nel render
// successivo) — azzerato subito dopo l'uso in cmpAPRender, non è stato persistente
// indice codice→riga per il join delle risorse, ricostruito quando cambia il catalogo
// tendina sulla RIGA manodopera: sostituisce la tariffa (mantiene la quantità già digitata)
// duplica una riga già inserita (stessa voce, quantità/prezzo da rifinire sul posto) —
// copre il caso "stessa manodopera/materiale, quantità diversa" senza ricercare da capo
// «Operaio edile di livello 3°; qualifica: specializzato» → primario «Specializzato · liv. 3°»
// (l'inizio è identico per tutte le tariffe CCNL: la parte DISTINTIVA va davanti).
export function apMoLabel(desc){
  const d=String(desc||'');
  const q=d.match(/qualifica\s*[:=]?\s*([^;,.()]+)/i);
  const l=d.match(/livello\s*(\d+)\s*°?/i);
  if(!q && !l) return null;
  const qual=q?q[1].trim():'';
  const primario=[qual?qual.charAt(0).toUpperCase()+qual.slice(1):null, l?`liv. ${l[1]}°`:null].filter(Boolean).join(' · ');
  return primario||null;
}
// «Aggiungi al carrello»: come cmpAddToCart ma con source:'analisi-prezzi'
// e il prezzo GIÀ valorizzato (calcolato, non da inserire a mano dopo).
// Se si sta modificando un'Analisi Prezzi già nel computo (CMP.editingCartKey,
// impostato da cmpEditAnalisiFromCart), AGGIORNA quella voce invece di crearne
// una nuova: stessa chiave, così qty/misurazioni/categoria già assegnate restano
// — stesso pattern di cmpAPSaveToLibreria/CMP.editingLibId qui sopra.
// «Salva in libreria»: come cmpSaveToLibreria ma porta la scomposizione completa
// (analisiPrezzi) — se CMP.editingLibId è valorizzato, AGGIORNA la voce esistente
// invece di crearne una nuova (bonus richiesto: edit voci libreria).
// FASCICOLO Analisi Prezzi (toolbar): un unico Excel con «Indice» + un foglio
// per ogni analisi presente nel carrello (voci con analisiPrezzi). L'export
// della SINGOLA analisi resta nel footer del compositore.
export function updateAPFascicoloBtn(){
  const n=cartAnalisi().length;
  // gli export Σ A.P. vivono ora nel passo Esporta (#export-ap-xls/#export-ap-pdf);
  // i vecchi id in toolbar restano gestiti se presenti (null-guard) per sicurezza.
  const btn=document.getElementById('export-ap-xls')||document.getElementById('ap-fascicolo-btn');
  const pdfBtn=document.getElementById('export-ap-pdf')||document.getElementById('ap-fascicolo-pdf-btn');
  const badge=document.getElementById('ap-fascicolo-count');
  if(btn){
    btn.classList.toggle('disabled', n===0);
    btn.title = n===0 ? 'Nessuna Analisi Prezzi nel computo metrico — componine una dal Compositore (Σ)'
                      : `Scarica il fascicolo Excel con le ${n} Analisi Prezzi del computo metrico (foglio Indice + un foglio per analisi)`;
  }
  if(pdfBtn){
    pdfBtn.classList.toggle('disabled', n===0);
    pdfBtn.title = n===0 ? 'Nessuna Analisi Prezzi nel computo metrico — componine una dal Compositore (Σ)'
                         : `Apri il fascicolo PDF stampabile con le ${n} Analisi Prezzi del computo metrico (indice + una analisi per pagina)`;
  }
  if(badge){ badge.style.display = n>0 ? 'inline' : 'none'; badge.textContent=n; }
}
export function exportFascicoloAPPdf(){
  const analisi=cartAnalisi();
  if(!analisi.length){ toast('Nessuna Analisi Prezzi nel computo metrico — componine una dal Compositore (Σ)','warn'); return; }
  if(typeof window.miuFascicoloAnalisiReport!=='function'){ toast('Modulo report non pronto, riprova tra un attimo','warn'); return; }
  const html=window.miuFascicoloAnalisiReport(analisi);
  const w=window.open('', '_blank');
  if(!w){ toast('Popup bloccato: consenti le finestre per esportare il PDF','warn'); return; }
  w.document.write(html); w.document.close();
}
// Foglio Excel CURATO (rilievo utente): larghezze colonna dal contenuto,
// titoli/sezioni su celle unite, formati numerici it (quantità e importi con
// 2 decimali, migliaia puntate) — SheetJS community: niente stili font/colore.
export function apBuildSheet(aoa, euroCols, qtyCols){
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  if(window.aoaColWidths) ws['!cols']=window.aoaColWidths(aoa).map(wch=>({wch}));
  if(window.aoaMerges) ws['!merges']=window.aoaMerges(aoa, Math.max(...aoa.map(r=>r.length), 1));
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  for(let R=range.s.r; R<=range.e.r; R++){
    for(const C of [...(euroCols||[]), ...(qtyCols||[])]){
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      if(cell && typeof cell.v==='number') cell.z=(euroCols||[]).includes(C) ? '#,##0.00' : '#,##0.00';
    }
  }
  return ws;
}
export function exportFascicoloAP(){
  const analisi=cartAnalisi();
  if(!analisi.length){ toast('Nessuna Analisi Prezzi nel computo metrico — componine una dal Compositore (Σ)','warn'); return; }
  if(!window.fascicoloIndiceAOA || typeof XLSX==='undefined'){ toast('Modulo Excel non pronto, riprova tra un attimo','warn'); return; }
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, apBuildSheet(window.fascicoloIndiceAOA(analisi), [4], []), 'Indice');
  analisi.forEach((a,i)=>{
    XLSX.utils.book_append_sheet(wb, apBuildSheet(window.analisiPrezziAOA(a), [4,5], [3]), window.fascicoloSheetName(a,i));
  });
  XLSX.writeFile(wb, window.fascicoloFileName());
  toast(`Fascicolo scaricato: ${analisi.length} analisi + indice`,'ok');
}

export async function copyField(btn, val){
  try{
    await navigator.clipboard.writeText(val);
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = val; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }
  btn.textContent = '✓';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1400);
}
